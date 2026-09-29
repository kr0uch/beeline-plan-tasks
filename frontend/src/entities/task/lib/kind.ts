export type TaskKind = 'emergency' | 'connection' | 'repair' | 'delivery'

type KindMeta = {
  label: string
  color: string
  bg: string
  soft: string
  text: string
  border: string
}

export const TASK_KIND_META: Record<TaskKind, KindMeta> = {
  emergency: { label: 'Авария', color: '#DC2626', bg: 'bg-type-emergency', soft: 'bg-type-emergency-bg', text: 'text-type-emergency', border: 'border-type-emergency' },
  connection: { label: 'Подключение', color: '#2563EB', bg: 'bg-type-connection', soft: 'bg-type-connection-bg', text: 'text-type-connection', border: 'border-type-connection' },
  repair: { label: 'Ремонт', color: '#EA580C', bg: 'bg-type-repair', soft: 'bg-type-repair-bg', text: 'text-type-repair', border: 'border-type-repair' },
  delivery: { label: 'Доставка', color: '#7C3AED', bg: 'bg-type-upsell', soft: 'bg-type-upsell-bg', text: 'text-type-upsell', border: 'border-type-upsell' },
}

type KindSource = { type_hd?: string; type_bk?: string; priority?: string }

export function getTaskKind({ type_hd = '', type_bk = '', priority = '' }: KindSource): TaskKind {
  const text = `${type_hd} ${type_bk}`.toLowerCase()
  if (/авар|incident|emergency/.test(text) || isCriticalPriority(priority)) return 'emergency'
  if (/ремонт|repair|то\b|обслуж|неисправ|нет /.test(text)) return 'repair'
  if (/достав|дозаказ|оборуд|delivery|возврат|замен/.test(text)) return 'delivery'
  return 'connection'
}

export function isCriticalPriority(priority: string): boolean {
  return /crit|крит|urgent|сроч|авар|^p?0$|^p1$/i.test(priority.trim())
}

type PriorityMeta = { label: string; className: string }

export function getPriorityMeta(priority: string): PriorityMeta {
  const p = priority.trim().toLowerCase()
  if (isCriticalPriority(p)) return { label: 'Критический', className: 'bg-type-emergency-bg text-type-emergency' }
  if (/high|высок|p2/.test(p)) return { label: 'Высокий', className: 'bg-amber-100 text-signal-warning' }
  if (/low|низк|p4/.test(p)) return { label: 'Низкий', className: 'bg-bg-subtle text-text-secondary border border-border' }
  if (/normal|medium|средн|обыч|p3/.test(p)) return { label: 'Обычный', className: 'bg-type-connection-bg text-type-connection' }
  return { label: priority || '—', className: 'bg-bg-subtle text-text-secondary border border-border' }
}
