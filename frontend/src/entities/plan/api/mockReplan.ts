import type { AssignedTask, PlanResponse, ReplanRequest, Route } from '../model/types'

const SPEED_KM_PER_MIN = 0.45
const ROAD_FACTOR = 1.35

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dx = (a.lon - b.lon) * 63
  const dy = (a.lat - b.lat) * 111
  return Math.sqrt(dx * dx + dy * dy) * ROAD_FACTOR
}

export function simulateReplan(plan: PlanResponse, { new_task: task, current_time_min: now }: ReplanRequest): PlanResponse {
  const byTask = new Map(plan.assigned.map((a) => [a.task_id, a]))
  let best: { route: Route; index: number; cost: number } | null = null
  for (const route of plan.routes) {
    route.tasks.forEach((t, i) => {
      const a = byTask.get(t.id)
      if (!a || a.end_min < now) return
      const cost = km(t, task)
      if (!best || cost < best.cost) best = { route, index: i, cost }
    })
  }
  if (!best) {
    return {
      ...plan,
      unassigned: [...plan.unassigned, { task_id: task.id, reason: 'no_capacity', explanation: 'Нет бригад с незавершёнными заявками для встраивания.' }],
    }
  }
  const { route, index, cost } = best as { route: Route; index: number; cost: number }
  const anchor = byTask.get(route.tasks[index].id)!
  const travel = Math.round(cost / SPEED_KM_PER_MIN)
  const arrival = Math.max(now, anchor.end_min) + travel
  const start = Math.max(arrival, task.tw_start)
  const end = start + task.service_time
  const inserted: AssignedTask = {
    task_id: task.id,
    engineer_id: route.engineer_id,
    engineer_name: route.engineer_name,
    position_in_route: index + 2,
    priority: task.priority,
    arrival_min: arrival,
    start_min: start,
    end_min: end,
    late_min: Math.max(0, start - task.tw_end),
    tw_start: task.tw_start,
    tw_end: task.tw_end,
    explanation: `Ближайшая бригада к адресу (${cost.toFixed(1)} км от текущей точки маршрута), прибытие через ${travel} мин. Последующие заявки маршрута сдвинуты.`,
  }

  let shiftFrom = end
  const assigned = plan.assigned.map((a) => {
    if (a.engineer_id !== route.engineer_id || a.position_in_route <= index + 1) return a
    const delta = Math.max(0, shiftFrom + 15 - a.arrival_min)
    const next = {
      ...a,
      position_in_route: a.position_in_route + 1,
      arrival_min: a.arrival_min + delta,
      start_min: Math.max(a.start_min + delta, a.tw_start),
      end_min: Math.max(a.start_min + delta, a.tw_start) + (a.end_min - a.start_min),
    }
    next.late_min = Math.max(0, next.start_min - next.tw_end)
    shiftFrom = next.end_min
    return next
  })

  const routes = plan.routes.map((r) =>
    r.engineer_id !== route.engineer_id
      ? r
      : {
          ...r,
          tasks: [...r.tasks.slice(0, index + 1), task, ...r.tasks.slice(index + 1)],
          distance_km: Math.round((r.distance_km + cost * 2) * 10) / 10,
          time_min: r.time_min + task.service_time + travel * 2,
        },
  )
  const all = [...assigned, inserted]
  const late = all.filter((a) => a.late_min > 0)
  const ml = plan.ml_metrics
  return {
    ...plan,
    assigned: all,
    routes,
    ml_metrics: {
      ...ml,
      total_tasks: ml.total_tasks + 1,
      assigned: ml.assigned + 1,
      assigned_rate: (ml.assigned + 1) / (ml.total_tasks + 1),
      late_count: late.length,
      total_late_min: late.reduce((s, a) => s + a.late_min, 0),
      total_distance_km: Math.round((ml.total_distance_km + cost * 2) * 10) / 10,
    },
  }
}
