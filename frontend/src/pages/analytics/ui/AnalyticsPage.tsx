import { useMemo, type ReactNode } from 'react'
import { buildOrders, transportIcon, type Crew } from '@/entities/plan'
import { getTaskKind, TASK_KIND_META, type TaskKind } from '@/entities/task'
import { downloadOrdersCsv } from '@/features/export-orders'
import { PlanUploadForm, usePlan } from '@/features/load-plan'
import { REGIONS, SHIFT_DURATION_MIN } from '@/shared/config'
import { cn, formatDuration, plural, toDayMin, useNow } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'

const KINDS = Object.keys(TASK_KIND_META) as TaskKind[]

function Card({ title, subtitle, aside, children, className }: { title: string; subtitle?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-border bg-bg-surface p-4 shadow-sm', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-headline-sm">{title}</h2>
          {subtitle && <p className="text-label-md text-text-muted">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Kpi({ caption, title, icon, value, delta, good, note }: { caption: string; title: string; icon: string; value: string; delta: string; good: boolean; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-label-sm tracking-wider text-text-muted uppercase">{caption}</div>
          <div className="text-title-sm">{title}</div>
        </div>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon name={icon} />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-headline-lg">{value}</span>
        <Badge className={good ? 'bg-emerald-50 text-status-completed' : 'bg-amber-50 text-signal-warning'}>{delta}</Badge>
      </div>
      <p className="mt-1 text-label-md text-text-muted">{note}</p>
    </div>
  )
}

type HourPoint = { h: number; total: number; emergency: number; sla: number | null }

function HourChart({ data, max }: { data: HourPoint[]; max: number }) {
  const W = 640
  const H = 240
  const pad = { l: 28, r: 36, t: 12, b: 26 }
  const plotW = W - pad.l - pad.r
  const plotH = H - pad.t - pad.b
  const slot = plotW / data.length
  const barW = Math.min(26, slot * 0.55)
  const top = Math.max(2, Math.ceil(max / 2) * 2)
  const y = (v: number) => pad.t + plotH - (v / top) * plotH
  const slaY = (p: number) => pad.t + plotH - ((p - 50) / 50) * plotH
  const cx = (i: number) => pad.l + slot * i + slot / 2
  const sla = data.map((d, i) => (d.sla === null ? null : { x: cx(i), y: slaY(Math.max(50, d.sla)), v: d.sla })).filter((p) => p !== null)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Заявки и SLA по часам">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const yy = pad.t + plotH - f * plotH
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="var(--color-border)" strokeDasharray={f ? '3 4' : undefined} />
            <text x={pad.l - 6} y={yy + 3} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
              {Math.round(f * top)}
            </text>
            <text x={W - pad.r + 6} y={yy + 3} fontSize="10" fill="var(--color-signal-success)">
              {50 + f * 50}%
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const x = cx(i) - barW / 2
        const normal = d.total - d.emergency
        return (
          <g key={d.h}>
            <title>{`${String(d.h).padStart(2, '0')}:00 — ${d.total} заявок${d.emergency ? `, аварий: ${d.emergency}` : ''}${d.sla !== null ? `, SLA ${Math.round(d.sla)}%` : ''}`}</title>
            {normal > 0 && <rect x={x} y={y(d.total)} width={barW} height={y(0) - y(d.total)} rx="4" fill="var(--color-type-connection)" opacity="0.9" />}
            {d.emergency > 0 && <rect x={x} y={y(d.total)} width={barW} height={y(d.total - d.emergency) - y(d.total)} rx="4" fill="var(--color-type-emergency)" />}
            <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">
              {String(d.h).padStart(2, '0')}:00
            </text>
          </g>
        )
      })}
      <polyline
        points={sla.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="var(--color-signal-success)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {sla.map((p) => (
        <circle key={p.x} cx={p.x} cy={p.y} r="3.5" fill="var(--color-bg-surface)" stroke={p.v < 100 ? 'var(--color-signal-warning)' : 'var(--color-signal-success)'} strokeWidth="2" />
      ))}
    </svg>
  )
}

function crewSplit(c: Crew) {
  const work = c.serviceMin ?? c.stops.reduce((s, x) => s + x.task.service_time, 0)
  const wait = c.stops.reduce((s, x) => s + (x.assignment ? Math.max(0, x.assignment.start_min - x.assignment.arrival_min) : 0), 0)
  const travel = c.travelMin ?? Math.max(0, c.timeMin - work - wait)
  return { work, travel, wait }
}

