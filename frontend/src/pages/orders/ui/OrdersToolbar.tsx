import type { ReactNode } from 'react'
import { ORDER_STATUS_META, ORDER_STATUS_ORDER, type Crew, type Order, type OrderSource, type OrderStatus } from '@/entities/plan'
import { TASK_KIND_META, type TaskKind } from '@/entities/task'
import { cn, plural } from '@/shared/lib'
import { Icon } from '@/shared/ui'
import type { KindFilter, OrderFilters } from '../model/filters'

type Props = {
  filters: OrderFilters
  onChange: (patch: Partial<OrderFilters>) => void
  baseOrders: Order[]
  crews: Crew[]
  actions: ReactNode
  total: number
  unassignedCount: number
  criticalCount: number
  lateCount: number
}

const KIND_PILLS: Array<{ id: TaskKind; label: string }> = [
  { id: 'emergency', label: 'Аварии' },
  { id: 'connection', label: 'Подключения' },
  { id: 'repair', label: 'Ремонты' },
  { id: 'delivery', label: 'Дозаказы' },
]

const today = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  label: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 w-full cursor-pointer appearance-none rounded-lg border border-border bg-bg-subtle pr-7 pl-2.5 text-title-sm text-text-secondary outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="expand_more" size={16} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-text-muted" />
    </div>
  )
}

export function OrdersToolbar({
  filters,
  onChange,
  baseOrders,
  crews,
  actions,
  total,
  unassignedCount,
  criticalCount,
  lateCount,
}: Props) {
  const countOf = (kind: KindFilter) =>
    kind === 'all' ? baseOrders.length : baseOrders.filter((o) => (kind === 'unassigned' ? o.unassigned : o.kind === kind)).length

  const pill = (id: KindFilter, label: string, dot?: string, danger?: boolean) => {
    const active = filters.kind === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => onChange({ kind: id })}
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-label-md transition-colors',
          active ? 'bg-primary text-white shadow-sm' : 'border border-border bg-bg-subtle text-text-secondary hover:bg-surface-high',
        )}
      >
        {dot && <span className={cn('size-2 rounded-full', dot)} />}
        {label}
        <span
          className={cn(
            'rounded-full text-[11px]',
            active ? 'bg-white/20 px-1.5' : danger ? 'font-semibold text-signal-danger' : 'text-text-muted',
          )}
        >
          {countOf(id)}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-headline-md">Реестр заявок</h1>
            <span className="rounded-full bg-surface-high px-2 py-0.5 text-metric text-primary">{total}</span>
          </div>
          <p className="mt-0.5 text-body-sm text-text-muted">
            Всего {total} {plural(total, 'заявка', 'заявки', 'заявок')} на {today}
            {unassignedCount > 0 && (
              <>
                {' • '}
                <span className="font-medium text-signal-warning">{unassignedCount} без бригады</span>
              </>
            )}
            {criticalCount > 0 && (
              <>
                {' • '}
                <span className="font-medium text-signal-danger">
                  {criticalCount} {plural(criticalCount, 'авария', 'аварии', 'аварий')}
                </span>
              </>
            )}
            {lateCount > 0 && (
              <>
                {' • '}
                <span className="font-medium text-signal-danger">{lateCount} с опозданием</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {pill('all', 'Все')}
          {KIND_PILLS.map((k) => pill(k.id, k.label, TASK_KIND_META[k.id].bg, k.id === 'emergency'))}
          {unassignedCount > 0 && pill('unassigned', 'Без бригады', 'bg-signal-danger', true)}
        </div>

        <div className="flex max-w-3xl flex-1 items-center justify-end gap-2">
          <div className="relative w-full max-w-xs">
            <Icon name="search" className="absolute top-1/2 left-2.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => onChange({ query: e.target.value })}
              placeholder="Поиск по номеру, адресу, бригаде…"
              className="h-8 w-full rounded-lg border border-border bg-bg-subtle pr-3 pl-8 text-body-sm outline-none placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <Select<OrderStatus | 'all'>
            label="Статус"
            className="min-w-[150px]"
            value={filters.status}
            onChange={(status) => onChange({ status })}
            options={[{ value: 'all', label: 'Все статусы' }, ...ORDER_STATUS_ORDER.map((s) => ({ value: s, label: ORDER_STATUS_META[s].label }))]}
          />
          <Select<string>
            label="Бригада"
            className="min-w-[140px]"
            value={filters.crewId}
            onChange={(crewId) => onChange({ crewId })}
            options={[{ value: 'all', label: 'Все бригады' }, ...crews.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Select<OrderSource | 'all'>
            label="Источник"
            className="min-w-[130px]"
            value={filters.source}
            onChange={(source) => onChange({ source })}
            options={[
              { value: 'all', label: 'Все (HD, BK)' },
              { value: 'HD', label: 'Helpdesk (HD)' },
              { value: 'BK', label: 'Биллинг (BK)' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
