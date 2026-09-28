import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { transportIcon } from '@/entities/plan'
import { requirementList } from '@/entities/task'
import { PlanUploadForm, usePlan } from '@/features/load-plan'
import { cn, formatClock, formatPlanTime, plural, toDayMin, useNow } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'
import { buildScenario, type TimelineItem } from '../lib/scenario'
import { MiniRouteMap } from './MiniRouteMap'
import { NewTaskForm } from './NewTaskForm'

function Timeline({ title, items }: { title: string; items: TimelineItem[] }) {
  return (
    <div className="border-t border-border p-3">
      <div className="mb-2 text-label-sm font-semibold tracking-wider text-text-muted uppercase">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span
            key={t.taskId}
            className={cn(
              'rounded px-2 py-1 text-center text-label-sm leading-tight',
              t.emergency && 'bg-signal-danger font-bold text-white',
              !t.emergency && t.shifted && 'bg-type-upsell-bg text-type-upsell',
              !t.emergency && !t.shifted && 'bg-type-connection-bg text-type-connection',
              t.late && !t.emergency && 'ring-1 ring-signal-warning',
            )}
          >
            {formatPlanTime(t.start)} – {formatPlanTime(t.end)}
            <br />
            {t.emergency ? '(Авария)' : `#${t.taskId}`}
          </span>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, icon, value, sub, note, good, accent }: { label: string; icon: string; value: string; sub?: string; note: string; good: boolean; accent?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-bg-surface p-3 shadow-sm', accent ? 'border-signal-success/50 ring-1 ring-signal-success/30' : 'border-border')}>
      <div className="flex items-center justify-between text-label-sm tracking-wide text-text-secondary uppercase">
        {label}
        <Icon name={icon} size={16} className={accent ? 'text-signal-success' : 'text-text-muted'} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn('text-headline-md', accent && 'text-signal-success')}>{value}</span>
        {sub && <span className="text-label-sm text-text-muted">{sub}</span>}
      </div>
      <div className={cn('mt-1 text-label-sm', good ? 'text-signal-success' : 'text-signal-warning')}>{note}</div>
    </div>
  )
}

function CrewCard({ tone, badge, title, subtitle, match, children }: { tone: 'main' | 'backup'; badge: string; title: string; subtitle: ReactNode; match: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-lg border bg-bg-surface p-4 shadow-sm', tone === 'main' ? 'border-type-emergency/40' : 'border-border')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={cn('flex size-9 items-center justify-center rounded-lg', tone === 'main' ? 'bg-type-emergency-bg text-signal-danger' : 'bg-primary-soft text-primary')}>
            <Icon name={tone === 'main' ? 'engineering' : 'shield'} />
          </span>
          <div>
            <div className="flex items-center gap-2 text-title-md">
              {title}
              <Badge className={tone === 'main' ? 'bg-signal-danger text-white' : 'bg-primary-soft text-primary'}>{badge}</Badge>
            </div>
            <div className="text-label-md text-text-secondary">{subtitle}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-label-sm text-text-muted">Совместимость</div>
          <div className={cn('text-title-sm', tone === 'main' ? 'text-signal-success' : 'text-text-secondary')}>{match}</div>
        </div>
      </div>
      <div className="space-y-1.5 rounded-lg bg-bg-subtle p-3 text-body-sm">{children}</div>
    </div>
  )
}

