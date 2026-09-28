import { getTaskKind, isCriticalPriority, type TaskKind } from '@/entities/task'
import { toDayMin } from '@/shared/lib'
import type { AssignedTask, Task, UnassignedTask } from './types'
import type { Crew, PlanView } from './view'

export type OrderStatus = 'unassigned' | 'planned' | 'en_route' | 'in_progress' | 'completed'
export type OrderSource = 'HD' | 'BK'
export type OrderRisk = 'unassigned' | 'late' | 'risk' | 'ok' | 'done'

export type Order = {
  id: number
  task: Task | null
  assignment: AssignedTask | null
  unassigned: UnassignedTask | null
  crew: Crew | null
  position: number | null
  kind: TaskKind | null
  source: OrderSource | null
  critical: boolean
  status: OrderStatus
  risk: OrderRisk
  departureMin: number | null
}

const RISK_MARGIN_MIN = 15
const FIRST_LEG_MIN = 30

function orderStatus(start: number, end: number, departure: number, now: number): OrderStatus {
  if (now >= end) return 'completed'
  if (now >= start) return 'in_progress'
  if (now >= departure) return 'en_route'
  return 'planned'
}

function orderRisk(status: OrderStatus, a: AssignedTask): OrderRisk {
  if (a.late_min > 0) return 'late'
  if (status === 'completed') return 'done'
  if (a.tw_end - a.start_min < RISK_MARGIN_MIN) return 'risk'
  return 'ok'
}

export function orderSource(task: Task): OrderSource | null {
  if (task.type_hd) return 'HD'
  if (task.type_bk) return 'BK'
  return null
}

export function buildOrders(view: PlanView, now: number): Order[] {
  const assigned = view.crews.flatMap((crew) =>
    crew.stops.map(({ task, assignment, order }, i): Order => {
      const prev = crew.stops[i - 1]?.assignment
      if (!assignment) {
        return {
          id: task.id,
          task,
          assignment: null,
          unassigned: null,
          crew,
          position: order,
          kind: getTaskKind(task),
          source: orderSource(task),
          critical: isCriticalPriority(task.priority),
          status: 'planned',
          risk: 'ok',
          departureMin: null,
        }
      }
      const start = toDayMin(assignment.start_min)
      const end = toDayMin(assignment.end_min)
      const departure = prev ? toDayMin(prev.end_min) : toDayMin(assignment.arrival_min) - FIRST_LEG_MIN
      const status = orderStatus(start, end, departure, now)
      return {
        id: task.id,
        task,
        assignment,
        unassigned: null,
        crew,
        position: assignment.position_in_route || order,
        kind: getTaskKind(task),
        source: orderSource(task),
        critical: isCriticalPriority(task.priority || assignment.priority),
        status,
        risk: orderRisk(status, assignment),
        departureMin: departure,
      }
    }),
  )

  const unassigned = view.unassigned.map(
    (u): Order => ({
      id: u.task_id,
      task: u.task ?? null,
      assignment: null,
      unassigned: u,
      crew: null,
      position: null,
      kind: u.task ? getTaskKind(u.task) : null,
      source: u.task ? orderSource(u.task) : null,
      critical: false,
      status: 'unassigned',
      risk: 'unassigned',
      departureMin: null,
    }),
  )

  return [...unassigned, ...assigned.sort((a, b) => a.id - b.id)]
}
