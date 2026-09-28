import type { AssignedTask, Crew, PlanChange, PlannedStop, PlanView, Task } from '@/entities/plan'
import { getTaskKind, isCriticalPriority } from '@/entities/task'

export type TimelineItem = {
  taskId: number
  start: number
  end: number
  emergency: boolean
  shifted: boolean
  late: boolean
}

export type BackupOption = {
  crew: Crew
  distanceKm: number
  arrivalMin: number
  skillMatch: number
}

export type Scenario = {
  emergency: Task
  assignment: AssignedTask
  crew: Crew
  before: TimelineItem[]
  after: TimelineItem[]
  beforeStops: PlannedStop[]
  shiftedIds: number[]
  extraKm: number
  reactionMin: number
  backup: BackupOption | null
  affectedCrewIds: string[]
  real: boolean
}

const ROAD_FACTOR = 1.35
const BACKUP_SPEED_KMH = 25

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * ROAD_FACTOR
}

function pickEmergency(view: PlanView): { crew: Crew; index: number } | null {
  let best: { crew: Crew; index: number; score: number } | null = null
  for (const crew of view.crews) {
    crew.stops.forEach((stop, index) => {
      const kind = getTaskKind(stop.task)
      const score =
        (kind === 'emergency' ? 1000 : 0) +
        (isCriticalPriority(stop.task.priority) ? 500 : 0) +
        (crew.stops.length - index) * 10
      if (score > 0 && (!best || score > best.score)) best = { crew, index, score }
    })
  }
  return best
}

function skillMatch(task: Task, crew: Crew): number {
  const need: string[] = [...task.required_skills, ...task.required_equipment]
  if (!need.length) return 1
  const has = new Set<string>(crew.stops.flatMap((s) => [...s.task.required_skills, ...s.task.required_equipment]))
  return need.filter((n) => has.has(n)).length / need.length
}

function findTask(view: PlanView, taskId: number): { crew: Crew; index: number } | null {
  for (const crew of view.crews) {
    const index = crew.stops.findIndex((s) => s.task.id === taskId)
    if (index >= 0) return { crew, index }
  }
  return null
}

function timeline(stops: PlannedStop[], emergencyId: number, shifted: Set<number>): TimelineItem[] {
  return stops.flatMap((s) =>
    s.assignment
      ? [
          {
            taskId: s.task.id,
            start: s.assignment.start_min,
            end: s.assignment.end_min,
            emergency: s.task.id === emergencyId,
            shifted: shifted.has(s.task.id),
            late: s.assignment.late_min > 0,
          },
        ]
      : [],
  )
}

export function buildScenario(view: PlanView, replan?: { taskId: number; previous: PlanView; changes?: PlanChange[] }): Scenario | null {
  const picked = replan ? findTask(view, replan.taskId) : pickEmergency(view)
  if (!picked) return null
  const { crew, index } = picked
  const stop = crew.stops[index]
  const assignment = stop.assignment
  if (!assignment) return null

  const prev = crew.stops[index - 1]
  const next = crew.stops[index + 1]
  const prevEnd = prev?.assignment?.end_min ?? assignment.arrival_min
  const shift = assignment.end_min - prevEnd

  const after: TimelineItem[] = crew.stops.flatMap((s, i) =>
    s.assignment
      ? [
          {
            taskId: s.task.id,
            start: s.assignment.start_min,
            end: s.assignment.end_min,
            emergency: i === index,
            shifted: i > index,
            late: s.assignment.late_min > 0,
          },
        ]
      : [],
  )

  const before: TimelineItem[] = crew.stops.flatMap((s, i) => {
    if (i === index || !s.assignment) return []
    const delta = i > index ? shift : 0
    const start = Math.max(s.task.tw_start, s.assignment.start_min - delta)
    return [{ taskId: s.task.id, start, end: start + s.task.service_time, emergency: false, shifted: false, late: start > s.task.tw_end }]
  })

  const detour = prev && next ? distanceKm(prev.task, stop.task) + distanceKm(stop.task, next.task) - distanceKm(prev.task, next.task) : 0

  const backup = view.crews
    .filter((c) => c.id !== crew.id && c.stops.length)
    .map((c): BackupOption => {
      const nearest = c.stops.reduce((a, b) => (distanceKm(a.task, stop.task) <= distanceKm(b.task, stop.task) ? a : b))
      const km = distanceKm(nearest.task, stop.task)
      const free = nearest.assignment?.end_min ?? assignment.arrival_min
      return {
        crew: c,
        distanceKm: km,
        arrivalMin: Math.max(free, assignment.tw_start) + Math.round((km / BACKUP_SPEED_KMH) * 60),
        skillMatch: skillMatch(stop.task, c),
      }
    })
    .sort((a, b) => b.skillMatch - a.skillMatch || a.arrivalMin - b.arrivalMin)[0] ?? null

  if (replan) {
    const prevCrew = replan.previous.crews.find((c) => c.id === crew.id)
    const shifted = new Set<number>()
    const affected = new Set<string>([crew.id])
    const changes = (replan.changes ?? []).filter((ch) => ch.task_id !== replan.taskId)
    for (const ch of changes) {
      shifted.add(ch.task_id)
      if (ch.to_engineer_id) affected.add(ch.to_engineer_id)
      if (ch.from_engineer_id) affected.add(ch.from_engineer_id)
    }
    if (!replan.changes) for (const c of view.crews) {
      for (const st of c.stops) {
        const old = replan.previous.assignments.get(st.task.id)
        if (st.assignment && old && (old.start_min !== st.assignment.start_min || old.engineer_id !== st.assignment.engineer_id)) {
          shifted.add(st.task.id)
          affected.add(c.id)
        }
      }
    }
    return {
      emergency: stop.task,
      assignment,
      crew,
      before: timeline(prevCrew?.stops ?? [], -1, new Set()),
      after: timeline(crew.stops, stop.task.id, shifted),
      beforeStops: prevCrew?.stops ?? [],
      shiftedIds: [...shifted],
      extraKm: Math.max(0, crew.distanceKm - (prevCrew?.distanceKm ?? crew.distanceKm)),
      reactionMin: Math.max(0, assignment.arrival_min - assignment.tw_start),
      backup,
      affectedCrewIds: [...affected],
      real: true,
    }
  }

  return {
    affectedCrewIds: [crew.id],
    real: false,
    emergency: stop.task,
    assignment,
    crew,
    before,
    after,
    beforeStops: crew.stops.filter((_, i) => i !== index),
    shiftedIds: crew.stops.slice(index + 1).map((s) => s.task.id),
    extraKm: Math.max(0, detour),
    reactionMin: Math.max(0, assignment.arrival_min - assignment.tw_start),
    backup,
  }
}
