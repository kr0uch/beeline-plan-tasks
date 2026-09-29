import type { ReactNode } from 'react'
import { crewShortName, ORDER_STATUS_META, transportIcon, type Order, type OrderStatus } from '@/entities/plan'
import { getPriorityMeta, requirementLabel, TASK_KIND_META } from '@/entities/task'
import { cn, formatClock, formatDuration, formatPlanTime, plural, toDayMin } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'

type Props = {
  order: Order
  now: number
  replanning: boolean
  onClose: () => void
  onReplan: () => void
  onOpenRoute: () => void
}

type Step = { label: string; icon: string; time: string | null }

const STEP_INDEX: Record<OrderStatus, number> = {
  unassigned: 1,
  planned: 2,
  en_route: 3,
  in_progress: 4,
  completed: 5,
}

function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 border-b border-border p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-title-sm">{title}</span>
        {aside}
      </div>
      {children}
    </div>
  )
}

function Stepper({ steps, current, failed }: { steps: Step[]; current: number; failed: boolean }) {
  const progress = (Math.min(current, steps.length - 1) / (steps.length - 1)) * 100
  return (
    <div className="relative flex w-full items-start justify-between">
      <div className="absolute top-3 right-3 left-3 h-0.5 -translate-y-1/2 bg-border" />
      <div
        className={cn('absolute top-3 left-3 h-0.5 -translate-y-1/2', failed ? 'bg-signal-danger' : 'bg-signal-info')}
        style={{ width: `calc(${progress}% - ${(progress / 100) * 24}px)` }}
      />
      {steps.map((step, i) => {
        const done = i < current || (i === current && current === steps.length - 1)
        const active = i === current && !done
        return (
          <div key={step.label} className="relative z-10 flex w-14 flex-col items-center gap-1 text-center">
            <div
              className={cn(
                'flex size-6 items-center justify-center rounded-full ring-2 ring-white',
                done && 'bg-signal-info text-white shadow-sm',
                active && !failed && 'animate-pulse bg-primary text-white ring-4 ring-primary-soft',
                active && failed && 'bg-signal-danger text-white ring-4 ring-type-emergency-bg',
                !done && !active && 'border-2 border-border bg-bg-surface text-text-muted',
              )}
            >
              <Icon name={active && failed ? 'close' : done ? (i === 0 ? 'check' : step.icon) : step.icon} size={13} />
            </div>
            <span className={cn('text-[10px] leading-none', active ? 'font-bold text-primary' : 'text-text-secondary', failed && active && 'text-signal-danger')}>
              {step.time ?? (done ? '✓' : '--:--')}
            </span>
            <span className={cn('text-[11px] leading-tight', active ? 'font-bold' : 'text-text-muted', active && (failed ? 'text-signal-danger' : 'text-primary'))}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function OrderCard({ order, now, replanning, onClose, onReplan, onOpenRoute }: Props) {
  const { task, assignment, crew, unassigned } = order
  const kind = order.kind ? TASK_KIND_META[order.kind] : null
  const priority = getPriorityMeta(task?.priority || assignment?.priority || '')
  const status = ORDER_STATUS_META[order.status]

  const steps: Step[] = [
    { label: 'Получена', icon: 'inbox', time: null },
    { label: 'План VRP', icon: 'psychology', time: null },
    { label: unassigned ? 'Не назначена' : 'Назначена', icon: 'assignment_ind', time: null },
    { label: 'В пути', icon: 'directions_car', time: order.departureMin !== null ? formatClock(order.departureMin) : null },
    { label: 'В работе', icon: 'build', time: assignment ? formatPlanTime(assignment.start_min) : null },
    { label: 'Завершена', icon: 'check_circle', time: assignment ? formatPlanTime(assignment.end_min) : null },
  ]
  const current = unassigned ? 2 : STEP_INDEX[order.status]

  const timeline = assignment
    ? [
        { at: order.departureMin, text: `Выезд бригады к заявке (точка №${order.position} маршрута)` },
        { at: toDayMin(assignment.arrival_min), text: 'Прибытие на адрес' },
        { at: toDayMin(assignment.start_min), text: 'Начало работ' },
        { at: toDayMin(assignment.end_min), text: 'Завершение работ' },
      ]
    : []

  return (
    <aside className="z-30 flex h-full w-[440px] shrink-0 flex-col border-l border-border bg-bg-surface shadow-xl">
      <div className="flex items-start justify-between border-b border-border bg-bg-subtle/50 p-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-headline-sm">Карточка заявки</span>
            <span className={cn('rounded px-1.5 py-0.5 text-metric font-bold', kind ? cn(kind.soft, kind.text) : 'bg-type-emergency-bg text-signal-danger')}>
              #{order.id}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-label-sm text-text-muted">
            <span>{task ? `${order.source === 'HD' ? 'Helpdesk' : order.source === 'BK' ? 'Биллинг' : 'Источник не указан'}` : 'Нет данных о заявке'}</span>
            {task?.district && (
              <>
                <span>•</span>
                <span>{task.district}</span>
              </>
            )}
            {(task || assignment) && (
              <>
                <span>•</span>
                <span className={cn('font-semibold', order.critical ? 'text-signal-danger' : 'text-text-secondary')}>
                  {order.critical ? 'Критический SLA' : `Приоритет: ${priority.label.toLowerCase()}`}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Закрыть карточку"
          onClick={onClose}
          className="rounded p-1 text-text-muted transition-colors hover:bg-surface-high hover:text-text-primary"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-label-sm font-semibold tracking-wider text-text-muted uppercase">Статус выполнения маршрута</span>
            <Badge className={status.className}>
              <Icon name={status.icon} size={13} />
              {status.label}
            </Badge>
          </div>
          <Stepper steps={steps} current={current} failed={Boolean(unassigned)} />
        </div>

        {unassigned && (
          <Section title="Почему заявка не распределена" className="bg-type-emergency-bg/30">
            <div className="flex flex-col gap-1.5 rounded-lg border border-type-emergency/30 bg-bg-surface p-2.5">
              {unassigned.reason && <Badge className="w-fit bg-type-emergency-bg text-type-emergency">{unassigned.reason}</Badge>}
              <p className="text-[12px] leading-relaxed text-text-secondary">{unassigned.explanation || 'Причина не указана.'}</p>
            </div>
            <p className="text-label-md text-text-muted">Бэкенд вернул только номер заявки. Измените состав бригад или окна и пересчитайте план.</p>
          </Section>
        )}

        {task && (
          <Section title="Адрес и окно клиента">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-2.5">
              <Icon name="location_on" className="mt-0.5 text-type-connection" />
              <div className="min-w-0">
                <div className="text-title-sm">{task.address}</div>
                <div className="text-body-sm text-text-secondary">
                  {[task.type_hd, task.type_bk].filter(Boolean).join(' · ') || kind?.label}
                </div>
              </div>
            </div>
          </Section>
        )}

        {task && (
          <div className="border-b border-border bg-surface-low p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-title-sm">
                <Icon name="auto_awesome" className="text-type-upsell" />
                Расчёт алгоритма
              </span>
              <span className="text-metric font-semibold text-type-upsell">{formatDuration(task.service_time)}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg-surface p-2.5 text-label-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Окно клиента:</span>
                <span className="text-metric">
                  {formatPlanTime(task.tw_start)} – {formatPlanTime(task.tw_end)}
                </span>
              </div>
              {assignment && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Прибытие / начало работ:</span>
                    <span className="text-metric">
                      {formatPlanTime(assignment.arrival_min)} / {formatPlanTime(assignment.start_min)}
                    </span>
                  </div>
                  {assignment.start_min > assignment.arrival_min && (
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">Ожидание окна:</span>
                      <span className="text-metric">{formatDuration(assignment.start_min - assignment.arrival_min)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={cn('font-medium', assignment.late_min ? 'text-signal-danger' : 'text-status-completed')}>
                      {assignment.late_min ? 'Опоздание:' : 'SLA:'}
                    </span>
                    <span className={cn('text-metric font-semibold', assignment.late_min ? 'text-signal-danger' : 'text-status-completed')}>
                      {assignment.late_min ? `+${formatDuration(assignment.late_min)}` : 'в пределах окна'}
                    </span>
                  </div>
                  {assignment.explanation && (
                    <p className="mt-0.5 border-t border-border pt-1.5 text-[12px] leading-relaxed text-text-secondary">
                      <strong className="text-text-primary">Обоснование:</strong> {assignment.explanation}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {task && (
          <Section
            title="Требуемые компетенции и оснащение"
            aside={
              assignment && (
                <span className="flex items-center gap-1 text-label-sm font-semibold text-status-completed">
                  <Icon name="verified" size={14} />
                  Все подтверждены
                </span>
              )
            }
          >
            {[...task.required_skills.map((name) => ({ name, tag: 'Квалификация' })), ...task.required_equipment.map((name) => ({ name, tag: 'Оборудование' }))].map(
              (item) => (
                <div key={`${item.tag}-${requirementLabel(item.name)}`} className="flex items-center justify-between rounded-lg border border-border bg-bg-subtle p-2">
                  <span className="flex items-center gap-2 text-body-sm">
                    <Icon name={assignment ? 'task_alt' : 'help'} className={assignment ? 'text-status-completed' : 'text-text-muted'} />
                    {requirementLabel(item.name)}
                  </span>
                  <span className="text-[10px] text-text-muted uppercase">{item.tag}</span>
                </div>
              ),
            )}
            {!task.required_skills.length && !task.required_equipment.length && (
              <span className="text-body-sm text-text-muted">Особых требований нет</span>
            )}
          </Section>
        )}

        {crew && (
          <Section title="Текущее назначение">
            <div className="flex items-center justify-between rounded-lg border border-border bg-bg-subtle p-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg text-title-md text-white" style={{ background: crew.color }}>
                  {crewShortName(crew.name)}
                </span>
                <div className="flex flex-col">
                  <span className="text-title-sm">{crew.name}</span>
                  <span className="flex items-center gap-1 text-[12px] text-text-secondary">
                    <Icon name={transportIcon(crew.transport)} size={14} />
                    {crew.transport} • точка №{order.position} • {crew.stops.length} {plural(crew.stops.length, 'заявка', 'заявки', 'заявок')} за смену
                  </span>
                </div>
              </div>
              <button type="button" title="Позвонить бригадиру" className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary-soft">
                <Icon name="phone" />
              </button>
            </div>
          </Section>
        )}

        {timeline.length > 0 && (
          <Section title="Хронология по плану" className="border-b-0">
            <div className="flex flex-col divide-y divide-border">
              {timeline.map((e) => {
                const past = e.at !== null && e.at <= now
                return (
                  <div key={e.text} className="flex items-start gap-2 py-2">
                    <span className={cn('mt-0.5 w-10 shrink-0 text-[11px]', past ? 'text-text-secondary' : 'text-text-muted')}>
                      {e.at !== null ? formatClock(e.at) : '--:--'}
                    </span>
                    <Icon name={past ? 'check_circle' : 'schedule'} size={14} className={cn('mt-0.5', past ? 'text-status-completed' : 'text-text-muted')} />
                    <p className={cn('text-[12px] leading-tight', past ? 'text-text-primary' : 'text-text-secondary')}>{e.text}</p>
                  </div>
                )
              })}
            </div>
          </Section>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-bg-surface p-3">
        <button
          type="button"
          disabled={replanning}
          onClick={onReplan}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-surface text-title-sm shadow-sm transition-colors hover:bg-bg-subtle disabled:opacity-50"
        >
          <Icon name="refresh" className={cn(replanning && 'animate-spin')} />
          Перепланировать
        </button>
        <button
          type="button"
          disabled={!crew}
          onClick={onOpenRoute}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-title-sm text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <Icon name="map" />
          Открыть маршрут
        </button>
      </div>
    </aside>
  )
}
