import { createContext, useContext } from 'react'
import type { PlanResponse, PlanView, Task } from '@/entities/plan'
import type { Region } from '@/shared/config'

export type PlanStatus = 'idle' | 'loading' | 'success' | 'error'

export type PlanRun = {
  at: Date
  region: Region
  fileName: string
  isDemo: boolean
  assigned: number
  total: number
  lateCount: number
  distanceKm: number
}

export type PlanState = {
  status: PlanStatus
  error: string | null
  region: Region
  fileName: string | null
  isDemo: boolean
  plan: PlanResponse | null
  view: PlanView | null
  updatedAt: Date | null
  history: PlanRun[]
  previous: { plan: PlanResponse; view: PlanView } | null
  replanTask: Task | null
}

export type PlanActions = {
  setRegion: (region: Region) => void
  submit: (file: File, region?: Region) => Promise<boolean>
  recalculate: () => Promise<void>
  loadDemo: () => void
  replan: (task: Task) => Promise<boolean>
  reset: () => void
}

export const PlanContext = createContext<(PlanState & PlanActions) | null>(null)

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within PlanProvider')
  return ctx
}
