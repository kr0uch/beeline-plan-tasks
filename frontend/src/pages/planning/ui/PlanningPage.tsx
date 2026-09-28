import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { PlanView } from '@/entities/plan'
import { PlanUploadForm, usePlan } from '@/features/load-plan'
import { CrewList, type CrewListTab } from '@/widgets/crew-list'
import { GanttTimeline } from '@/widgets/gantt-timeline'
import { PlanAlert } from '@/widgets/plan-alert'
import { PlanKpiRow } from '@/widgets/plan-kpi'
import { RouteMap } from '@/widgets/route-map'
import { TaskInspector } from '@/widgets/task-inspector'
import { Icon } from '@/shared/ui'

type Selection = { crewId: string | null; taskId: number | null }

function selectionFor(view: PlanView | null, taskId: number | null): Selection {
  if (!view) return { crewId: null, taskId: null }
  if (taskId !== null && view.crewByTask.has(taskId)) return { crewId: view.crewByTask.get(taskId) ?? null, taskId }
  if (taskId !== null && view.unassigned.some((u) => u.task_id === taskId)) return { crewId: null, taskId }
  return { crewId: view.crews[0]?.id ?? null, taskId: null }
}

export function PlanningPage() {
  const { plan, view, status, error, updatedAt } = usePlan()
  const [params] = useSearchParams()
  const taskParam = Number(params.get('task')) || null
  const [tab, setTab] = useState<CrewListTab>(() =>
    taskParam !== null && view?.unassigned.some((u) => u.task_id === taskParam) ? 'unassigned' : 'all',
  )
  const [selection, setSelection] = useState<Selection>(() => selectionFor(view, taskParam))
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [planStamp, setPlanStamp] = useState(updatedAt)

  if (planStamp !== updatedAt) {
    setPlanStamp(updatedAt)
    setSelection(selectionFor(view, null))
    setConfirmed(new Set())
    setTab('all')
  }

  if (!plan || !view) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <PlanUploadForm />
      </div>
    )
  }

  const selectCrew = (crewId: string) => {
    setSelection((s) => ({ crewId, taskId: s.crewId === crewId ? s.taskId : null }))
    if (tab === 'unassigned') setTab('all')
  }
  const selectTask = (taskId: number) => {
    const crewId = view.crewByTask.get(taskId) ?? null
    setSelection((s) => ({ crewId: crewId ?? s.crewId, taskId }))
    if (crewId && tab === 'unassigned') setTab('all')
  }
  const selectUnassigned = (taskId: number) => {
    setTab('unassigned')
    setSelection((s) => ({ crewId: s.crewId, taskId }))
  }

  return (
    <div className="flex h-full min-h-[760px] flex-col">
      {status === 'error' && error && (
        <div className="flex items-center gap-2 bg-type-emergency-bg px-4 py-2 text-body-sm text-type-emergency">
          <Icon name="error" />
          Не удалось пересчитать план: {error}. Показан предыдущий результат.
        </div>
      )}

      <PlanAlert
        view={view}
        onShowUnassigned={() => view.unassigned[0] && selectUnassigned(view.unassigned[0].task_id)}
        onShowTask={selectTask}
      />
      <PlanKpiRow ml={plan.ml_metrics} baseline={plan.baseline_metrics} />

      <section className="relative flex min-h-0 flex-1 overflow-hidden border-b border-border">
        <CrewList
          view={view}
          tab={tab}
          onTabChange={setTab}
          selectedCrewId={selection.crewId}
          onSelectCrew={selectCrew}
          selectedUnassignedId={tab === 'unassigned' ? selection.taskId : null}
          onSelectUnassigned={selectUnassigned}
        />
        <RouteMap view={view} selectedCrewId={selection.crewId} selectedTaskId={selection.taskId} onSelectTask={selectTask} />
        <TaskInspector
          view={view}
          selectedCrewId={selection.crewId}
          selectedTaskId={selection.taskId}
          confirmedCrewIds={confirmed}
          onSelectTask={selectTask}
          onConfirmCrew={(id) => setConfirmed((prev) => new Set(prev).add(id))}
          onClose={() => setSelection((s) => (s.taskId !== null ? { ...s, taskId: null } : { crewId: null, taskId: null }))}
        />
        {status === 'loading' && (
          <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-bg-surface/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-4 py-2 text-title-sm shadow-md">
              <Icon name="progress_activity" className="animate-spin text-primary" />
              Пересчитываем маршруты…
            </div>
          </div>
        )}
      </section>

      <GanttTimeline
        view={view}
        selectedCrewId={selection.crewId}
        selectedTaskId={selection.taskId}
        onSelectCrew={selectCrew}
        onSelectTask={selectTask}
      />
    </div>
  )
}
