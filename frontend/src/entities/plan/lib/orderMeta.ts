import type { OrderRisk, OrderStatus } from '../model/orders'

type Meta = { label: string; icon: string; className: string }

export const ORDER_STATUS_META: Record<OrderStatus, Meta> = {
  unassigned: { label: 'Не распределена', icon: 'block', className: 'bg-type-emergency-bg text-type-emergency' },
  planned: { label: 'Запланирована', icon: 'send', className: 'bg-slate-100 text-status-dispatched' },
  en_route: { label: 'В пути', icon: 'directions_car', className: 'bg-cyan-50 text-status-en-route' },
  in_progress: { label: 'В работе', icon: 'build', className: 'bg-amber-50 text-status-in-progress' },
  completed: { label: 'Завершена', icon: 'done_all', className: 'bg-emerald-50 text-status-completed' },
}

export const ORDER_RISK_META: Record<OrderRisk, Meta> = {
  unassigned: { label: 'Нет бригады', icon: 'warning', className: 'bg-type-emergency-bg text-signal-danger' },
  late: { label: 'Опоздание', icon: 'timer', className: 'bg-type-emergency-bg text-signal-danger' },
  risk: { label: 'Риск SLA', icon: 'schedule', className: 'bg-amber-50 text-signal-warning' },
  ok: { label: 'В срок', icon: 'check_circle', className: 'bg-emerald-50 text-status-completed' },
  done: { label: 'Выполнена', icon: 'task_alt', className: 'bg-emerald-50 text-status-completed' },
}

export const ORDER_STATUS_ORDER: OrderStatus[] = ['unassigned', 'planned', 'en_route', 'in_progress', 'completed']
