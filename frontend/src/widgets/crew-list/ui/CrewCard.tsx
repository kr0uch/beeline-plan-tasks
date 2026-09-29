import { transportIcon, type Crew, type CrewLoad } from '@/entities/plan'
import { cn, formatDuration, formatPlanTime, plural } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'

const LOAD_META: Record<CrewLoad, { label: string; badge: string; bar: string; text: string }> = {
  overload: { label: 'Перегрузка', badge: 'bg-type-emergency-bg text-type-emergency', bar: 'bg-signal-danger', text: 'text-signal-danger' },
  high: { label: 'Высокая', badge: 'bg-amber-100 text-signal-warning', bar: 'bg-signal-warning', text: 'text-signal-warning' },
  normal: { label: 'Норма', badge: 'bg-type-connection-bg text-type-connection', bar: 'bg-signal-success', text: 'text-signal-success' },
  idle: { label: 'Свободна', badge: 'border border-border bg-bg-subtle text-text-secondary', bar: 'bg-text-muted', text: 'text-text-secondary' },
}

type Props = {
  crew: Crew
  selected: boolean
  onSelect: () => void
}

export function CrewCard({ crew, selected, onSelect }: Props) {
  const meta = LOAD_META[crew.load]
  const first = crew.stops[0]?.assignment
  const last = crew.stops.at(-1)?.assignment

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'block w-full border-l-[3px] p-2.5 text-left transition-colors',
        selected ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-bg-subtle',
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: crew.color }} />
          <span className={cn('truncate text-title-sm', selected && 'text-type-connection')}>{crew.name}</span>
          <Icon name={transportIcon(crew.transport)} size={14} className="text-text-muted" />
          <span className="truncate text-label-sm text-text-muted">{crew.transport}</span>
        </div>
        <Badge className={meta.badge}>{meta.label}</Badge>
      </div>

      <div className="mb-1.5 flex items-center justify-between text-label-sm text-text-secondary">
        <span className="truncate">
          {crew.distanceKm.toFixed(1)} км · {formatDuration(crew.timeMin)}
        </span>
        <span className="font-medium text-text-primary">
          {crew.stops.length} {plural(crew.stops.length, 'заявка', 'заявки', 'заявок')}
        </span>
      </div>

      <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className={cn('h-1.5 rounded-full', meta.bar)} style={{ width: `${Math.min(crew.loadPct, 100)}%` }} />
      </div>

      <div className="flex items-center justify-between text-label-sm">
        {crew.lateCount ? (
          <span className="flex items-center gap-1 truncate font-medium text-signal-warning">
            <Icon name="schedule" size={14} />
            Опозданий: {crew.lateCount} ({crew.lateMin} мин)
          </span>
        ) : (
          <span className="truncate text-text-muted">
            {first && last ? `${formatPlanTime(first.start_min)} – ${formatPlanTime(last.end_min)}` : 'Без заявок'}
          </span>
        )}
        <span className={cn('text-metric', meta.text)}>Загрузка {crew.loadPct}%</span>
      </div>
    </button>
  )
}
