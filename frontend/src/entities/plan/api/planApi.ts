import { request } from '@/shared/api'
import type { Region } from '@/shared/config'
import type { PlanResponse, ReplanRequest } from '../model/types'

export function createPlan(region: Region, file: File, signal?: AbortSignal): Promise<PlanResponse> {
  const body = new FormData()
  body.append('tasks_file', file)
  return request<PlanResponse>(`/plan?region=${encodeURIComponent(region)}`, {
    method: 'POST',
    body,
    signal,
  })
}

export function replanPlan(region: Region, body: ReplanRequest, signal?: AbortSignal): Promise<PlanResponse> {
  return request<PlanResponse>(`/replan?region=${encodeURIComponent(region)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}
