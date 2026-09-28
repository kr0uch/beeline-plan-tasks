import type { ReactNode } from 'react'
import { transportIcon, type Crew, type PlanView } from '@/entities/plan'
import { getPriorityMeta, getTaskKind, requirementList, TASK_KIND_META } from '@/entities/task'
import { cn, formatDuration, formatPlanTime } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'

type Props = {
  view: PlanView
  selectedCrewId: string | null
  selectedTaskId: number | null
  confirmedCrewIds: Set<string>
  onSelectTask: (taskId: number) => void
  onConfirmCrew: (crewId: string) => void
  onClose: () => void
}

function Panel({ header, children, footer }: { header: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <aside className="z-20 flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-bg-surface shadow-lg">
      <div className="flex items-start justify-between gap-2 border-b border-border bg-bg-subtle p-3">{header}</div>
      <div className="flex-1 space-y-3.5 overflow-y-auto p-3">{children}</div>
      {footer && <div className="flex items-center gap-2 border-t border-border p-3">{footer}</div>}
    </aside>
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Закрыть"
      onClick={onClick}
      className="rounded p-1 text-text-muted transition-colors hover:bg-surface-high hover:text-text-primary"
    >
      <Icon name="close" size={20} />
    </button>
  )
}

function Check({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-label-sm last:border-0">
      <span className="flex min-w-0 items-center gap-1.5 text-text-secondary">
        <Icon name={ok ? 'check_circle' : 'error'} size={16} className={ok ? 'text-signal-success' : 'text-signal-warning'} />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('shrink-0 text-right font-semibold', ok ? 'text-text-primary' : 'text-signal-warning')}>{value}</span>
    </div>
  )
}

function ConfirmFooter({ crew, confirmed, onConfirm }: { crew: Crew; confirmed: boolean; onConfirm: () => void }) {
  return (
    <>
      <button
        type="button"
        disabled={confirmed}
        onClick={onConfirm}
        className={cn(
          'flex h-9 flex-1 items-center justify-center gap-1.5 rounded text-title-sm shadow-sm transition-colors',
          confirmed ? 'bg-signal-success/10 text-signal-success' : 'bg-primary text-white hover:bg-primary-hover',
        )}
      >
        <Icon name={confirmed ? 'task_alt' : 'verified'} />
        {confirmed ? `Маршрут ${crew.name} подтверждён` : 'Подтвердить маршрут'}
      </button>
      <button
        type="button"
        title="Связаться с инженером"
        className="flex h-9 items-center justify-center rounded border border-border px-3 transition-colors hover:bg-bg-subtle"
      >
        <Icon name="phone" className="text-text-secondary" />
      </button>
    </>
  )
}

