import type { Order, OrderSource, OrderStatus } from '@/entities/plan'
import type { TaskKind } from '@/entities/task'

export type KindFilter = 'all' | TaskKind | 'unassigned'

export type OrderFilters = {
  kind: KindFilter
  query: string
  status: OrderStatus | 'all'
  crewId: string | 'all'
  source: OrderSource | 'all'
}

export const DEFAULT_FILTERS: OrderFilters = {
  kind: 'all',
  query: '',
  status: 'all',
  crewId: 'all',
  source: 'all',
}

function matchesQuery(order: Order, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, '')
  if (!q) return true
  const haystack = [
    String(order.id),
    order.task?.address,
    order.task?.district,
    order.task?.type_hd,
    order.task?.type_bk,
    order.crew?.name,
    order.unassigned?.reason,
  ]
  return haystack.some((v) => v?.toLowerCase().includes(q))
}

export function applyFilters(orders: Order[], f: OrderFilters, ignoreKind = false): Order[] {
  return orders.filter((o) => {
    if (!ignoreKind && f.kind !== 'all') {
      if (f.kind === 'unassigned' ? !o.unassigned : o.kind !== f.kind) return false
    }
    if (f.status !== 'all' && o.status !== f.status) return false
    if (f.crewId !== 'all' && o.crew?.id !== f.crewId) return false
    if (f.source !== 'all' && o.source !== f.source) return false
    return matchesQuery(o, f.query)
  })
}
