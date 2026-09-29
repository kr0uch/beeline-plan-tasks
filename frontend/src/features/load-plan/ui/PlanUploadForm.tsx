import { useRef, useState, type DragEvent } from 'react'
import { cn } from '@/shared/lib'
import { Icon } from '@/shared/ui'
import { usePlan } from '../model/context'
import { RegionSelect } from './RegionSelect'

export function PlanUploadForm() {
  const { region, setRegion, submit, loadDemo, status, error } = usePlan()
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const loading = status === 'loading'

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  return (
    <div className="w-full max-w-xl rounded-xl border border-border bg-bg-surface p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Icon name="route" className="text-primary" size={22} />
        <h1 className="text-headline-md">Построить план на смену</h1>
      </div>
      <p className="mb-5 text-body-md text-text-secondary">
        Загрузите CSV с заявками. Сервис распределит их по бригадам с учётом навыков, оборудования и временных окон и
        сравнит ML-план с базовым.
      </p>

      <div className="mb-4 flex flex-col gap-1.5">
        <span className="text-label-md text-text-secondary">Регион планирования</span>
        <RegionSelect value={region} onChange={setRegion} disabled={loading} className="w-fit" />
      </div>

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
        <Icon name={file ? 'description' : 'cloud_upload'} size={32} className="text-primary" />
        {file ? (
          <>
            <span className="text-title-md">{file.name}</span>
            <span className="text-label-md text-text-muted">{(file.size / 1024).toFixed(1)} КБ · нажмите, чтобы заменить</span>
          </>
        ) : (
          <>
            <span className="text-title-md">Перетащите CSV сюда или выберите файл</span>
            <span className="text-label-md text-text-muted">Поле формы: tasks_file</span>
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-type-emergency/30 bg-type-emergency-bg px-3 py-2 text-body-sm text-type-emergency">
          <Icon name="error" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          disabled={!file || loading}
          onClick={() => file && void submit(file)}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-title-md text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name={loading ? 'progress_activity' : 'bolt'} className={cn(loading && 'animate-spin')} />
          {loading ? 'Строим маршруты…' : 'Построить план'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={loadDemo}
          className="h-10 rounded-lg border border-border px-4 text-title-sm text-text-secondary transition-colors hover:bg-bg-subtle disabled:opacity-50"
        >
          Демо-данные
        </button>
      </div>
    </div>
  )
}
