import { useState, type FormEvent, type ReactNode } from 'react'
import type { Task } from '@/entities/plan'
import { EQUIPMENT, requirementLabel, SKILLS, type Equipment, type Skill } from '@/entities/task'
import { PLAN_TIME_ORIGIN_MIN } from '@/shared/config'
import { cn, nowDayMin } from '@/shared/lib'
import { Icon } from '@/shared/ui'

type Props = {
  nextId: number
  busy: boolean
  error: string | null
  onSubmit: (task: Task) => void
  onCancel?: () => void
}

const TYPES = ['Авария', 'Ремонт', 'Подключение', 'Доставка'] as const
const PRIORITIES = [
  { value: 'critical', label: 'Критический' },
  { value: 'high', label: 'Высокий' },
  { value: 'normal', label: 'Обычный' },
]

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m - PLAN_TIME_ORIGIN_MIN
}

const clock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

const inputClass = 'h-9 w-full rounded-lg border border-border bg-bg-subtle px-2.5 text-body-sm outline-none focus:border-primary'

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-label-md text-text-secondary">{label}</span>
      {children}
    </label>
  )
}

function Chips<T extends string>({ values, selected, onToggle }: { values: readonly T[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onToggle(v)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-label-md',
            selected.includes(v) ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-secondary hover:bg-bg-subtle',
          )}
        >
          {requirementLabel(v)}
        </button>
      ))}
    </div>
  )
}

export function NewTaskForm({ nextId, busy, error, onSubmit, onCancel }: Props) {
  const now = nowDayMin()
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [district, setDistrict] = useState('')
  const [type, setType] = useState<(typeof TYPES)[number]>('Авария')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('critical')
  const [from, setFrom] = useState(clock(now))
  const [to, setTo] = useState(clock(now + 120))
  const [duration, setDuration] = useState('60')
  const [skills, setSkills] = useState<Skill[]>(['emergency'])
  const [equipment, setEquipment] = useState<Equipment[]>([])

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const valid = address.trim() && Number(duration) > 0 && from < to && (!lat || !Number.isNaN(Number(lat))) && (!lon || !Number.isNaN(Number(lon)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onSubmit({
      id: nextId,
      address: address.trim(),
      district: district.trim(),
      lat: lat ? Number(lat) : 0,
      lon: lon ? Number(lon) : 0,
      priority,
      required_skills: skills,
      required_equipment: equipment,
      service_time: Number(duration),
      tw_start: toMin(from),
      tw_end: toMin(to),
      type_hd: type === 'Подключение' || type === 'Доставка' ? '' : type,
      type_bk: description.trim() || (type === 'Подключение' || type === 'Доставка' ? type : ''),
    })
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-type-emergency-bg text-signal-danger">
          <Icon name="add_alert" />
        </span>
        <div className="mr-auto">
          <h2 className="text-headline-sm">Новая заявка для перепланирования</h2>
          <p className="text-label-md text-text-muted">Заявка #{nextId} будет встроена в текущий план с учётом времени {clock(now)}</p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded p-1 text-text-muted hover:bg-bg-subtle" aria-label="Закрыть">
            <Icon name="close" />
          </button>
        )}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <Field label="Адрес *" className="col-span-2">
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Москва, ул. Профсоюзная, 84 к. 2" />
        </Field>
        <Field label="Широта">
          <input className={inputClass} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="55.6553" inputMode="decimal" />
        </Field>
        <Field label="Долгота">
          <input className={inputClass} value={lon} onChange={(e) => setLon(e.target.value)} placeholder="37.5415" inputMode="decimal" />
        </Field>
        <Field label="Тип работ">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Описание">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Обрыв магистрали FTTB" />
        </Field>
        <Field label="Район">
          <input className={inputClass} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="ЮЗАО" />
        </Field>
        <Field label="Приоритет">
          <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Окно с">
          <input type="time" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Окно по">
          <input type="time" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Длительность, мин">
          <input type="number" min={5} step={5} className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>

      <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div>
          <div className="mb-1.5 text-label-md text-text-secondary">Навыки</div>
          <Chips values={SKILLS} selected={skills} onToggle={(v) => setSkills((s) => toggle(s, v))} />
        </div>
        <div>
          <div className="mb-1.5 text-label-md text-text-secondary">Оборудование</div>
          <Chips values={EQUIPMENT} selected={equipment} onToggle={(v) => setEquipment((s) => toggle(s, v))} />
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-type-emergency-bg px-3 py-2 text-body-sm text-signal-danger">
          <Icon name="error" />
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <span className="mr-auto text-label-md text-text-muted">Координаты можно не указывать, если бэкенд геокодирует адрес</span>
        <button
          type="submit"
          disabled={!valid || busy}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-signal-danger px-4 text-title-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          <Icon name={busy ? 'progress_activity' : 'bolt'} className={cn(busy && 'animate-spin')} />
          {busy ? 'Перепланируем…' : 'Перепланировать'}
        </button>
      </div>
    </form>
  )
}
