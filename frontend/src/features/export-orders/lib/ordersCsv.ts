import { ORDER_RISK_META, ORDER_STATUS_META, type Order } from '@/entities/plan'
import { TASK_KIND_META } from '@/entities/task'
import { formatPlanTime } from '@/shared/lib'

const HEADERS = [
  'ID',
  'Тип',
  'Источник',
  'Статус',
  'Адрес',
  'Район',
  'Окно с',
  'Окно по',
  'Длительность, мин',
  'Бригада',
  'Позиция',
  'Начало',
  'Окончание',
  'Опоздание, мин',
  'SLA',
  'Пояснение',
]

const escape = (value: string | number | null | undefined) => {
  const s = value === null || value === undefined ? '' : String(value)
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function row(o: Order): Array<string | number | null> {
  const t = o.task
  const a = o.assignment
  return [
    o.id,
    o.kind ? TASK_KIND_META[o.kind].label : '',
    o.source,
    ORDER_STATUS_META[o.status].label,
    t?.address ?? '',
    t?.district ?? '',
    t ? formatPlanTime(t.tw_start) : '',
    t ? formatPlanTime(t.tw_end) : '',
    t?.service_time ?? '',
    o.crew?.name ?? '',
    o.position,
    a ? formatPlanTime(a.start_min) : '',
    a ? formatPlanTime(a.end_min) : '',
    a?.late_min ?? '',
    ORDER_RISK_META[o.risk].label,
    a?.explanation ?? o.unassigned?.explanation ?? '',
  ]
}

export function ordersToCsv(orders: Order[]): string {
  return '﻿' + [HEADERS, ...orders.map(row)].map((r) => r.map(escape).join(';')).join('\r\n')
}

export function downloadOrdersCsv(orders: Order[], fileName: string) {
  const blob = new Blob([ordersToCsv(orders)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