export function TaskInspector({
  view,
  selectedCrewId,
  selectedTaskId,
  confirmedCrewIds,
  onSelectTask,
  onConfirmCrew,
  onClose,
}: Props) {
  const unassigned = selectedTaskId !== null ? view.unassigned.find((u) => u.task_id === selectedTaskId) : undefined
  if (unassigned) {
    return (
      <Panel
        header={
          <>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Badge className="bg-type-emergency-bg text-type-emergency">Не распределена</Badge>
                {unassigned.reason && <Badge className="bg-bg-subtle text-text-secondary border border-border">{unassigned.reason}</Badge>}
              </div>
              <h2 className="text-headline-sm">Заявка #{unassigned.task_id}</h2>
            </div>
            <CloseButton onClick={onClose} />
          </>
        }
      >
        <div className="space-y-1.5 rounded-lg border border-type-emergency/30 bg-type-emergency-bg/40 p-2.5">
          <div className="flex items-center gap-1.5 text-title-sm text-type-emergency">
            <Icon name="psychology" size={16} />
            Почему не назначена?
          </div>
          <p className="text-body-sm leading-relaxed text-text-secondary">{unassigned.explanation || 'Причина не указана.'}</p>
        </div>
        <p className="text-label-md text-text-muted">
          Измените параметры смены или состав бригад и нажмите «Пересчитать план».
        </p>
      </Panel>
    )
  }

  const crew = view.crews.find((c) => c.id === selectedCrewId) ?? null
  const task = selectedTaskId !== null ? view.tasks.get(selectedTaskId) : undefined

  if (!task) {
    if (!crew) {
      return (
        <Panel header={<span className="text-title-md">Детали</span>}>
          <div className="flex flex-col items-center gap-2 py-10 text-center text-body-sm text-text-muted">
            <Icon name="touch_app" size={28} />
            Выберите бригаду или точку на карте
          </div>
        </Panel>
      )
    }
    return (
      <Panel
        header={
          <>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-label-md text-text-muted">
                <Icon name={transportIcon(crew.transport)} size={16} />
                {crew.transport}
              </div>
              <h2 className="flex items-center gap-2 text-headline-sm">
                <span className="size-3 rounded-full" style={{ background: crew.color }} />
                {crew.name}
              </h2>
            </div>
            <CloseButton onClick={onClose} />
          </>
        }
        footer={<ConfirmFooter crew={crew} confirmed={confirmedCrewIds.has(crew.id)} onConfirm={() => onConfirmCrew(crew.id)} />}
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Пробег', value: `${crew.distanceKm.toFixed(1)} км` },
            { label: 'Время', value: formatDuration(crew.timeMin) },
            { label: 'Загрузка', value: `${crew.loadPct}%` },
          ].map((m) => (
            <div key={m.label} className="rounded border border-border p-2">
              <div className="text-label-sm text-text-muted">{m.label}</div>
              <div className="text-metric font-semibold">{m.value}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1.5 text-label-sm font-bold tracking-wider text-text-muted uppercase">Маршрут</div>
          <ol className="space-y-1">
            {crew.stops.map(({ task: t, assignment, order }) => {
              const kind = TASK_KIND_META[getTaskKind(t)]
              const late = (assignment?.late_min ?? 0) > 0
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTask(t.id)}
                    className="flex w-full items-center gap-2 rounded p-1.5 text-left hover:bg-bg-subtle"
                  >
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-label-sm font-bold text-white', kind.bg)}>
                      {order}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-title-sm">{t.address}</span>
                      <span className="block truncate text-label-sm text-text-muted">
                        #{t.id} · {t.type_hd || kind.label}
                        {t.type_bk && ` · ${t.type_bk}`}
                      </span>
                    </span>
                    {assignment && (
                      <span className={cn('shrink-0 text-metric', late ? 'text-signal-warning' : 'text-text-secondary')}>
                        {formatPlanTime(assignment.start_min)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </Panel>
    )
  }

  const assignment = view.assignments.get(task.id)
  const owner = view.crews.find((c) => c.id === view.crewByTask.get(task.id)) ?? crew
  const kind = TASK_KIND_META[getTaskKind(task)]
  const priority = getPriorityMeta(task.priority || assignment?.priority || '')
  const late = assignment?.late_min ?? 0

  return (
    <Panel
      header={
        <>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge className={cn(kind.soft, kind.text)}>
                {task.type_hd || kind.label} #{task.id}
              </Badge>
              <Badge className={priority.className}>{priority.label}</Badge>
              {late > 0 && <Badge className="bg-amber-100 text-signal-warning">Опоздание {late} мин</Badge>}
            </div>
            <h2 className="text-headline-sm">{task.type_bk || kind.label}</h2>
          </div>
          <CloseButton onClick={onClose} />
        </>
      }
      footer={
        owner && <ConfirmFooter crew={owner} confirmed={confirmedCrewIds.has(owner.id)} onConfirm={() => onConfirmCrew(owner.id)} />
      }
    >
      <div className="space-y-1.5 rounded-lg border border-border bg-bg-subtle p-2.5">
        <div className="flex items-start gap-2">
          <Icon name="location_on" className="mt-0.5 text-type-connection" />
          <div>
            <div className="text-title-sm">{task.address}</div>
            <div className="text-body-sm text-text-secondary">
              {task.district || '—'} · {task.lat.toFixed(4)}, {task.lon.toFixed(4)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-1.5 text-label-sm">
          <div>
            <span className="text-text-muted">Бригада:</span>
            <span className="ml-1 font-semibold">{owner?.name ?? assignment?.engineer_name ?? '—'}</span>
          </div>
          <div>
            <span className="text-text-muted">Точка маршрута:</span>
            <span className="ml-1 font-semibold">№{assignment?.position_in_route ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-border p-2">
          <div className="text-label-sm text-text-muted">Окно клиента</div>
          <div className="mt-0.5 text-metric font-semibold">
            {formatPlanTime(task.tw_start)} – {formatPlanTime(task.tw_end)}
          </div>
          <div className={cn('text-label-sm font-medium', late ? 'text-signal-warning' : 'text-signal-success')}>
            {late ? `Опоздание ${late} мин` : 'В пределах интервала'}
          </div>
        </div>
        <div className="rounded border border-primary/30 bg-primary-soft/50 p-2">
          <div className="text-label-sm font-medium text-type-connection">План работ</div>
          <div className="mt-0.5 text-metric font-bold text-type-connection">
            {assignment ? `${formatPlanTime(assignment.start_min)} – ${formatPlanTime(assignment.end_min)}` : '—'}
          </div>
          <div className="text-label-sm text-text-muted">
            {formatDuration(task.service_time)}
            {assignment && ` · прибытие ${formatPlanTime(assignment.arrival_min)}`}
          </div>
        </div>
      </div>

      {assignment?.explanation && (
        <div className="space-y-1.5 rounded-lg border border-border bg-surface-low p-2.5">
          <div className="flex items-center gap-1.5 text-title-sm text-type-connection">
            <Icon name="psychology" size={16} />
            Почему выбрана {owner?.name ?? assignment.engineer_name}?
          </div>
          <p className="text-body-sm leading-relaxed text-text-secondary">{assignment.explanation}</p>
        </div>
      )}

      <div className="pt-1">
        <div className="mb-1 text-label-sm font-bold tracking-wider text-text-muted uppercase">Проверка условий алгоритма</div>
        <Check
          ok
          label={`Квалификация: ${requirementList(task.required_skills) || 'не требуется'}`}
          value={task.required_skills.length ? 'Да' : '—'}
        />
        <Check
          ok
          label={`Оборудование: ${requirementList(task.required_equipment) || 'не требуется'}`}
          value={task.required_equipment.length ? 'В наличии' : '—'}
        />
        <Check ok={!late} label="Временное окно клиента" value={late ? `+${late} мин` : 'Соблюдено'} />
        {owner && (
          <Check ok label={`Транспорт (${owner.transport})`} value={`${owner.distanceKm.toFixed(1)} км за смену`} />
        )}
      </div>
    </Panel>
  )
}
