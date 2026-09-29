import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { RegionSelect, usePlan } from '@/features/load-plan'
import { REGIONS } from '@/shared/config'
import { cn, plural } from '@/shared/lib'
import { Badge, Icon } from '@/shared/ui'
import { analyzeCsv, templateCsv, type CsvReport } from '../lib/csv'

function Step({ n, title, aside, children }: { n: number; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-title-sm text-primary">{n}</span>
          <h2 className="text-headline-sm">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportPage() {
  const { region, setRegion, submit, loadDemo, status, error, history } = usePlan()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<CsvReport | null>(null)
  const [reading, setReading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const loading = status === 'loading'

  const pick = async (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setReading(true)
    try {
      setReport(await analyzeCsv(f))
    } finally {
      setReading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void pick(e.dataTransfer.files[0])
  }

  const clear = () => {
    setFile(null)
    setReport(null)
  }

  const run = async () => {
    if (file && (await submit(file, region))) navigate('/planning')
  }

  const total = report?.rows.length ?? 0
  const validPct = total ? Math.round(((report?.validRows ?? 0) / total) * 1000) / 10 : 0
  const blocked = !report || report.missingRequired.length > 0 || total === 0
  const mapped = report ? report.columns.filter((c) => c.required && c.index >= 0).length : 0
  const requiredCount = report ? report.columns.filter((c) => c.required).length : 0

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <div className="text-label-md text-text-muted">
            Конфигурация › Импорт данных › <span className="text-primary">Смена {new Date().toLocaleDateString('ru-RU')}</span>
          </div>
          <h1 className="text-headline-lg">Импорт данных и подготовка смены</h1>
          <p className="text-body-md text-text-secondary">Загрузка заявок из CSV, проверка колонок и данных, запуск расчёта маршрутов</p>
        </div>
        <Badge className="bg-primary-soft px-3 py-1.5 text-body-sm text-primary">
          <span className="size-2 rounded-full bg-signal-success" />
          API: POST /api/v1/plan
        </Badge>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)' }}>
        <div className="flex flex-col gap-4">
          <Step n={1} title="Пакетный импорт заявок (CSV)" aside={<span className="text-label-md text-text-muted">Шаг 1 из 3</span>}>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                dragOver ? 'border-primary bg-primary-soft' : 'border-border bg-bg-subtle hover:border-primary/50',
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon name="cloud_upload" size={26} />
              </span>
              <span className="text-title-md">
                Перетащите сюда файл заявок (.csv) или <span className="text-primary underline">выберите на диске</span>
              </span>
              <span className="text-label-md text-text-muted">Разделитель «;», кодировка UTF-8 или Windows-1251</span>
            </button>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => void pick(e.target.files?.[0])} />

            {file && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-bg-subtle p-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-status-completed">
                  <Icon name="table_view" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-title-sm">{file.name}</span>
                    <span className="text-label-md text-text-muted">
                      ({(file.size / 1024).toFixed(0)} КБ{report ? `, ${total} ${plural(total, 'строка', 'строки', 'строк')}` : ''})
                    </span>
                    {report && <Badge className="bg-emerald-50 text-status-completed">✓ Прочитан</Badge>}
                  </div>
                  {report && <div className="text-label-md text-text-muted">Кодировка {report.encoding} • колонок: {report.header.length}</div>}
                </div>
                <button type="button" onClick={clear} title="Убрать файл" className="rounded p-1.5 text-text-muted hover:bg-bg-surface hover:text-signal-danger">
                  <Icon name="delete" />
                </button>
              </div>
            )}
            {reading && <p className="mt-2 text-body-sm text-text-muted">Читаем файл…</p>}
          </Step>

          {report && (
            <Step
              n={2}
              title="Сопоставление колонок"
              aside={
                <Badge className={report.missingRequired.length ? 'bg-type-emergency-bg text-signal-danger' : 'bg-primary-soft text-primary'}>
                  <Icon name={report.missingRequired.length ? 'error' : 'verified'} size={14} />
                  {mapped} из {requiredCount} обязательных полей найдено
                </Badge>
              }
            >
              <table className="w-full text-left text-body-sm">
                <thead className="bg-bg-subtle text-label-md text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Колонка CSV</th>
                    <th className="px-3 py-2">Поле алгоритма</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Пример первого значения</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.columns.map((c) => (
                    <tr key={c.name}>
                      <td className="px-3 py-2.5 font-medium">{c.name}</td>
                      <td className="px-3 py-2.5 text-text-secondary">
                        {c.field}
                        {c.required && <span className="text-signal-danger"> *</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.index >= 0 ? (
                          <Badge className="bg-emerald-50 text-status-completed">✓ Найдена</Badge>
                        ) : c.required ? (
                          <Badge className="bg-type-emergency-bg text-signal-danger">Нет колонки</Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-signal-warning">Не обязательна</Badge>
                        )}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 text-text-secondary">{c.sample || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.missingRequired.length > 0 && (
                <p className="mt-3 text-body-sm text-signal-danger">
                  Бэкенд не примет файл без колонок: {report.missingRequired.join(', ')}. Скачайте шаблон справа.
                </p>
              )}
            </Step>
          )}

          {report && (
            <Step
              n={3}
              title="Проверка данных"
              aside={
                <div className="text-right">
                  <div className={cn('text-headline-md', validPct >= 95 ? 'text-primary' : 'text-signal-warning')}>{validPct}%</div>
                  <div className="text-label-sm text-text-muted">
                    {report.validRows} из {total} строк без замечаний
                  </div>
                </div>
              }
            >
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${validPct}%` }} />
              </div>
              <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="flex items-center gap-2 rounded-lg bg-bg-subtle p-3">
                  <Icon name="check_circle" className="text-signal-success" />
                  <div>
                    <div className="text-title-sm">{report.validRows} {plural(report.validRows, 'строка', 'строки', 'строк')}</div>
                    <div className="text-label-sm text-text-muted">Готовы к расчёту</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-bg-subtle p-3">
                  <Icon name="warning" className="text-signal-warning" />
                  <div>
                    <div className="text-title-sm">{report.issues.length} с замечаниями</div>
                    <div className="text-label-sm text-text-muted">Требуют проверки</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-bg-subtle p-3">
                  <Icon name="category" className="text-primary" />
                  <div>
                    <div className="text-title-sm">{Object.keys(report.kinds).length} типов работ</div>
                    <div className="truncate text-label-sm text-text-muted">{Object.keys(report.kinds).slice(0, 3).join(', ')}</div>
                  </div>
                </div>
              </div>

              {report.issues.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="mb-2 flex items-center gap-2 text-title-sm">
                    <Icon name="warning" className="text-signal-warning" />
                    {report.issues.length} {plural(report.issues.length, 'строка требует', 'строки требуют', 'строк требуют')} внимания
                  </div>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {report.issues.slice(0, 50).map((issue) => (
                      <div key={issue.row} className="flex gap-3 rounded bg-bg-surface px-3 py-2 text-body-sm">
                        <span className="w-24 shrink-0 text-text-muted">Строка {issue.row}</span>
                        <span className="w-20 shrink-0 font-medium">#{issue.id}</span>
                        <span className="text-signal-danger">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-3 text-label-md text-text-muted">Геокодирование адресов выполняет бэкенд при расчёте; ненайденные адреса вернутся с ошибкой «адрес не найден».</p>
            </Step>
          )}

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-surface p-4 shadow-sm">
            <span className="text-label-md text-text-secondary">Регион:</span>
            <RegionSelect value={region} onChange={setRegion} disabled={loading} />
            {error && status === 'error' && (
              <span className="flex items-center gap-1.5 text-body-sm text-signal-danger">
                <Icon name="error" size={16} />
                {error}
              </span>
            )}
            <span className="ml-auto" />
            {file && (
              <button type="button" onClick={clear} disabled={loading} className="h-10 px-3 text-title-sm text-text-secondary hover:text-text-primary">
                Отменить импорт
              </button>
            )}
            <button
              type="button"
              onClick={() => void run()}
              disabled={blocked || loading}
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-title-sm text-white shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name={loading ? 'progress_activity' : 'play_arrow'} className={cn(loading && 'animate-spin')} />
              {loading ? 'Строим маршруты…' : `Запустить алгоритм планирования${total ? ` (${total} ${plural(total, 'заявка', 'заявки', 'заявок')})` : ''}`}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-border bg-bg-surface p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Icon name="science" className="text-type-upsell" />
              <h2 className="text-headline-sm">Демо-данные</h2>
            </div>
            <p className="mb-4 text-body-sm text-text-secondary">
              Готовый набор заявок и бригад по Москве для показа интерфейса без бэкенда: аварии, опоздания, нераспределённые заявки.
            </p>
            <button
              type="button"
              onClick={() => {
                loadDemo()
                navigate('/planning')
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-type-upsell/40 bg-type-upsell-bg text-title-sm text-type-upsell hover:opacity-90"
            >
              <Icon name="auto_awesome" />
              Открыть демо-смену
            </button>
          </section>

          <section className="rounded-lg border border-border bg-bg-surface p-5 shadow-sm">
            <h2 className="mb-2 text-headline-sm">Формат файла</h2>
            <p className="mb-3 text-body-sm text-text-secondary">CSV с разделителем «;». Время — ДД.ММ.ГГГГ ЧЧ:ММ. Обязательные колонки отмечены *.</p>
            <ul className="mb-4 space-y-1 text-body-sm">
              {['Заявка *', 'Тип заявки BK', 'Тип заявки HD', 'Начало *', 'Окончание *', 'Район', 'Адрес *', 'Подключение', 'Гигабитное подключение'].map((c) => (
                <li key={c} className="flex items-center gap-2 text-text-secondary">
                  <Icon name="check" size={14} className="text-primary" />
                  {c}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => download('shablon-zayavok.csv', templateCsv())}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-title-sm hover:bg-bg-subtle"
            >
              <Icon name="download" />
              Скачать шаблон CSV
            </button>
          </section>

          <section className="rounded-lg border border-border bg-bg-surface p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-sm">Журнал импортов</h2>
              <span className="text-label-md text-text-muted">{history.length}</span>
            </div>
            {history.length ? (
              <div className="space-y-2">
                {history.slice(0, 6).map((run) => (
                  <div key={run.at.getTime()} className="rounded-lg bg-bg-subtle p-2.5 text-body-sm">
                    <div className="flex justify-between gap-2">
                      <span className="truncate font-medium">{run.isDemo ? 'Демо-данные' : run.fileName}</span>
                      <span className="shrink-0 text-text-muted">{run.at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-label-md text-text-muted">
                      {REGIONS.find((r) => r.value === run.region)?.label} • назначено {run.assigned} из {run.total}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-sm text-text-muted">В этой сессии расчётов ещё не было</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
