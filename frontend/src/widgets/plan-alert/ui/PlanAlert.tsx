import type { PlanView } from '@/entities/plan'
import { Icon } from '@/shared/ui'

type Props = {
  view: PlanView
  onShowUnassigned: () => void
  onShowTask: (taskId: number) => void
}

export function PlanAlert({ view, onShowUnassigned, onShowTask }: Props) {
  const { unassigned } = view

  if (unassigned.length) {
    const first = unassigned[0]
    return (
      <section className="flex items-center justify-between gap-4 bg-signal-danger px-4 py-2.5 text-white shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <Icon name="warning" size={20} className="animate-bounce" />
          <span className="text-headline-sm tracking-wider whitespace-nowrap uppercase">
            Не распределено: {unassigned.length}
          </span>
          <div className="h-4 w-px shrink-0 bg-white/30" />
          <span className="truncate text-body-sm text-white/90">
            <span className="font-semibold text-white">#{first.task_id}</span> · {first.explanation || first.reason}
          </span>
        </div>
        <button
          type="button"
          onClick={onShowUnassigned}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded bg-white px-3 text-title-sm text-signal-danger shadow hover:bg-neutral-100"
        >
          <Icon name="bolt" />
          Разобрать заявки
        </button>
      </section>
    )
  }

  const late = view.crews.flatMap((c) => c.stops).filter((s) => (s.assignment?.late_min ?? 0) > 0)
  if (late.length) {
    return (
      <section className="flex items-center justify-between gap-4 bg-amber-50 px-4 py-2 text-signal-warning">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="schedule" />
          <span className="text-title-sm">Риск SLA: {late.length} заявок с опозданием</span>
        </div>
        <button
          type="button"
          onClick={() => onShowTask(late[0].task.id)}
          className="text-title-sm underline-offset-2 hover:underline"
        >
          Показать первую
        </button>
      </section>
    )
  }

  return null
}