export function ReplanPage() {
  const { plan, view, previous, replanTask, replan, status, error } = usePlan()
  const [showForm, setShowForm] = useState(false)
  const navigate = useNavigate()
  const now = useNow()
  const [applied, setApplied] = useState(false)
  const scenario = useMemo(
    () => (view ? buildScenario(view, replanTask && previous ? { taskId: replanTask.id, previous: previous.view } : undefined) : null),
    [view, replanTask, previous],
  )
  const nextId = view ? Math.max(0, ...view.tasks.keys(), ...view.unassigned.map((u) => u.task_id)) + 1 : 1
  const form = (onCancel?: () => void) => (
    <NewTaskForm
      nextId={nextId}
      busy={status === 'loading'}
      error={status === 'error' ? error : null}
      onCancel={onCancel}
      onSubmit={async (task) => {
        if (await replan(task)) setShowForm(false)
      }}
    />
  )

  if (!plan || !view) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <PlanUploadForm />
      </div>
    )
  }

  if (!scenario) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center text-body-md text-text-secondary">
        <Icon name="task_alt" size={36} className="text-signal-success" />
        В текущем плане нет аварий и критичных заявок. Добавьте новую заявку, чтобы встроить её в план.
        <div className="w-full max-w-4xl text-left">{form()}</div>
      </div>
    )
  }

  const { emergency, assignment, crew, backup } = scenario
  const ml = plan.ml_metrics
  const base = plan.baseline_metrics
  const slaLeft = toDayMin(assignment.tw_end) - now
  const shifted = scenario.shiftedIds.length
  const affected = scenario.affectedCrewIds.length
  const rate = (m: typeof ml) => Math.round((m.assigned_rate <= 1 ? m.assigned_rate * 100 : m.assigned_rate) * 10) / 10
  const backupLate = backup ? backup.arrivalMin - assignment.arrival_min : 0

  return (
    <div className="flex min-h-full flex-col">
      <section className="bg-signal-danger px-4 py-3 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="warning" size={20} />
          <span className="text-headline-sm uppercase">Экстренное перепланирование</span>
          <span>•</span>
          <Badge className="bg-black/20 text-body-sm text-white">Авария #{emergency.id}</Badge>
          <span className="text-body-sm text-white/90">
            ({emergency.type_bk || emergency.type_hd || 'Авария'}, {emergency.address})
          </span>
        </div>
        <div className="mt-2 inline-flex items-center gap-2 rounded bg-black/25 px-2.5 py-1 text-body-sm">
          <Icon name="timer" size={16} />
          {slaLeft > 0 ? (
            <>
              <strong>Таймер SLA: {slaLeft} мин</strong> до закрытия окна клиента
            </>
          ) : (
            <strong>
              Окно клиента {formatPlanTime(assignment.tw_start)} – {formatPlanTime(assignment.tw_end)}
            </strong>
          )}
        </div>
        <p className="mt-1.5 text-body-sm text-white/95">
          Алгоритм VRP сформировал решение с минимальным возмущением графика: затронута{' '}
          <strong>
            {affected} {plural(affected, 'бригада', 'бригады', 'бригад')} из {view.crews.length}
          </strong>
          , {plural(shifted, 'перенесена', 'перенесены', 'перенесено')}{' '}
          <strong>
            {shifted} {plural(shifted, 'заявка', 'заявки', 'заявок')}
          </strong>
          , пробег увеличился на <strong>{scenario.extraKm.toFixed(1)} км</strong>.
        </p>
      </section>

      <div className="flex flex-col gap-5 p-4 pb-28">
        {showForm ? (
          form(() => setShowForm(false))
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-bg-surface px-4 py-3">
            <Icon name="add_alert" className="text-signal-danger" />
            <span className="mr-auto text-body-sm text-text-secondary">
              {scenario.real ? `План пересчитан с новой заявкой #${scenario.emergency.id}` :'Сценарий построен по текущему плану. Добавьте новую заявку, чтобы пересчитать маршруты на бэкенде.'}
            </span>
            <button type="button" onClick={() => setShowForm(true)} className="flex h-8 items-center gap-1.5 rounded-lg bg-signal-danger px-3 text-title-sm text-white hover:opacity-90">
              <Icon name="add" />
              Новая заявка
            </button>
          </div>
        )}
        <section className="grid grid-cols-2 gap-4">
          <div className="overflow-hidden rounded-lg border border-border bg-bg-surface shadow-sm">
            <div className="flex items-center justify-between p-3">
              <span className="flex items-center gap-2 text-title-md">
                <Icon name="history" />
                План ДО поступления аварии
              </span>
              <Badge className="bg-primary-soft text-primary">{scenario.real ? 'Предыдущий расчёт' : 'Реконструкция'}</Badge>
            </div>
            <div style={{ height: 256 }}>
              <MiniRouteMap stops={scenario.beforeStops} color="#64748B" emergency={emergency} dashed />
            </div>
            <Timeline title={`Исходная шкала времени: ${crew.name}`} items={scenario.before} />
          </div>

          <div className="overflow-hidden rounded-lg border-2 border-primary bg-bg-surface shadow-sm">
            <div className="flex items-center justify-between p-3">
              <span className="flex items-center gap-2 text-title-md text-primary">
                <Icon name="auto_fix_high" />
                План ПОСЛЕ оптимизации (текущее предложение)
              </span>
              <Badge className="bg-emerald-50 text-status-completed">Рекомендовано VRP</Badge>
            </div>
            <div style={{ height: 256 }}>
              <MiniRouteMap stops={crew.stops} color={crew.color} emergency={emergency} />
            </div>
            <Timeline title={`Новая шкала времени: ${crew.name} (авария встроена)`} items={scenario.after} />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-headline-sm">Влияние перепланирования на операционные KPI</h2>
            <span className="text-label-md text-text-muted">ML-план в сравнении с базовым</span>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Kpi
              label="Выполнение SLA"
              icon="verified"
              value={`${rate(ml)}%`}
              sub={`было ${rate(base)}%`}
              note={rate(ml) >= rate(base) ? `+${(rate(ml) - rate(base)).toFixed(1)}% к базовому` : 'ниже базового'}
              good={rate(ml) >= rate(base)}
            />
            <Kpi
              label="Время реакции на аварию"
              icon="bolt"
              value={`${scenario.reactionMin} мин`}
              sub={`прибытие ${formatPlanTime(assignment.arrival_min)}`}
              note={assignment.late_min ? `Опоздание ${assignment.late_min} мин` : 'Окно клиента соблюдено'}
              good={!assignment.late_min}
              accent
            />
            <Kpi
              label="Суммарный пробег"
              icon="local_shipping"
              value={`${ml.total_distance_km.toFixed(1)} км`}
              sub={`было ${base.total_distance_km.toFixed(1)}`}
              note={`${ml.total_distance_km <= base.total_distance_km ? '−' : '+'}${Math.abs(ml.total_distance_km - base.total_distance_km).toFixed(1)} км`}
              good={ml.total_distance_km <= base.total_distance_km}
            />
            <Kpi label="Затронуто бригад" icon="groups" value={String(affected)} sub={`из ${view.crews.length}`} note={crew.name} good />
            <Kpi
              label="Перенесённых заявок"
              icon="swap_horiz"
              value={String(shifted)}
              sub={scenario.shiftedIds.map((id) => `#${id}`).join(', ')}
              note={shifted ? 'Сдвиг внутри окон клиентов' : 'Без переносов'}
              good
            />
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-headline-sm">Детализация изменений по экипажам</h2>
            <span className="text-label-md text-text-muted">Остальные бригады следуют штатному расписанию</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CrewCard
              tone="main"
              badge="Основной исполнитель"
              title={crew.name}
              subtitle={
                <span className="flex items-center gap-1">
                  <Icon name={transportIcon(crew.transport)} size={14} />
                  {crew.transport} • {crew.stops.length} заявок • загрузка {crew.loadPct}%
                </span>
              }
              match="100% Match"
            >
              <div className="flex items-center gap-2 text-title-sm">
                <Icon name="edit_road" size={16} className="text-signal-danger" />
                Изменение маршрута
              </div>
              <div>
                Встроена авария: {formatPlanTime(assignment.start_min)} – {formatPlanTime(assignment.end_min)}, позиция №{assignment.position_in_route}
              </div>
              {scenario.after
                .filter((t) => t.shifted)
                .map((t) => {
                  const was = scenario.before.find((b) => b.taskId === t.taskId)
                  return (
                    <div key={t.taskId} className="text-text-secondary">
                      Сдвиг #{t.taskId}: {was ? formatPlanTime(was.start) : '—'} → {formatPlanTime(t.start)}
                      {t.late && <span className="text-signal-warning"> (выход за окно)</span>}
                    </div>
                  )
                })}
              <div className="flex items-center gap-2 pt-1 text-label-md text-text-secondary">
                <Icon name="construction" size={16} />
                Требуется: {requirementList([...emergency.required_skills, ...emergency.required_equipment]) || 'без особых требований'}
              </div>
            </CrewCard>

            {backup ? (
              <CrewCard
                tone="backup"
                badge="Страховочный резерв"
                title={backup.crew.name}
                subtitle={
                  <span className="flex items-center gap-1">
                    <Icon name={transportIcon(backup.crew.transport)} size={14} />
                    {backup.crew.transport} • {backup.distanceKm.toFixed(1)} км до аварии
                  </span>
                }
                match={`${Math.round(backup.skillMatch * 100)}%`}
              >
                <div className="flex items-center gap-2 text-title-sm">
                  <Icon name="schedule" size={16} className="text-signal-warning" />
                  Маршрут без изменений
                </div>
                <div className="text-text-secondary">
                  Оценочное прибытие при переназначении: {formatClock(toDayMin(backup.arrivalMin))}
                </div>
                <div className="text-text-secondary">Остаётся в резерве, пока основная бригада не подтвердит выезд</div>
              </CrewCard>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-4 text-body-sm text-text-muted">
                Других бригад для резерва нет
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon name="psychology" />
            </span>
            <div>
              <h2 className="text-headline-sm">Обоснование решения оптимизатора</h2>
              <div className="text-label-md text-text-muted">Прозрачность автоматического распределения заказов</div>
            </div>
          </div>
          <blockquote className="mb-4 rounded-lg bg-bg-subtle p-3 text-body-md leading-relaxed">
            «{assignment.explanation || `${crew.name} выбрана оптимизатором как лучший исполнитель.`}»
          </blockquote>

          <div className="mb-2 text-label-sm font-semibold tracking-wider text-text-muted uppercase">Сравнение сценариев реагирования</div>
          <table className="w-full text-left text-body-sm">
            <thead className="bg-bg-subtle text-label-md text-text-secondary uppercase">
              <tr>
                <th className="px-3 py-2">Критерий</th>
                <th className="px-3 py-2 text-primary">Вариант А (рекомендованный: {crew.name})</th>
                <th className="px-3 py-2">Вариант Б ({backup ? backup.crew.name : '—'})</th>
                <th className="px-3 py-2 text-right">Выигрыш</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2.5">Время прибытия на аварию</td>
                <td className="px-3 py-2.5 text-signal-success">{formatPlanTime(assignment.arrival_min)}</td>
                <td className="px-3 py-2.5 text-signal-danger">{backup ? `${formatClock(toDayMin(backup.arrivalMin))} (оценка)` : '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-signal-success">{backupLate > 0 ? `+${backupLate} мин быстрее` : '—'}</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5">Дополнительный пробег</td>
                <td className="px-3 py-2.5">+{scenario.extraKm.toFixed(1)} км</td>
                <td className="px-3 py-2.5">{backup ? `+${backup.distanceKm.toFixed(1)} км` : '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-signal-success">
                  {backup ? `${(scenario.extraKm - backup.distanceKm).toFixed(1)} км` : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5">Сдвинутые плановые заявки</td>
                <td className="px-3 py-2.5 text-signal-success">{shifted}</td>
                <td className="px-3 py-2.5">{backup ? backup.crew.stops.filter((s) => (s.assignment?.end_min ?? 0) > assignment.arrival_min).length : '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-signal-success">Минимум возмущений</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5">Совпадение навыков и оборудования</td>
                <td className="px-3 py-2.5 text-signal-success">100%</td>
                <td className="px-3 py-2.5 text-signal-warning">{backup ? `${Math.round(backup.skillMatch * 100)}%` : '—'}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-signal-success">Мгновенный старт</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div className="sticky bottom-0 z-20 flex items-center gap-3 border-t border-border bg-bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className={cn('size-2.5 rounded-full', applied ? 'bg-primary' : 'bg-signal-success')} />
        <div className="mr-auto">
          <div className="text-title-sm">{applied ? 'Перепланирование применено' : 'Решение оптимизатора готово к применению'}</div>
          <div className="text-label-sm text-text-muted">Push-уведомления будут разосланы в мобильные приложения инженеров</div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/orders?id=${emergency.id}`)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-signal-danger px-3 text-title-sm text-signal-danger hover:bg-type-emergency-bg"
        >
          <Icon name="close" />
          Отклонить и назначить вручную
        </button>
        <button
          type="button"
          onClick={() => navigate(`/planning?task=${emergency.id}`)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-title-sm hover:bg-bg-subtle"
        >
          <Icon name="tune" />
          Показать на карте
        </button>
        <button
          type="button"
          disabled={applied}
          onClick={() => setApplied(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-title-sm text-white hover:bg-primary-hover disabled:opacity-60"
        >
          <Icon name={applied ? 'task_alt' : 'verified'} />
          {applied ? 'Применено' : 'Применить перепланирование'}
        </button>
      </div>
    </div>
  )
}
