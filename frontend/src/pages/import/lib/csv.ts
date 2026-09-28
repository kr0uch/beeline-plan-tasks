export type ColumnSpec = {
  name: string
  field: string
  required: boolean
}

export const COLUMNS: ColumnSpec[] = [
  { name: 'Заявка', field: 'ID заявки', required: true },
  { name: 'Тип заявки BK', field: 'Тип работ (биллинг)', required: false },
  { name: 'Тип заявки HD', field: 'Тип работ (HelpDesk)', required: false },
  { name: 'Начало', field: 'Начало окна клиента', required: true },
  { name: 'Окончание', field: 'Конец окна клиента', required: true },
  { name: 'Район', field: 'Район', required: false },
  { name: 'Адрес', field: 'Адрес объекта', required: true },
  { name: 'Подключение', field: 'Технология подключения', required: false },
  { name: 'Гигабитное подключение', field: 'Гигабит', required: false },
]

export type RowIssue = { row: number; id: string; message: string }

export type CsvReport = {
  encoding: string
  header: string[]
  rows: string[][]
  columns: Array<ColumnSpec & { index: number; sample: string }>
  missingRequired: string[]
  validRows: number
  issues: RowIssue[]
  kinds: Record<string, number>
}

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/

function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ';') {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

function decode(buffer: ArrayBuffer): { text: string; encoding: string } {
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return { text: utf8.replace(/^﻿/, ''), encoding: 'UTF-8' }
  return { text: new TextDecoder('windows-1251').decode(buffer), encoding: 'Windows-1251' }
}

const toMin = (m: RegExpMatchArray) => Number(m[4]) * 60 + Number(m[5])

export async function analyzeCsv(file: File): Promise<CsvReport> {
  const { text, encoding } = decode(await file.arrayBuffer())
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const header = lines.length ? parseLine(lines[0]) : []
  const rows = lines.slice(1).map(parseLine)
  const index = new Map(header.map((h, i) => [h, i]))
  const col = (row: string[], name: string) => {
    const i = index.get(name)
    return i === undefined ? '' : (row[i] ?? '')
  }

  const columns = COLUMNS.map((c) => ({ ...c, index: index.get(c.name) ?? -1, sample: rows[0] ? col(rows[0], c.name) : '' }))
  const missingRequired = columns.filter((c) => c.required && c.index < 0).map((c) => c.name)

  const issues: RowIssue[] = []
  const seen = new Set<string>()
  const kinds: Record<string, number> = {}
  let validRows = 0

  rows.forEach((row, i) => {
    const id = col(row, 'Заявка')
    const problems: string[] = []
    if (!/^\d+$/.test(id)) problems.push('номер заявки не число — строка будет пропущена')
    else if (seen.has(id)) problems.push('номер заявки повторяется')
    seen.add(id)
    if (!col(row, 'Адрес')) problems.push('пустой адрес')
    const start = col(row, 'Начало').match(DATE_RE)
    const end = col(row, 'Окончание').match(DATE_RE)
    if (!start || !end) problems.push('время не в формате ДД.ММ.ГГГГ ЧЧ:ММ — будет подставлено время по умолчанию')
    else if (toMin(start) >= toMin(end)) problems.push('начало окна не раньше окончания')
    const kind = col(row, 'Тип заявки BK') || col(row, 'Тип заявки HD') || 'Не указан'
    kinds[kind] = (kinds[kind] ?? 0) + 1
    if (problems.length) issues.push({ row: i + 2, id: id || '—', message: problems.join('; ') })
    else validRows++
  })

  return { encoding, header, rows, columns, missingRequired, validRows, issues, kinds }
}

export function templateCsv(): string {
  const header = COLUMNS.map((c) => c.name).join(';')
  const row = ['74198', 'Подключение', 'Конвергенция абонента', '17.08.2026 18:00', '17.08.2026 20:00', 'Таганский', 'Город Москва, пер.Маяковского, д. 2', 'FMC', 'Нет'].join(';')
  return `﻿${header}\r\n${row}\r\n`
}
