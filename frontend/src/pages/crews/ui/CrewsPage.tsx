import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { crewShortName, fetchEngineers, transportIcon, type Crew, type Engineer, type PlanView } from '@/entities/plan'
import { getTaskKind, requirementLabel, TASK_KIND_META, type TaskKind } from '@/entities/task'
import { PlanUploadForm, usePlan } from '@/features/load-plan'
import { cn, formatClock, formatDuration, formatPlanTime, plural, toDayMin, useNow } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'

type Mode = 'all' | 'car' | 'walk'
type Level = 'required' | 'preferred' | 'none'

const isWalk = (c: Crew) => transportIcon(c.transport) === 'directions_walk'

function crewSkills(c: Crew, e?: Engineer): string[] {
  if (e?.skills?.length) return e.skills
  return [...new Set(c.stops.flatMap((s) => s.task.required_skills))]
}

function crewEquipment(c: Crew, e?: Engineer): string[] {
  if (e?.equipment?.length) return e.equipment
  return [...new Set(c.stops.flatMap((s) => s.task.required_equipment))]
}

function crewState(c: Crew, now: number) {
  const current = c.stops.find((s) => s.assignment && toDayMin(s.assignment.end_min) > now)
  if (!current?.assignment) return { label: 'Свободна', tone: 'bg-emerald-50 text-status-completed', bar: 'border-t-signal-success', stop: null, free: true }
  const started = toDayMin(current.assignment.start_min) <= now
  if (getTaskKind(current.task) === 'emergency' && !started)
    return { label: 'В пути к аварии', tone: 'bg-cyan-50 text-status-en-route', bar: 'border-t-signal-info', stop: current, free: false }
  if (c.load === 'overload') return { label: 'Перегрузка', tone: 'bg-type-emergency-bg text-signal-danger', bar: 'border-t-signal-danger', stop: current, free: false }
  return started
    ? { label: 'В работе на объекте', tone: 'bg-amber-50 text-status-in-progress', bar: 'border-t-status-in-progress', stop: current, free: false }
    : { label: 'В пути', tone: 'bg-cyan-50 text-status-en-route', bar: 'border-t-signal-info', stop: current, free: false }
}

function buildMatrix(view: PlanView) {
  const tasks = view.crews.flatMap((c) => c.stops.map((s) => s.task))
  const items: string[] = [...new Set(tasks.flatMap((t) => [...t.required_equipment, ...t.required_skills]))].slice(0, 10)
  const kinds = (Object.keys(TASK_KIND_META) as TaskKind[]).filter((k) => tasks.some((t) => getTaskKind(t) === k))
  const rows = kinds.map((kind) => {
    const group = tasks.filter((t) => getTaskKind(t) === kind)
    const cells = items.map((item): Level => {
      const n = group.filter((t) => (t.required_equipment as string[]).includes(item) || (t.required_skills as string[]).includes(item)).length
      return n === group.length ? 'required' : n > 0 ? 'preferred' : 'none'
    })
    return { kind, count: group.length, cells }
  })
  return { items, rows }
}

const LEVEL: Record<Level, { label: string; className: string }> = {
  required: { label: 'Обязательно', className: 'bg-type-emergency-bg text-signal-danger' },
  preferred: { label: 'Желательно', className: 'bg-bg-subtle text-text-secondary border border-border' },
  none: { label: 'Не требуется', className: 'text-text-muted' },
}

