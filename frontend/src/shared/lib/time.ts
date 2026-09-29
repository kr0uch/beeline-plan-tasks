import { PLAN_TIME_ORIGIN_MIN } from '@/shared/config'

export const toDayMin = (min: number) => min + PLAN_TIME_ORIGIN_MIN

export function formatClock(dayMin: number): string {
  const m = Math.max(0, Math.round(dayMin))
  const h = Math.floor(m / 60) % 24
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const formatPlanTime = (min: number) => formatClock(toDayMin(min))

export function formatDuration(min: number): string {
  const m = Math.round(min)
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (!h) return `${rest} мин`
  return rest ? `${h} ч ${rest} мин` : `${h} ч`
}

export function nowDayMin(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
