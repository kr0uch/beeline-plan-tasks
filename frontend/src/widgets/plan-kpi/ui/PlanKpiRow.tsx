import type { Metrics } from '@/entities/plan'
import { SHIFT_DURATION_MIN } from '@/shared/config'
import { cn, formatDuration } from '@/shared/lib'
import { Icon } from '@/shared/ui'

type Tone = 'default' | 'danger' | 'success'

type Delta = { text: string; good: boolean } | null

type CardProps = {
  label: string
  icon: string
  iconClass: string
  value: string
  sub?: string
  delta?: Delta
  tone?: Tone
}

function KpiCard({ label, icon, iconClass, value, sub, delta, tone = 'default' }: CardProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-between rounded-lg border bg-bg-surface p-2.5 shadow-sm',
        tone === 'danger' ? 'border-type-emergency/40 bg-type-emergency-bg/30' : 'border-border',
      )}
    >
      <div className={cn('flex items-center justify-between', tone === 'danger' ? 'text-type-emergency' : 'text-text-secondary')}>
        <span className="truncate text-label-sm tracking-wide uppercase">{label}</span>
        <Icon name={icon} size={16} className={iconClass} />
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <span
          className={cn(
            'text-headline-md whitespace-nowrap',
            tone === 'danger' && 'text-type-emergency',
            tone === 'success' && 'text-signal-success',
          )}
        >
          {value}
        </span>
        {sub && <span className="truncate text-label-sm text-text-muted">{sub}</span>}
      </div>
      {delta && (
        <span className={cn('mt-0.5 truncate text-label-sm', delta.good ? 'text-signal-success' : 'text-signal-danger')}>
          {delta.text} vs базовый
        </span>
      )}
    </div>
  )
}

const pct = (rate: number) => Math.round(rate <= 1 ? rate * 100 : rate)

function delta(ml: number, base: number, unit: string, lowerIsBetter: boolean, digits = 0): Delta {
  const diff = ml - base
  if (!base && !ml) return null
  if (Math.abs(diff) < 10 ** -digits / 2) return { text: '= ', good: true }
  const sign = diff > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(diff).toFixed(digits)}${unit}`,
    good: lowerIsBetter ? diff < 0 : diff > 0,
  }
}

export function PlanKpiRow({ ml, baseline }: { ml: Metrics; baseline: Metrics }) {
  const loadPct = Math.round((ml.load_mean / SHIFT_DURATION_MIN) * 100)

  return (
    <section className="grid grid-cols-7 gap-2 border-b border-border bg-bg-app px-4 py-2">
      <KpiCard
        label="Всего заявок"
        icon="assignment"
        iconClass="text-type-connection"
        value={String(ml.total_tasks)}
        sub={`${ml.engineers_used} бригад`}
      />
      <KpiCard
        label="Назначено"
        icon="check_circle"
        iconClass="text-status-completed"
        value={String(ml.assigned)}
        sub={`${pct(ml.assigned_rate)}%`}
        delta={delta(ml.assigned, baseline.assigned, '', false)}
      />
      <KpiCard
        label="Не назначено"
        icon="crisis_alert"
        iconClass={ml.unassigned ? 'text-type-emergency animate-pulse' : 'text-signal-success'}
        value={String(ml.unassigned)}
        tone={ml.unassigned ? 'danger' : 'success'}
        delta={delta(ml.unassigned, baseline.unassigned, '', true)}
      />
      <KpiCard
        label="Опозданий"
        icon="timelapse"
        iconClass="text-signal-warning"
        value={String(ml.late_count)}
        sub={ml.total_late_min ? `${ml.total_late_min} мин` : 'в окнах'}
        tone={ml.late_count ? 'default' : 'success'}
        delta={delta(ml.late_count, baseline.late_count, '', true)}
      />
      <KpiCard
        label="Пробег"
        icon="route"
        iconClass="text-signal-info"
        value={`${ml.total_distance_km.toFixed(1)} км`}
        delta={delta(ml.total_distance_km, baseline.total_distance_km, ' км', true, 1)}
      />
      <KpiCard
        label="Загрузка бригад"
        icon="speed"
        iconClass="text-type-upsell"
        value={`${loadPct}%`}
        sub={`разброс ±${Math.round(ml.load_std)} мин`}
        delta={delta(ml.load_std, baseline.load_std, ' мин разброс', true)}
      />
      <KpiCard
        label="Переработки"
        icon="more_time"
        iconClass="text-signal-success"
        value={formatDuration(ml.overtime_min)}
        tone={ml.overtime_min ? 'default' : 'success'}
        delta={delta(ml.overtime_min, baseline.overtime_min, ' мин', true)}
      />
    </section>
  )
}