function CrewCard({ crew, engineer, now, onOpen }: { crew: Crew; engineer?: Engineer; now: number; onOpen: () => void }) {
  const state = crewState(crew, now)
  const done = crew.stops.filter((s) => s.assignment && toDayMin(s.assignment.end_min) <= now).length
  const skills = crewSkills(crew, engineer)
  const equipment = crewEquipment(crew, engineer)
  return (
    <div className={cn('flex flex-col rounded-lg border border-t-4 border-border bg-bg-surface p-4 shadow-sm', state.bar)}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg text-title-md text-white" style={{ background: crew.color }}>
          {crewShortName(crew.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate text-title-md">{engineer?.name || crew.name}</span>
            <Badge className={state.tone}>{state.label}</Badge>
          </div>
          <div className="truncate text-label-md text-text-muted">{skills.map(requirementLabel).join(' • ') || 'Универсальный монтаж'}</div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-body-sm text-text-secondary">
        <Icon name={transportIcon(crew.transport)} size={16} />
        <span className="font-medium text-text-primary">{crew.transport}</span>
        <span className="ml-auto text-label-md text-text-muted">
          {crew.distanceKm.toFixed(1)} км • {formatDuration(crew.timeMin)}
        </span>
      </div>

      {engineer && (
        <div className="mb-3 space-y-1 rounded-lg bg-bg-subtle p-2 text-label-md text-text-secondary">
          <div className="flex items-center gap-1.5">
            <Icon name="schedule" size={14} />
            Смена {formatClock(engineer.shift_start)} – {formatClock(engineer.shift_end)}
          </div>
          {engineer.depot_address && (
            <div className="flex items-center gap-1.5">
              <Icon name="warehouse" size={14} />
              <span className="truncate">{engineer.depot_address}</span>
            </div>
          )}
        </div>
      )}

      <div className="mb-3">
        <div className="mb-1 text-label-sm font-semibold tracking-wider text-text-muted uppercase">Оборудование на борту</div>
        <div className="flex flex-wrap gap-1">
          {equipment.length ? (
            equipment.map((e) => (
              <span key={e} className="flex items-center gap-0.5 rounded bg-primary-soft px-1.5 py-0.5 text-label-sm text-primary">
                <Icon name="check" size={12} />
                {requirementLabel(e)}
              </span>
            ))
          ) : (
            <span className="text-label-sm text-text-muted">Базовый набор</span>
          )}
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-1 flex justify-between text-label-md">
          <span>
            Загрузка смены:{' '}
            <strong className={crew.loadPct > 100 ? 'text-signal-danger' : crew.loadPct >= 85 ? 'text-signal-warning' : 'text-signal-success'}>{crew.loadPct}%</strong>
          </span>
          <span className="text-text-muted">
            {crew.stops.length} {plural(crew.stops.length, 'заявка', 'заявки', 'заявок')} ({done}/{crew.stops.length})
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className={cn('h-full rounded-full', crew.loadPct > 100 ? 'bg-signal-danger' : crew.loadPct >= 85 ? 'bg-signal-warning' : 'bg-signal-success')}
            style={{ width: `${Math.min(100, crew.loadPct)}%` }}
          />
        </div>
        <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 rounded-lg bg-bg-subtle p-2 text-left text-body-sm hover:bg-surface-high">
          <Icon name={state.stop ? 'location_on' : 'hourglass_empty'} size={16} className={state.stop ? 'text-signal-danger' : 'text-signal-success'} />
          <span className="min-w-0 flex-1 truncate">{state.stop ? state.stop.task.address : 'Все заявки смены выполнены'}</span>
          {state.stop?.assignment && <Badge className="bg-type-emergency-bg text-signal-danger">до {formatPlanTime(state.stop.assignment.end_min)}</Badge>}
          {state.free && <Badge className="bg-emerald-50 text-status-completed">Свободна</Badge>}
        </button>
      </div>
    </div>
  )
}

export function CrewsPage() {
  const { plan, view, region, isDemo } = usePlan()
  const [engineers, setEngineers] = useState<Map<string, Engineer>>(new Map())
  useEffect(() => {
    if (!plan || isDemo) return
    const controller = new AbortController()
    fetchEngineers(region, controller.signal)
      .then((list) => setEngineers(new Map(list.map((e) => [e.id, e]))))
      .catch(() => undefined)
    return () => controller.abort()
  }, [plan, isDemo, region])
  const eng = (id: string) => (isDemo ? undefined : engineers.get(id))
  const navigate = useNavigate()
  const now = useNow()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<Mode>('all')
  const [skill, setSkill] = useState<string | null>(null)
  const matrix = useMemo(() => (view ? buildMatrix(view) : null), [view])

  if (!plan || !view || !matrix) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <PlanUploadForm />
      </div>
    )
  }

  const walk = view.crews.filter(isWalk).length
  const states = view.crews.map((c) => crewState(c, now))
  const allSkills = [...new Set(view.crews.flatMap((c) => crewSkills(c, eng(c.id))))]
  const q = query.trim().toLowerCase()
  const crews = view.crews.filter(
    (c) =>
      (mode === 'all' || (mode === 'walk') === isWalk(c)) &&
      (!skill || crewSkills(c, eng(c.id)).includes(skill)) &&
      (!q || `${c.name} ${c.transport}`.toLowerCase().includes(q)),
  )
  const avgLoad = Math.round(view.crews.reduce((s, c) => s + c.loadPct, 0) / view.crews.length)
  const ml = plan.ml_metrics
  const coverage = Math.round((ml.assigned_rate <= 1 ? ml.assigned_rate * 100 : ml.assigned_rate) * 10) / 10

  return (
    <div className="flex flex-col gap-5 p-4">
      <section className="rounded-lg border border-border bg-bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-headline-lg">Инженерные бригады</h1>
          <Badge className="bg-emerald-50 text-status-completed">● Флот развёрнут</Badge>
        </div>
        <p className="mt-1 text-body-md text-text-secondary">
          {view.crews.length} {plural(view.crews.length, 'активная бригада', 'активные бригады', 'активных бригад')} • {view.crews.length - walk} на авто, {walk}{' '}
          {plural(walk, 'пешая', 'пешие', 'пеших')}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Icon name="search" className="absolute top-1/2 left-2.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени, транспорту…"
              className="h-8 w-full rounded-lg border border-border bg-bg-subtle pr-3 pl-8 text-body-sm outline-none focus:border-primary"
            />
          </div>
          {(
            [
              ['all', `Все (${view.crews.length})`],
              ['car', `Автомобиль (${view.crews.length - walk})`],
              ['walk', `Пешие (${walk})`],
            ] as Array<[Mode, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn('rounded-full px-3 py-1 text-label-md', mode === id ? 'bg-primary-soft font-semibold text-primary' : 'text-text-secondary hover:bg-bg-subtle')}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-4 text-label-md text-text-secondary">
            {[
              ['bg-signal-info', 'В пути', states.filter((s) => s.label.startsWith('В пути')).length],
              ['bg-status-in-progress', 'На объекте', states.filter((s) => s.label.startsWith('В работе')).length],
              ['bg-signal-success', 'Свободны', states.filter((s) => s.free).length],
            ].map(([dot, label, n]) => (
              <span key={label as string} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', dot as string)} />
                {label}: <strong className="text-text-primary">{n}</strong>
              </span>
            ))}
          </div>
        </div>
        {allSkills.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-label-sm">
            <span className="tracking-wider text-text-muted uppercase">Навыки:</span>
            {allSkills.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSkill(skill === s ? null : s)}
                className={cn('rounded px-2 py-0.5', skill === s ? 'bg-primary text-white' : 'bg-primary-soft text-primary hover:bg-surface-high')}
              >
                {requirementLabel(s)}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-4">
        {crews.map((crew) => (
          <CrewCard key={crew.id} crew={crew} engineer={eng(crew.id)} now={now} onOpen={() => navigate(`/planning?task=${crew.stops[0]?.task.id ?? ''}`)} />
        ))}
        <div className="flex flex-col rounded-lg border border-border bg-bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-label-sm tracking-wider text-text-muted uppercase">
            Готовность парка
            <Badge className="bg-primary-soft text-primary normal-case">По текущему плану</Badge>
          </div>
          <div className="mt-2 text-headline-sm">Эффективность распределения</div>
          <p className="text-body-sm text-text-secondary">Доля заявок, назначенных бригадам с подходящими навыками и оборудованием: {coverage}%.</p>
          <div className="my-4 flex justify-center">
            <div
              className="flex size-36 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(var(--color-primary) ${Math.min(100, avgLoad)}%, var(--color-border) 0)` }}
            >
              <div className="flex size-28 flex-col items-center justify-center rounded-full bg-bg-surface">
                <span className="text-headline-lg">{avgLoad}%</span>
                <span className="text-label-sm text-text-muted">Общая загрузка</span>
              </div>
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 border-t border-border pt-3">
            <div>
              <div className="text-label-sm text-text-muted">Назначено заявок</div>
              <div className="text-headline-md">{ml.assigned} шт</div>
            </div>
            <div>
              <div className="text-label-sm text-text-muted">Опозданий</div>
              <div className={cn('text-headline-md', ml.late_count ? 'text-signal-warning' : 'text-signal-success')}>{ml.late_count}</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-headline-md">Матрица совместимости: тип работ → оборудование и квалификация</h2>
          <Badge className="bg-primary-soft text-primary">Из заявок плана</Badge>
        </div>
        <p className="mb-3 text-body-sm text-text-muted">Требования, которые алгоритм учитывает при подборе бригад</p>
        <div className="mb-3 flex gap-3 rounded-lg border border-primary/20 bg-primary-soft/60 p-3 text-body-sm">
          <Icon name="verified_user" className="text-primary" />
          <div>
            <div className="text-title-sm text-primary">Алгоритмический фильтр назначения заявок</div>
            Заявка не назначается бригаде, если у неё нет хотя бы одного обязательного навыка или оборудования из матрицы.
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-bg-surface shadow-sm">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-bg-subtle text-label-md text-text-secondary">
              <tr>
                <th className="px-4 py-3">Тип производимых работ</th>
                {matrix.items.map((item) => (
                  <th key={item} className="px-3 py-3 text-center">
                    {requirementLabel(item)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {matrix.rows.map((row) => (
                <tr key={row.kind}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-title-sm">
                      <span className={cn('size-2 rounded-full', TASK_KIND_META[row.kind].bg)} />
                      {TASK_KIND_META[row.kind].label}
                    </div>
                    <div className="pl-4 text-label-sm text-text-muted">
                      {row.count} {plural(row.count, 'заявка', 'заявки', 'заявок')} в плане
                    </div>
                  </td>
                  {row.cells.map((level, i) => (
                    <td key={matrix.items[i]} className="px-3 py-3 text-center">
                      <span className={cn('rounded px-2 py-0.5 text-label-sm', LEVEL[level].className)}>{LEVEL[level].label}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
