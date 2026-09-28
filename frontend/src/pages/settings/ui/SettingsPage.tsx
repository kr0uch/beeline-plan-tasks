import { useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, saveSettings, useAlgorithmSettings, type AlgorithmSettings } from '@/entities/algorithm-settings'
import type { Metrics } from '@/entities/plan'
import { TASK_KIND_META } from '@/entities/task'
import { usePlan } from '@/features/load-plan'
import { cn, formatDuration } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'

type Weight = keyof AlgorithmSettings['weights']

const WEIGHTS: Array<{ key: Weight; icon: string; title: string; text: string; min: number; max: number; danger?: boolean }> = [
  { key: 'sla', icon: 'e911_emergency', title: 'Штраф за нарушение аварийного SLA', text: 'Критический штраф: при аварии маршруты перестраиваются в первую очередь, вытесняя плановые заявки.', min: 1, max: 20, danger: true },
  { key: 'late', icon: 'schedule', title: 'Штраф за опоздание к клиенту', text: 'Штраф за каждую минуту опоздания относительно согласованного окна приезда.', min: 0.5, max: 10 },
  { key: 'overtime', icon: 'more_time', title: 'Штраф за сверхурочную работу экипажа', text: 'Предотвращает переработки сверх утверждённого графика смены.', min: 0.5, max: 8 },
  { key: 'travel', icon: 'route', title: 'Стоимость времени и пробега в пути', text: 'Оптимизация холостого километража, износа автопарка и расхода топлива.', min: 0.5, max: 5 },
]

const RULES: Array<{ key: keyof AlgorithmSettings['rules']; title: string; text: string; tag?: string }> = [
  { key: 'dynamicReplan', title: 'Динамическое перепланирование в реальном времени', text: 'Автоматический пересчёт маршрутов при поступлении аварийных заявок.' },
  { key: 'stability', title: 'Минимальные изменения маршрутов', text: 'При перепланировании затрагиваются только ближайшие бригады, остальные маршруты сохраняются.', tag: 'Защита расписания' },
  { key: 'publicTransport', title: 'Учитывать общественный транспорт', text: 'Расчёт времени для пеших инженеров с учётом метро и наземного транспорта.', tag: 'Пешие бригады' },
  { key: 'overtime60', title: 'Разрешить переработки до +60 мин', text: 'Расширение вечерней смены при риске срыва абонентских подключений.' },
]

const PRIORITY_NOTE: Record<string, string> = {
  emergency: 'Безусловный вызов',
  connection: 'Окно ±15 мин',
  repair: 'Окно ±45 мин',
  delivery: 'Окно ±90 мин',
}

