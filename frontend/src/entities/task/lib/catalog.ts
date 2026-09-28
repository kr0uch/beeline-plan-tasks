export const SKILLS = ['basic', 'fmc', 'fttb', 'gigabit', 'emergency'] as const
export const EQUIPMENT = ['router', 'tv_box', 'cable_kit', 'optics_kit', 'gigabit_kit'] as const

export type Skill = (typeof SKILLS)[number]
export type Equipment = (typeof EQUIPMENT)[number]

const LABELS: Record<string, string> = {
  basic: 'Базовый монтаж',
  fmc: 'FMC (мобильная + фиксированная)',
  fttb: 'Оптика FTTB',
  gigabit: 'Гигабит',
  emergency: 'Аварийные работы',
  router: 'Роутер',
  tv_box: 'ТВ-приставка',
  cable_kit: 'Кабельный набор',
  optics_kit: 'Оптический набор',
  gigabit_kit: 'Гигабитный комплект',
}

export function requirementLabel(value: string): string {
  return LABELS[value] ?? value
}

export function requirementList(values: readonly string[]): string {
  return values.map(requirementLabel).join(', ')
}
