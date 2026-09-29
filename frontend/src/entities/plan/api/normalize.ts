import type { AssignedTask, PlanResponse, RawPlanResponse, Task } from '../model/types'

export function normalizePlan(raw: RawPlanResponse): PlanResponse {
  const routes = raw.routes ?? []
  const tasks = new Map<number, Task>()
  for (const r of routes) for (const t of r.tasks ?? []) tasks.set(t.id, t)

  const assigned: AssignedTask[] = (raw.assigned ?? []).map(({ task, ...a }) => {
    const t = task ?? tasks.get(a.task_id)
    return { ...a, tw_start: a.tw_start ?? t?.tw_start ?? 0, tw_end: a.tw_end ?? t?.tw_end ?? 0 }
  })

  return {
    ...raw,
    routes: routes.map((r) => ({ ...r, tasks: r.tasks ?? [] })),
    assigned,
    unassigned: raw.unassigned ?? [],
    baseline_metrics: raw.baseline_metrics ?? raw.ml_metrics,
  }
}
