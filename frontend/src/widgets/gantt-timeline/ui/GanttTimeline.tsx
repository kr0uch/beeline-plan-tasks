import type { PlanView } from '@/entities/plan'
import { getTaskKind, TASK_KIND_META, type TaskKind } from '@/entities/task'
import { cn, formatClock, formatDuration, toDayMin, useNow } from '@/shared/lib'
import { Icon } from '@/shared/ui'

type Props = {
  view: PlanView
  selectedCrewId: string | null
  selectedTaskId: number | null
  onSelectCrew: (crewId: string) => void
  onSelectTask: (taskId: number) => void
}

const LANE_H = 28

function hourRange(view: PlanView): [number, number] {
  let from = 8 * 60
  let to = 20 * 60
  for (const a of view.assignments.values()) {
    from = Math.min(from, toDayMin(a.arrival_min))
    to = Math.max(to, toDayMin(a.end_min))
  }
  return [Math.floor(from / 60), Math.ceil(to / 60)]
}

export function GanttTimeline({ view, selectedCrewId, selectedTaskId, onSelectCrew, onSelectTask }: Props) {
  const now = useNow()
  const [fromH, toH] = hourRange(view)
  const hours = Array.from({ length: toH - fromH }, (_, i) => fromH + i)
  const span = (toH - fromH) * 60
  const pos = (dayMin: number) => ((dayMin - fromH * 60) / span) * 100
  const nowVisible = now >= fromH * 60 && now <= toH * 60

  return (
    <section className="relative z-10 flex h-[220px] shrink-0 flex-col bg-bg-surface select-none">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-bg-subtle px-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-title-sm">
            <Icon name="view_timeline" size={16} className="text-type-connection" />
            График выполнения (Гант) · {formatClock(fromH * 60)} – {formatClock(toH * 60)}
          </span>
          <div className="flex items-center gap-2 text-label-sm text-text-muted">
            {(Object.keys(TASK_KIND_META) as TaskKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className={cn('size-2 rounded', TASK_KIND_META[k].bg)} />
                {TASK_KIND_META[k].label}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="h-1 w-3 rounded bg-neutral-300" />В пути
            </span>
          </div>
        </div>
        <span className="flex items-center gap-2 text-metric font-bold text-type-connection">
          Текущее время: {formatClock(now)}
          <span className="size-2 animate-ping rounded-full bg-signal-success" />
        </span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div className="sticky left-0 z-20 w-[140px] shrink-0 border-r border-border bg-bg-surface text-label-sm">
          <div className="sticky top-0 flex h-7 items-center border-b border-border bg-bg-subtle px-3 text-[10px] text-text-muted uppercase">
            Бригада
          </div>
          {view.crews.map((crew) => (
            <button
              key={crew.id}
              type="button"
              onClick={() => onSelectCrew(crew.id)}
              style={{ height: LANE_H }}
              className={cn(
                'flex w-full items-center justify-between border-b border-border px-3 text-left',
                crew.id === selectedCrewId ? 'bg-primary-soft font-bold text-type-connection' : 'hover:bg-bg-subtle',
              )}
            >
              <span className="truncate">{crew.name}</span>
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  crew.load === 'overload' ? 'bg-signal-danger' : crew.lateCount ? 'bg-signal-warning' : 'bg-signal-success',
                )}
              />
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div
            className="sticky top-0 z-10 grid h-7 border-b border-border bg-bg-subtle text-center text-[11px] text-text-muted"
            style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
          >
            {hours.map((h) => (
              <div key={h} className="border-r border-border/40 py-1">
                {formatClock(h * 60)}
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 top-7 bottom-0 grid"
            style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
          >
            {hours.map((h) => (
              <div key={h} className="h-full border-r border-border/30" />
            ))}
          </div>

          {nowVisible && (
            <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-[1.5px] bg-type-connection" style={{ left: `${pos(now)}%` }}>
              <div className="absolute top-0.5 -translate-x-1/2 rounded bg-type-connection px-1 text-[9px] font-bold text-white">
                {formatClock(now)}
              </div>
            </div>
          )}

          {view.crews.map((crew) => (
            <div
              key={crew.id}
              style={{ height: LANE_H }}
              className={cn('relative border-b border-border', crew.id === selectedCrewId && 'bg-primary-soft/40')}
            >
              {crew.stops.map(({ task, assignment }, i) => {
                if (!assignment) return null
                const kind = TASK_KIND_META[getTaskKind(task)]
                const start = toDayMin(assignment.start_min)
                const end = toDayMin(assignment.end_min)
                const arrival = toDayMin(assignment.arrival_min)
                const prev = crew.stops[i - 1]?.assignment
                const prevEnd = prev ? toDayMin(prev.end_min) : null
                const late = assignment.late_min > 0
                const selected = task.id === selectedTaskId

                return (
                  <div key={task.id}>
                    {prevEnd !== null && arrival > prevEnd && (
                      <div
                        title={`В пути ${formatDuration(arrival - prevEnd)}`}
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-neutral-300"
                        style={{ left: `${pos(prevEnd)}%`, width: `${pos(arrival) - pos(prevEnd)}%` }}
                      />
                    )}
                    {start > arrival && (
                      <div
                        title={`Ожидание окна ${formatDuration(start - arrival)}`}
                        className="absolute top-1/2 h-px -translate-y-1/2 border-t border-dashed border-text-muted"
                        style={{ left: `${pos(arrival)}%`, width: `${pos(start) - pos(arrival)}%` }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      title={`#${task.id} · ${task.address}\n${formatClock(start)} – ${formatClock(end)}${late ? ` · опоздание ${assignment.late_min} мин` : ''}`}
                      className={cn(
                        'absolute top-1/2 flex h-5 -translate-y-1/2 items-center justify-between gap-1 overflow-hidden rounded px-1.5 text-[10px] text-white shadow-xs',
                        kind.bg,
                        late && 'ring-2 ring-amber-400',
                        selected && 'z-10 h-6 shadow-md ring-2 ring-text-primary',
                      )}
                      style={{ left: `${pos(start)}%`, width: `${Math.max(pos(end) - pos(start), 0.8)}%` }}
                    >
                      <span className="truncate font-medium">#{task.id}</span>
                      {late && <Icon name="warning" size={12} className="text-amber-200" />}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