function Card({ title, subtitle, aside, children, className }: { title: string; subtitle?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-border bg-bg-surface p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-headline-sm">{title}</h2>
          {subtitle && <p className="text-body-sm text-text-muted">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function LocalBadge() {
  return (
    <Badge className="shrink-0 border border-border bg-bg-subtle text-text-muted" >
      <Icon name="devices" size={13} />
      Сохраняется в браузере
    </Badge>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-border')}
    >
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

type Row = { label: string; icon: string; before: number; after: number; unit: 'num' | 'km' | 'min' | 'pct'; lower: boolean }

function fmt(v: number, unit: Row['unit']) {
  if (unit === 'km') return `${v.toFixed(1)} км`
  if (unit === 'min') return formatDuration(v)
  if (unit === 'pct') return `${Math.round(v)}%`
  return String(v)
}

function compareRows(ml: Metrics, base: Metrics): Row[] {
  const rate = (m: Metrics) => (m.assigned_rate <= 1 ? m.assigned_rate * 100 : m.assigned_rate)
  return [
    { label: 'Назначено заявок', icon: 'assignment_turned_in', before: rate(base), after: rate(ml), unit: 'pct', lower: false },
    { label: 'Опоздания к абонентам', icon: 'schedule', before: base.late_count, after: ml.late_count, unit: 'num', lower: true },
    { label: 'Суммарный пробег флота', icon: 'speed', before: base.total_distance_km, after: ml.total_distance_km, unit: 'km', lower: true },
    { label: 'Сверхурочные часы бригад', icon: 'more_time', before: base.overtime_min, after: ml.overtime_min, unit: 'min', lower: true },
    { label: 'Разброс загрузки (σ)', icon: 'balance', before: base.load_std, after: ml.load_std, unit: 'min', lower: true },
  ]
}

export function SettingsPage() {
  const saved = useAlgorithmSettings()
  const { plan, view, recalculate, status, fileName, isDemo } = usePlan()
  const [draft, setDraft] = useState<AlgorithmSettings>(saved)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const set = (patch: Partial<AlgorithmSettings>) => setDraft((d) => ({ ...d, ...patch }))

  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.priority]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ priority: next })
  }

  const rows = plan ? compareRows(plan.ml_metrics, plan.baseline_metrics) : []
  const better = rows.filter((r) => (r.lower ? r.after < r.before : r.after > r.before)).length
  const score = rows.length ? Math.round(60 + (better / rows.length) * 40) : 0
  const loading = status === 'loading'

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-headline-lg">Настройки алгоритма VRP</h1>
            <Badge className="bg-emerald-50 text-status-completed">● Профиль {dirty ? 'изменён' : 'сохранён'}</Badge>
          </div>
          <p className="text-body-md text-text-secondary">Параметры функции оптимизации маршрутов, штрафные коэффициенты и регламент SLA</p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(DEFAULT_SETTINGS)}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-title-sm text-text-secondary hover:bg-bg-subtle"
        >
          <Icon name="restart_alt" />
          Сбросить
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => saveSettings(draft)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-soft px-3 text-title-sm text-primary hover:bg-surface-high disabled:opacity-50"
        >
          <Icon name="save" />
          Сохранить профиль
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary-soft/60 p-3 text-body-sm">
        <Icon name="info" className="text-primary" />
        <div>
          Бэкенд сейчас принимает только режим пояснений (<code>explain</code>). Весовые коэффициенты, приоритеты, правила и лимит SLA сохраняются в браузере и
          начнут влиять на расчёт, когда сервер будет их принимать.
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(320px, 2fr)' }}>
        <div className="flex flex-col gap-4">
          <Card
            title="Пояснения к назначениям"
            subtitle="Как сервер формирует текст «Почему выбрана бригада»"
            aside={<Badge className="bg-emerald-50 text-status-completed">Передаётся на сервер</Badge>}
          >
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {[
                { on: true, title: 'Языковая модель (LLM)', text: 'Развёрнутые пояснения человеческим языком. Дольше и требует ключ Groq.' },
                { on: false, title: 'Только правила', text: 'Короткие пояснения по совпадению навыков, окон и расстояния. Быстрее.' },
              ].map((o) => (
                <button
                  key={o.title}
                  type="button"
                  onClick={() => set({ explainWithLLM: o.on })}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    draft.explainWithLLM === o.on ? 'border-primary bg-primary-soft' : 'border-border hover:bg-bg-subtle',
                  )}
                >
                  <div className="flex items-center gap-2 text-title-sm">
                    <Icon name={draft.explainWithLLM === o.on ? 'radio_button_checked' : 'radio_button_unchecked'} size={18} className="text-primary" />
                    {o.title}
                  </div>
                  <p className="mt-1 text-label-md text-text-secondary">{o.text}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title="Весовые коэффициенты целевой функции"
            subtitle="Относительные веса штрафов для баланса между клиентским сервисом и затратами флота"
            aside={<LocalBadge />}
          >
            <div className="space-y-3">
              {WEIGHTS.map((w) => {
                const v = draft.weights[w.key]
                return (
                  <div key={w.key} className={cn('rounded-lg p-3', w.danger ? 'border border-type-emergency/30 bg-type-emergency-bg/40' : 'bg-bg-subtle')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <Icon name={w.icon} className={w.danger ? 'text-signal-danger' : 'text-primary'} />
                        <div>
                          <div className="text-title-sm">{w.title}</div>
                          <p className="text-label-md text-text-secondary">{w.text}</p>
                        </div>
                      </div>
                      <span className={cn('text-headline-md', w.danger ? 'text-signal-danger' : 'text-primary')}>{v.toFixed(1)}×</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-label-sm text-text-muted">
                      <span>{w.min}×</span>
                      <input
                        type="range"
                        min={w.min}
                        max={w.max}
                        step={0.1}
                        value={v}
                        onChange={(e) => set({ weights: { ...draft.weights, [w.key]: Number(e.target.value) } })}
                        className={cn('flex-1', w.danger ? 'accent-signal-danger' : 'accent-primary')}
                      />
                      <span>{w.max}×</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Приоритет распределения типов заявок" subtitle="Порядок очереди назначения в алгоритме" aside={<LocalBadge />}>
            <div className="space-y-2">
              {draft.priority.map((kind, i) => {
                const meta = TASK_KIND_META[kind]
                return (
                  <div key={kind} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <span className={cn('flex size-7 items-center justify-center rounded text-title-sm text-white', meta.bg)}>#{i + 1}</span>
                    <div className="flex-1">
                      <span className={cn('rounded px-2 py-0.5 text-label-md', meta.soft, meta.text)}>{meta.label}</span>
                    </div>
                    <span className="text-label-md text-text-muted">{PRIORITY_NOTE[kind]}</span>
                    <div className="flex flex-col">
                      <button type="button" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)} className="text-text-muted hover:text-primary disabled:opacity-30">
                        <Icon name="keyboard_arrow_up" />
                      </button>
                      <button type="button" aria-label="Ниже" disabled={i === draft.priority.length - 1} onClick={() => move(i, 1)} className="text-text-muted hover:text-primary disabled:opacity-30">
                        <Icon name="keyboard_arrow_down" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Системные правила и ограничения" subtitle="Триггеры пересчёта и правила адаптации расписания" aside={<LocalBadge />}>
            <div className="divide-y divide-border">
              {RULES.map((r) => (
                <div key={r.key} className="flex items-center gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-title-sm">
                      {r.title}
                      {r.tag && <Badge className="bg-primary-soft text-primary">{r.tag}</Badge>}
                    </div>
                    <p className="text-label-md text-text-secondary">{r.text}</p>
                  </div>
                  <Toggle on={draft.rules[r.key]} onChange={(v) => set({ rules: { ...draft.rules, [r.key]: v } })} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Регламент экстренных инцидентов" subtitle="Лимит прибытия экипажа на аварию" aside={<LocalBadge />}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-title-sm">Лимит реагирования:</span>
              <div className="relative">
                <input
                  type="number"
                  min={15}
                  step={5}
                  value={draft.slaLimitMin}
                  onChange={(e) => set({ slaLimitMin: Number(e.target.value) })}
                  className="h-9 w-28 rounded-lg border border-border bg-bg-subtle pr-10 pl-3 text-body-md outline-none focus:border-primary"
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-label-md text-text-muted">мин</span>
              </div>
              {[90, 100, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ slaLimitMin: m })}
                  className={cn('rounded-lg border px-3 py-1.5 text-label-md', draft.slaLimitMin === m ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-secondary')}
                >
                  {m} мин{m === 100 ? ' (стандарт)' : ''}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Оценка качества VRP" subtitle={plan ? `ML-план против базового • ${isDemo ? 'демо-данные' : fileName ?? 'текущий план'}` : 'Загрузите план, чтобы увидеть сравнение'}>
            {plan && view ? (
              <>
                <div className="mb-4 flex items-center justify-between rounded-lg bg-bg-subtle p-4">
                  <div>
                    <div className="text-label-sm tracking-wider text-text-muted uppercase">Индекс качества</div>
                    <div className="text-headline-lg">
                      {score} <span className="text-body-md text-text-muted">/ 100</span>
                    </div>
                    <div className="text-label-md text-signal-success">
                      Улучшено {better} из {rows.length} показателей
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 72, height: 72, background: `conic-gradient(var(--color-signal-success) ${score}%, var(--color-border) 0)` }}
                  >
                    <div className="flex items-center justify-center rounded-full bg-bg-surface text-title-sm" style={{ width: 56, height: 56 }}>
                      {score}%
                    </div>
                  </div>
                </div>
                <div className="mb-2 text-label-sm tracking-wider text-text-muted uppercase">Базовый план → ML-план</div>
                <div className="space-y-2">
                  {rows.map((r) => {
                    const good = r.lower ? r.after <= r.before : r.after >= r.before
                    const diff = r.after - r.before
                    return (
                      <div key={r.label} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                          <Icon name={r.icon} size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-title-sm">{r.label}</div>
                          <div className="text-label-md text-text-muted">
                            {fmt(r.before, r.unit)} → <span className={good ? 'text-signal-success' : 'text-signal-danger'}>{fmt(r.after, r.unit)}</span>
                          </div>
                        </div>
                        <Badge className={good ? 'bg-emerald-50 text-status-completed' : 'bg-type-emergency-bg text-signal-danger'}>
                          {diff > 0 ? '+' : diff < 0 ? '−' : ''}
                          {fmt(Math.abs(diff), r.unit)}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-body-sm text-text-muted">Сравнение появится после расчёта плана на странице «Импорт данных».</p>
            )}
            <button
              type="button"
              disabled={!plan || loading}
              onClick={() => {
                saveSettings(draft)
                void recalculate()
              }}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-title-sm text-white hover:bg-primary-hover disabled:opacity-50"
            >
              <Icon name={loading ? 'progress_activity' : 'published_with_changes'} className={cn(loading && 'animate-spin')} />
              {loading ? 'Пересчитываем…' : 'Сохранить и пересчитать план'}
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