export function AnalyticsPage() {
  const { plan, view, region, updatedAt, history } = usePlan()
  const now = useNow()
  const orders = useMemo(() => (view ? buildOrders(view, now) : []), [view, now])

  if (!plan || !view) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <PlanUploadForm />
      </div>
    )
  }

  const ml = plan.ml_metrics
  const base = plan.baseline_metrics
  const stops = view.crews.flatMap((c) => c.stops.filter((s) => s.assignment).map((s) => ({ ...s, a: s.assignment! })))
  const onTime = stops.filter((s) => s.a.late_min === 0).length
  const slaPct = stops.length ? Math.round((onTime / stops.length) * 1000) / 10 : 0
  const avgLoad = Math.round(view.crews.reduce((s, c) => s + c.loadPct, 0) / Math.max(1, view.crews.length))
  const overloaded = view.crews.filter((c) => c.loadPct > 90).length
  const totals = view.crews.map(crewSplit).reduce((a, b) => ({ work: a.work + b.work, travel: a.travel + b.travel, wait: a.wait + b.wait }), { work: 0, travel: 0, wait: 0 })
  const travelShare = Math.round((totals.travel / Math.max(1, totals.travel + totals.work)) * 100)
  const rate = (v: number) => Math.round((v <= 1 ? v * 100 : v) * 10) / 10
  const rateDelta = Math.round((rate(ml.assigned_rate) - rate(base.assigned_rate)) * 10) / 10

  const hours = Array.from({ length: 13 }, (_, i) => 8 + i)
  const byHour = hours.map((h) => {
    const inHour = stops.filter((s) => Math.floor(toDayMin(s.a.start_min) / 60) === h)
    const emergency = inHour.filter((s) => getTaskKind(s.task) === 'emergency').length
    const late = inHour.filter((s) => s.a.late_min > 0).length
    return { h, total: inHour.length, emergency, sla: inHour.length ? ((inHour.length - late) / inHour.length) * 100 : null }
  })
  const maxHour = Math.max(1, ...byHour.map((b) => b.total))
  const peak = byHour.reduce((a, b) => (b.total > a.total ? b : a), byHour[0])

  const kinds = KINDS.map((k) => {
    const list = stops.filter((s) => getTaskKind(s.task) === k)
    return {
      kind: k,
      count: list.length,
      avg: list.length ? Math.round(list.reduce((s, x) => s + x.task.service_time, 0) / list.length) : 0,
      onTime: list.length ? Math.round((list.filter((x) => x.a.late_min === 0).length / list.length) * 100) : 0,
      margin: list.length ? Math.round(list.reduce((s, x) => s + (x.a.tw_end - x.a.start_min), 0) / list.length) : 0,
    }
  }).filter((k) => k.count)
  const donut = kinds
    .map((k, i) => {
      const share = (x: typeof k) => (x.count / Math.max(1, stops.length)) * 100
      const from = kinds.slice(0, i).reduce((s, x) => s + share(x), 0)
      return `${TASK_KIND_META[k.kind].color} ${from}% ${from + share(k)}%`
    })
    .join(', ')

  const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-headline-lg">Операционная аналитика и качество VRP</h1>
          <p className="text-body-sm text-text-muted">Разбор текущего плана смены • регион {regionLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => downloadOrdersCsv(orders, `report-${new Date().toISOString().slice(0, 10)}.csv`)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 text-title-sm hover:bg-bg-subtle"
        >
          <Icon name="download" />
          Экспорт отчёта (CSV)
        </button>
        {updatedAt && (
          <span className="flex items-center gap-1.5 text-label-md text-text-muted">
            <span className="size-2 rounded-full bg-signal-success" />
            Обновлено в {updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Kpi
          caption="Регламент SLA"
          title="Прибытие в окно клиента"
          icon="emergency"
          value={`${slaPct}%`}
          delta={`${ml.late_count - base.late_count <= 0 ? '−' : '+'}${Math.abs(ml.late_count - base.late_count)} опозд.`}
          good={ml.late_count <= base.late_count}
          note={`${onTime} из ${stops.length} заявок в окне, опозданий суммарно ${ml.total_late_min} мин`}
        />
        <Kpi
          caption="Эффективность смены"
          title="Средняя утилизация экипажей"
          icon="speed"
          value={`${avgLoad}%`}
          delta={`σ ${Math.round(ml.load_std)} мин`}
          good={ml.load_std <= base.load_std}
          note={`${overloaded} ${plural(overloaded, 'бригада', 'бригады', 'бригад')} с загрузкой выше 90%`}
        />
        <Kpi
          caption="Логистическое плечо"
          title="В пути / на объекте"
          icon="local_shipping"
          value={`${travelShare}% / ${100 - travelShare}%`}
          delta={`${(ml.total_distance_km - base.total_distance_km).toFixed(1)} км`}
          good={ml.total_distance_km <= base.total_distance_km}
          note={`${formatDuration(totals.travel)} дороги против ${formatDuration(totals.work)} работы`}
        />
        <Kpi
          caption="Качество VRP"
          title="Доля назначенных заявок"
          icon="psychology"
          value={`${rate(ml.assigned_rate)}%`}
          delta={`${rateDelta >= 0 ? '+' : ''}${rateDelta} п.п.`}
          good={rateDelta >= 0}
          note={`Базовый план: ${rate(base.assigned_rate)}%, ${base.unassigned} без бригады`}
        />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' }}>
        <Card
          title="Соблюдение SLA и нагрузка по часам дня"
          subtitle="Начало работ по часам и доля заявок в окне клиента"
          aside={
            <div className="space-y-1 text-label-sm text-text-secondary">
              <div className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-type-connection" />Наряды</div>
              <div className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-type-emergency" />Аварии</div>
              <div className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-signal-success" />SLA, %</div>
            </div>
          }
        >
          <HourChart data={byHour} max={maxHour} />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-bg-subtle p-3 text-body-sm">
            <Icon name="check_circle" className="text-signal-success" />
            Пиковая нагрузка: {String(peak.h).padStart(2, '0')}:00–{String(peak.h + 1).padStart(2, '0')}:00 ({peak.total}{' '}
            {plural(peak.total, 'заявка', 'заявки', 'заявок')}). В окно клиента попадают {onTime} из {stops.length}.
          </div>
        </Card>

        <Card title="Структура нарядов по типам работ" subtitle={`${stops.length} назначенных заявок в плане`} aside={<Badge className="bg-bg-subtle text-text-secondary border border-border">Σ {stops.length}</Badge>}>
          <div className="mb-4 flex items-center gap-6">
            <div className="flex shrink-0 items-center justify-center rounded-full" style={{ width: 132, height: 132, background: `conic-gradient(${donut})` }}>
              <div className="flex flex-col items-center justify-center rounded-full bg-bg-surface" style={{ width: 88, height: 88 }}>
                <span className="text-headline-md">{stops.length}</span>
                <span className="text-[10px] text-text-muted uppercase">заявок</span>
              </div>
            </div>
            <div className="space-y-1.5 text-body-sm">
              {kinds.map((k) => (
                <div key={k.kind} className="flex items-center gap-2">
                  <span className={cn('size-2.5 rounded-full', TASK_KIND_META[k.kind].bg)} />
                  {TASK_KIND_META[k.kind].label}
                </div>
              ))}
            </div>
          </div>
          <table className="w-full text-left text-body-sm">
            <thead className="text-label-sm text-text-muted uppercase">
              <tr>
                <th className="py-1">Тип</th>
                <th className="py-1 text-right">Кол-во</th>
                <th className="py-1 text-right">Доля</th>
                <th className="py-1 text-right">Ср. длит.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kinds.map((k) => (
                <tr key={k.kind}>
                  <td className="py-2">
                    <Badge className={cn(TASK_KIND_META[k.kind].soft, TASK_KIND_META[k.kind].text)}>{TASK_KIND_META[k.kind].label}</Badge>
                  </td>
                  <td className="py-2 text-right">{k.count}</td>
                  <td className="py-2 text-right">{Math.round((k.count / stops.length) * 100)}%</td>
                  <td className="py-2 text-right">{formatDuration(k.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Card
          title={`Распределение дневной нагрузки по ${view.crews.length} ${plural(view.crews.length, 'бригаде', 'бригадам', 'бригадам')}`}
          subtitle="Работа, дорога и ожидание окна относительно смены"
          aside={<Badge className="bg-bg-subtle text-text-secondary border border-border">σ {Math.round(ml.load_std)} мин</Badge>}
        >
          <div className="mb-2 flex gap-3 text-label-sm text-text-secondary">
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary" />Работа</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: '#93C5FD' }} />В пути</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: '#FCD34D' }} />Ожидание</span>
          </div>
          <div className="space-y-3">
            {view.crews.map((c) => {
              const s = crewSplit(c)
              const scale = Math.max(SHIFT_DURATION_MIN, c.timeMin)
              const hot = c.loadPct > 90
              return (
                <div key={c.id} className="flex items-center gap-3 text-body-sm">
                  <span className={cn('flex w-36 shrink-0 items-center gap-1.5 truncate', hot && 'font-semibold text-signal-warning')}>
                    <Icon name={transportIcon(c.transport)} size={14} className="text-text-muted" />
                    {c.name}
                  </span>
                  <div className="flex flex-1 gap-0.5 overflow-hidden rounded-full bg-bg-subtle" style={{ height: 10 }}>
                    <div className="rounded-full bg-primary" style={{ width: `${(s.work / scale) * 100}%` }} />
                    <div className="rounded-full" style={{ width: `${(s.travel / scale) * 100}%`, background: '#93C5FD' }} />
                    <div className="rounded-full" style={{ width: `${(s.wait / scale) * 100}%`, background: '#FCD34D' }} />
                  </div>
                  <span className={cn('w-12 text-right', hot ? 'text-signal-warning' : 'text-text-secondary')}>{c.loadPct}%</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card title="Точность плана по временным окнам" subtitle="Запас до закрытия окна клиента и доля заявок в окне" aside={<Badge className="bg-emerald-50 text-status-completed">SLA {slaPct}%</Badge>}>
          <div className="space-y-2.5">
            {kinds.map((k) => (
              <div key={k.kind} className="rounded-lg border border-border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-title-sm">{TASK_KIND_META[k.kind].label}</span>
                  <Badge className={k.onTime >= 90 ? 'bg-emerald-50 text-status-completed' : 'bg-amber-50 text-signal-warning'}>В окне {k.onTime}%</Badge>
                </div>
                <div className="mb-2 grid grid-cols-3 text-label-sm text-text-muted">
                  <span>Заявок: <strong className="text-text-primary">{k.count}</strong></span>
                  <span>Длительность: <strong className="text-primary">{formatDuration(k.avg)}</strong></span>
                  <span>Средний запас: <strong className={k.margin < 0 ? 'text-signal-danger' : 'text-text-primary'}>{k.margin} мин</strong></span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div className={cn('h-full', k.onTime >= 90 ? 'bg-signal-success' : 'bg-signal-warning')} style={{ width: `${k.onTime}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Журнал пересчётов плана" subtitle="Расчёты маршрутов за текущую сессию" aside={<span className="text-label-md text-text-muted">Всего пересчётов: {history.length}</span>}>
        <table className="w-full text-left text-body-sm">
          <thead className="bg-bg-subtle text-label-sm tracking-wider text-text-muted uppercase">
            <tr>
              <th className="px-3 py-2">Время</th>
              <th className="px-3 py-2">Источник</th>
              <th className="px-3 py-2">Регион</th>
              <th className="px-3 py-2">Результат расчёта</th>
              <th className="px-3 py-2">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((run, i) => (
              <tr key={run.at.getTime()}>
                <td className="px-3 py-3 text-text-secondary">{run.at.toLocaleTimeString('ru-RU')}</td>
                <td className="px-3 py-3">
                  <Badge className={run.isDemo ? 'bg-type-upsell-bg text-type-upsell' : 'bg-primary-soft text-primary'}>{run.isDemo ? 'Демо-данные' : 'CSV'}</Badge>{' '}
                  <span className="text-text-secondary">{run.fileName}</span>
                </td>
                <td className="px-3 py-3">{REGIONS.find((r) => r.value === run.region)?.label ?? run.region}</td>
                <td className="px-3 py-3">
                  Назначено {run.assigned} из {run.total}, опозданий {run.lateCount}, пробег {run.distanceKm.toFixed(1)} км
                </td>
                <td className="px-3 py-3">
                  <Badge className={i === 0 ? 'bg-emerald-50 text-status-completed' : 'bg-bg-subtle text-text-muted'}>{i === 0 ? '● Текущий план' : 'Заменён'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
