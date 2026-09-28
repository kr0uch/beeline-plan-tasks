import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildPlanView, createPlan, mockPlan, replanPlan, simulateReplan, type PlanResponse, type Task } from '@/entities/plan'
import { nowDayMin } from '@/shared/lib'
import { PLAN_TIME_ORIGIN_MIN, type Region } from '@/shared/config'
import { PlanContext, type PlanState } from './context'

const initialState: PlanState = {
  status: 'idle',
  error: null,
  region: 'southcenter',
  fileName: null,
  isDemo: false,
  plan: null,
  view: null,
  updatedAt: null,
  history: [],
  previous: null,
  replanTask: null,
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlanState>(initialState)
  const lastFile = useRef<File | null>(null)
  const abort = useRef<AbortController | null>(null)
  const regionRef = useRef(state.region)
  useEffect(() => {
    regionRef.current = state.region
  }, [state.region])

  const applyPlan = (plan: PlanResponse, patch: Partial<PlanState>) =>
    setState((s) => ({
      ...s,
      ...patch,
      status: 'success',
      error: null,
      plan,
      view: buildPlanView(plan),
      updatedAt: new Date(),
      history: [
        {
          at: new Date(),
          region: s.region,
          fileName: patch.fileName ?? s.fileName ?? '',
          isDemo: patch.isDemo ?? s.isDemo,
          assigned: plan.ml_metrics.assigned,
          total: plan.ml_metrics.total_tasks,
          lateCount: plan.ml_metrics.late_count,
          distanceKm: plan.ml_metrics.total_distance_km,
        },
        ...s.history,
      ],
    }))

  const submit = useCallback(async (file: File, region?: Region) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    lastFile.current = file

    const target = region ?? regionRef.current
    setState((s) => ({ ...s, region: target, status: 'loading', error: null }))

    try {
      const plan = await createPlan(target, file, controller.signal)
      applyPlan(plan, { isDemo: false, fileName: file.name, previous: null, replanTask: null })
    } catch (e) {
      if (controller.signal.aborted) return
      setState((s) => ({
        ...s,
        status: 'error',
        error: e instanceof Error ? e.message : 'Не удалось построить план',
      }))
    }
  }, [])

  const loadDemo = useCallback(() => {
    abort.current?.abort()
    lastFile.current = null
    applyPlan(mockPlan, { isDemo: true, fileName: 'demo.csv', previous: null, replanTask: null })
  }, [])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const replan = useCallback(async (task: Task) => {
    const current = stateRef.current
    if (!current.plan || !current.view) return false
    const previous = { plan: current.plan, view: current.view }
    const body = { current_time_min: nowDayMin() - PLAN_TIME_ORIGIN_MIN, new_task: task }
    setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const plan = current.isDemo ? simulateReplan(current.plan, body) : await replanPlan(current.region, body)
      applyPlan(plan, { previous, replanTask: task })
      return true
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: e instanceof Error ? e.message : 'Не удалось перепланировать' }))
      return false
    }
  }, [])

  const recalculate = useCallback(async () => {
    if (lastFile.current) return submit(lastFile.current)
    if (state.isDemo) loadDemo()
  }, [submit, loadDemo, state.isDemo])

  const setRegion = useCallback((region: Region) => setState((s) => ({ ...s, region })), [])

  const reset = useCallback(() => {
    abort.current?.abort()
    lastFile.current = null
    setState((s) => ({ ...initialState, region: s.region, history: s.history }))
  }, [])

  const value = useMemo(
    () => ({ ...state, setRegion, submit, recalculate, loadDemo, replan, reset }),
    [state, setRegion, submit, recalculate, loadDemo, replan, reset],
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}
