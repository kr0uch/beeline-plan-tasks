import type { PlanView } from '@/entities/plan'
import { cn } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'
import { CrewCard } from './CrewCard'

export type CrewListTab = 'all' | 'busy' | 'free' | 'unassigned'

type Props = {
  view: PlanView
  tab: CrewListTab
  onTabChange: (tab: CrewListTab) => void
  selectedCrewId: string | null
  onSelectCrew: (crewId: string) => void
  selectedUnassignedId: number | null
  onSelectUnassigned: (taskId: number) => void
}

export function CrewList({
  view,
  tab,
  onTabChange,
  selectedCrewId,
  onSelectCrew,
  selectedUnassignedId,
  onSelectUnassigned,
}: Props) {
  const busy = view.crews.filter((c) => c.load === 'high' || c.load === 'overload')
  const free = view.crews.filter((c) => c.load === 'normal' || c.load === 'idle')
  const crews = tab === 'busy' ? busy : tab === 'free' ? free : view.crews

  const tabs: Array<{ id: CrewListTab; label: string; danger?: boolean }> = [
    { id: 'all', label: `Все (${view.crews.length})` },
    { id: 'busy', label: `Загруж. (${busy.length})` },
    { id: 'free', label: `Норма (${free.length})` },
    { id: 'unassigned', label: `Не распр. (${view.unassigned.length})`, danger: view.unassigned.length > 0 },
  ]

  return (
    <aside className="z-10 flex h-full w-[310px] shrink-0 flex-col border-r border-border bg-bg-surface">
      <div className="space-y-2 border-b border-border p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-title-md">Бригады на смене</span>
          <span className="rounded-full bg-surface-high px-1.5 py-0.5 text-label-sm font-bold text-type-connection">
            {view.crews.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-0.5 rounded border border-border bg-bg-subtle p-0.5 text-center">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                'truncate rounded px-0.5 py-1 text-[10.5px] font-medium',
                tab === t.id ? 'bg-bg-surface text-type-connection shadow-sm' : 'text-text-secondary hover:text-text-primary',
                t.danger && tab !== t.id && 'text-type-emergency',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 divide-y divide-border overflow-y-auto">
        {tab !== 'unassigned' &&
          crews.map((crew) => (
            <CrewCard key={crew.id} crew={crew} selected={crew.id === selectedCrewId} onSelect={() => onSelectCrew(crew.id)} />
          ))}

        {tab === 'unassigned' &&
          view.unassigned.map((u) => (
            <button
              key={u.task_id}
              type="button"
              onClick={() => onSelectUnassigned(u.task_id)}
              className={cn(
                'block w-full border-l-[3px] p-2.5 text-left transition-colors',
                selectedUnassignedId === u.task_id
                  ? 'border-type-emergency bg-type-emergency-bg/40'
                  : 'border-transparent hover:bg-bg-subtle',
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-title-sm">Заявка #{u.task_id}</span>
                <Badge className="bg-type-emergency-bg text-type-emergency">{u.reason || 'Не назначена'}</Badge>
              </div>
              <p className="line-clamp-2 text-label-md text-text-secondary">{u.explanation}</p>
            </button>
          ))}

        {tab === 'unassigned' && !view.unassigned.length && (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-body-sm text-text-muted">
            <Icon name="task_alt" size={28} className="text-signal-success" />
            Все заявки распределены
          </div>
        )}
      </div>
    </aside>
  )
}
