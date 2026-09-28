import { useSyncExternalStore } from 'react'

export type KindOrder = Array<'emergency' | 'connection' | 'repair' | 'delivery'>

export type AlgorithmSettings = {
  explainWithLLM: boolean
  weights: { sla: number; late: number; overtime: number; travel: number }
  priority: KindOrder
  rules: { dynamicReplan: boolean; stability: boolean; publicTransport: boolean; overtime60: boolean }
  slaLimitMin: number
}

export const DEFAULT_SETTINGS: AlgorithmSettings = {
  explainWithLLM: true,
  weights: { sla: 10, late: 5.5, overtime: 3.2, travel: 1.8 },
  priority: ['emergency', 'connection', 'repair', 'delivery'],
  rules: { dynamicReplan: true, stability: true, publicTransport: true, overtime60: false },
  slaLimitMin: 100,
}

const KEY = 'algorithm-settings'
const listeners = new Set<() => void>()

function read(): AlgorithmSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AlgorithmSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
  return DEFAULT_SETTINGS
}

let current = read()

export function getSettings(): AlgorithmSettings {
  return current
}

export function saveSettings(next: AlgorithmSettings) {
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    current = next
  }
  listeners.forEach((l) => l())
}

export function useAlgorithmSettings(): AlgorithmSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
