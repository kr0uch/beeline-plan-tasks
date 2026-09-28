export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export const PLAN_TIME_ORIGIN_MIN = Number(import.meta.env.VITE_PLAN_TIME_ORIGIN_MIN ?? 0)

export const SHIFT_DURATION_MIN = 480

export const REGIONS = [
  { value: 'east', label: 'Восток' },
  { value: 'southeast', label: 'Юго-Восток' },
  { value: 'southcenter', label: 'Юго-Центр' },
] as const

export type Region = (typeof REGIONS)[number]['value']
