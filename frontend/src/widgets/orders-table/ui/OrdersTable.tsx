import { Fragment, useEffect, useRef } from 'react'
import { crewShortName, ORDER_RISK_META, ORDER_STATUS_META, type Order } from '@/entities/plan'
import { TASK_KIND_META } from '@/entities/task'
import { cn, formatDuration, formatPlanTime } from '@/shared/lib'
import { Icon } from '@/shared/ui'

type Props = {
  orders: Order[]
  selectedId: number | null
  checked: Set<number>
  onToggle: (id: number) => void
  onToggleAll: () => void
  onOpen: (id: number) => void
  onOpenRoute: (id: number) => void
}

function HeaderCheckbox({ orders, checked, onToggleAll }: Pick<Props, 'orders' | 'checked' | 'onToggleAll'>) {
  const ref = useRef<HTMLInputElement>(null)
  const count = orders.filter((o) => checked.has(o.id)).length
  const all = orders.length > 0 && count === orders.length

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && !all
  }, [count, all])

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Выбрать все на странице"
      checked={all}
      onChange={onToggleAll}
      className="size-4 cursor-pointer align-middle accent-primary"
    />
  )
}

function RiskCell({ order }: { order: Order }) {
  const meta = ORDER_RISK_META[order.risk]
  const a = order.assignment
  let label = meta.label
  if (order.risk === 'late' && a) label = `Опозд. ${a.late_min} мин`
  if (order.risk === 'risk' && a) label = `Запас ${Math.max(0, a.tw_end - a.start_min)} мин`
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-label-sm font-semibold whitespace-nowrap', meta.className)}>
      <Icon name={meta.icon} size={14} />
      {label}
    </span>
  )
}

function CrewCell({ order }: { order: Order }) {
  if (order.unassigned) {
    return (
      <span
        title={order.unassigned.explanation}
        className="inline-flex max-w-[190px] items-center gap-1 truncate rounded bg-type-emergency-bg px-2 py-0.5 text-label-sm font-medium text-signal-danger"
      >
        <Icon name="warning" size={14} />
        <span className="truncate">{order.unassigned.reason || 'Не назначена'}</span>
      </span>
    )
  }
  if (!order.crew) return <span className="text-text-muted">—</span>
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: order.crew.color }}
      >
        {crewShortName(order.crew.name)}
      </span>
      <span className="truncate text-title-sm">
        {order.crew.name} <span className="font-normal text-text-muted">({order.crew.transport})</span>
      </span>
    </div>
  )
}

export function OrdersTable({ orders, selectedId, checked, onToggle, onToggleAll, onOpen, onOpenRoute }: Props) {
  return (
    <table className="w-full min-w-[1180px] border-collapse text-left">
      <thead className="sticky top-0 z-20 border-b border-border bg-bg-subtle shadow-sm">
        <tr className="h-10 text-label-md tracking-wider text-text-secondary uppercase">
          <th className="w-10 px-3 text-center">
            <HeaderCheckbox orders={orders} checked={checked} onToggleAll={onToggleAll} />
          </th>
          <th className="w-28 px-3">ID заявки</th>
          <th className="w-32 px-2">Тип</th>
          <th className="w-14 px-2 text-center">Ист.</th>
          <th className="w-36 px-2">Статус</th>
          <th className="min-w-[220px] px-3">Адрес</th>
          <th className="w-28 px-2">Окно</th>
          <th className="w-28 px-2">Длительность</th>
          <th className="w-52 px-2">Назначенная бригада</th>
          <th className="w-36 px-2">SLA / Риск</th>
          <th className="w-20 px-3 text-right">Действия</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border text-body-sm">
        {orders.map((order) => {
          const { task, assignment } = order
          const kind = order.kind ? TASK_KIND_META[order.kind] : null
          const status = ORDER_STATUS_META[order.status]
          const selected = order.id === selectedId
          const done = order.status === 'completed'

          return (
            <Fragment key={order.id}>
            <tr
              onClick={() => onOpen(order.id)}
              className={cn(
                'group h-11 cursor-pointer border-l-4 transition-colors',
                order.unassigned ? 'border-type-emergency' : (kind?.border ?? 'border-transparent'),
                selected ? 'bg-primary-soft' : order.unassigned ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-bg-subtle',
              )}
            >
              <td className="px-3 text-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`Выбрать заявку ${order.id}`}
                  checked={checked.has(order.id)}
                  onChange={() => onToggle(order.id)}
                  className="size-4 cursor-pointer align-middle accent-primary"
                />
              </td>
              <td className="px-3">
                <span className="flex items-center gap-1.5 text-metric font-semibold">
                  #{order.id}
                  {order.critical && <span className="size-1.5 animate-pulse rounded-full bg-signal-danger" />}
                </span>
              </td>
              <td className="px-2">
                {kind ? (
                  <span className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-label-sm font-medium', kind.soft, kind.text)}>
                    <span className={cn('size-1.5 rounded-full', kind.bg)} />
                    {kind.label}
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className="px-2 text-center">
                {order.source ? (
                  <span className="rounded bg-surface-high px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">{order.source}</span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className="px-2">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-medium whitespace-nowrap', status.className)}>
                  <Icon name={status.icon} size={13} />
                  {status.label}
                </span>
              </td>
              <td className="max-w-[280px] px-3">
                {task ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn('truncate font-medium', done ? 'text-text-muted line-through' : 'text-text-primary')}>
                      {task.address}
                    </span>
                    {task.district && <span className="shrink-0 text-[11px] text-text-muted">({task.district})</span>}
                  </div>
                ) : (
                  <span className="truncate text-text-muted">Адрес не передан</span>
                )}
              </td>
              <td className="px-2 text-metric whitespace-nowrap text-text-secondary">
                {task ? `${formatPlanTime(task.tw_start)} – ${formatPlanTime(task.tw_end)}` : '—'}
              </td>
              <td className="px-2 text-metric whitespace-nowrap">{task ? formatDuration(task.service_time) : '—'}</td>
              <td className="max-w-[220px] px-2">
                <CrewCell order={order} />
              </td>
              <td className="px-2">
                <RiskCell order={order} />
              </td>
              <td className="px-3 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  title={assignment ? 'Показать на маршруте' : 'Нет маршрута'}
                  disabled={!order.crew}
                  onClick={() => onOpenRoute(order.id)}
                  className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-surface hover:text-primary disabled:opacity-30"
                >
                  <Icon name="alt_route" />
                </button>
              </td>
            </tr>
            {order.unassigned && (
              <tr className="bg-amber-50/70">
                <td colSpan={11} className="px-4 py-2 text-body-sm">
                  <span className="flex items-center gap-2">
                    <Icon name="error" size={16} className="text-signal-warning" />
                    <strong>Нет подходящей бригады:</strong>
                    <span className="truncate text-text-secondary">{order.unassigned.explanation || order.unassigned.reason}</span>
                  </span>
                </td>
              </tr>
            )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
