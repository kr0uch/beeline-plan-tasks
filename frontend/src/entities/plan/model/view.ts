import { SHIFT_DURATION_MIN } from '@/shared/config'
import type { AssignedTask, PlanResponse, Route, Task, UnassignedTask } from './types'

export type PlannedStop = {
  task: Task
  assignment?: AssignedTask
  order: number
}

export type CrewLoad = 'overload' | 'high' | 'normal' | 'idle'

export type Crew = {
  id: string
  name: string
  transport: string
  distanceKm: number
  timeMin: number
  travelMin: number | null
  serviceMin: number | null
  loadPct: number
  load: CrewLoad
  lateCount: number
  lateMin: number
  color: string
  stops: PlannedStop[]
}

export type PlanView = {
  crews: Crew[]
  unassigned: UnassignedTask[]
  tasks: Map<number, Task>
  assignments: Map<number, AssignedTask>
  crewByTask: Map<number, string>
}

const ROUTE_COLORS = ['#2563EB', '#0891B2', '#7C3AED', '#EA580C', '#16A34A', '#DB2777', '#CA8A04', '#4F46E5']

function crewLoad(pct: number, stops: number): CrewLoad {
  if (!stops) return 'idle'
  if (pct > 100) return 'overload'
  if (pct >= 85) return 'high'
  return 'normal'
}

function buildCrew(route: Route, index: number, assignments: Map<number, AssignedTask>): Crew {
  const stops = route.tasks
    .map((task, i) => ({ task, assignment: assignments.get(task.id), fallback: i }))
    .sort((a, b) => (a.assignment?.position_in_route ?? a.fallback) - (b.assignment?.position_in_route ?? b.fallback))
    .map(({ task, assignment }, i) => ({ task, assignment, order: i + 1 }))

  const late = stops.filter((s) => (s.assignment?.late_min ?? 0) > 0)
  const loadPct = Math.round((route.time_min / SHIFT_DURATION_MIN) * 100)

  return {
    id: route.engineer_id,
    name: route.engineer_name,
    transport: route.transport,
    distanceKm: route.distance_km,
    timeMin: route.time_min,
    travelMin: route.travel_time_min ?? null,
    serviceMin: route.service_time_min ?? null,
    loadPct,
    load: crewLoad(loadPct, stops.length),
    lateCount: late.length,
    lateMin: late.reduce((sum, s) => sum + (s.assignment?.late_min ?? 0), 0),
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    stops,
  }
}

export function buildPlanView(plan: PlanResponse): PlanView {
  const assignments = new Map((plan.assigned ?? []).map((a) => [a.task_id, a]))
  const crews = (plan.routes ?? []).map((r, i) => buildCrew(r, i, assignments))

  const tasks = new Map<number, Task>()
  const crewByTask = new Map<number, string>()
  for (const crew of crews) {
    for (const { task } of crew.stops) {
      tasks.set(task.id, task)
      crewByTask.set(task.id, crew.id)
    }
  }

  return { crews, unassigned: plan.unassigned ?? [], tasks, assignments, crewByTask }
}
