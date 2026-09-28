import { HttpError, request } from '@/shared/api'
import type { Region } from '@/shared/config'
import type { Engineer, Health, PlanResponse, RawPlanResponse, ReplanRequest } from '../model/types'
import { normalizePlan } from './normalize'

const q = (region: Region) => `region=${encodeURIComponent(region)}`

export async function createPlan(region: Region, file: File, signal?: AbortSignal): Promise<PlanResponse> {
  const body = new FormData()
  body.append('tasks_file', file)
  return normalizePlan(await request<RawPlanResponse>(`/plan?${q(region)}`, { method: 'POST', body, signal }))
}

export async function replanPlan(region: Region, body: ReplanRequest, signal?: AbortSignal): Promise<PlanResponse> {
  return normalizePlan(
    await request<RawPlanResponse>(`/replan?${q(region)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }),
  )
}

export async function fetchCurrentPlan(region: Region, signal?: AbortSignal): Promise<PlanResponse | null> {
  try {
    return normalizePlan(await request<RawPlanResponse>(`/plan?${q(region)}`, { signal }))
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null
    throw e
  }
}

export async function fetchEngineers(region: Region, signal?: AbortSignal): Promise<Engineer[]> {
  return (await request<Engineer[] | null>(`/engineers?${q(region)}`, { signal })) ?? []
}

export function fetchHealth(signal?: AbortSignal): Promise<Health> {
  return request<Health>('/health', { signal })
}
