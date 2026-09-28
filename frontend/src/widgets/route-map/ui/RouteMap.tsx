import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Crew, PlanView } from '@/entities/plan'
import { getTaskKind, TASK_KIND_META, type TaskKind } from '@/entities/task'
import { cn, formatPlanTime } from '@/shared/lib'
import { Icon } from '@/shared/ui'

type Props = {
  view: PlanView
  selectedCrewId: string | null
  selectedTaskId: number | null
  onSelectTask: (taskId: number) => void
}

const MOSCOW: L.LatLngTuple = [55.7558, 37.6173]

function stopIcon(order: number, kind: TaskKind, state: 'selected' | 'active' | 'muted', late: boolean) {
  const color = TASK_KIND_META[kind].color
  const size = state === 'selected' ? 30 : state === 'active' ? 24 : 16
  const pulse =
    state === 'selected'
      ? `<span style="position:absolute;inset:-8px;border-radius:9999px;background:${color};opacity:.25;animation:ping 1.5s cubic-bezier(0,0,.2,1) infinite"></span>`
      : ''
  const label = state === 'muted' ? '' : String(order)
  const lateDot = late
    ? '<span style="position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:9999px;background:#D97706;border:1.5px solid #fff"></span>'
    : ''
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">${pulse}<div style="position:relative;width:100%;height:100%;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${state === 'selected' ? 12 : 11}px Inter,sans-serif;opacity:${state === 'muted' ? 0.55 : 1}">${label}</div>${lateDot}</div>`,
  })
}

function FitBounds({ points }: { points: L.LatLngTuple[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14, animate: true })
  }, [map, points])
  return null
}

const coords = (crew: Crew): L.LatLngTuple[] =>
  crew.stops.filter((s) => Number.isFinite(s.task.lat) && Number.isFinite(s.task.lon)).map((s) => [s.task.lat, s.task.lon])

export function RouteMap({ view, selectedCrewId, selectedTaskId, onSelectTask }: Props) {
  const [showAll, setShowAll] = useState(true)
  const selectedCrew = view.crews.find((c) => c.id === selectedCrewId) ?? null

  const visibleCrews = showAll || !selectedCrew ? view.crews : [selectedCrew]
  const fitPoints = useMemo(() => {
    const crew = view.crews.find((c) => c.id === selectedCrewId)
    return crew && coords(crew).length ? coords(crew) : view.crews.flatMap(coords)
  }, [selectedCrewId, view])

  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-low">
      <MapContainer center={MOSCOW} zoom={11} zoomControl={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-muted"
        />
        <FitBounds points={fitPoints} />

        {visibleCrews.map((crew) => {
          const active = !selectedCrew || crew.id === selectedCrew.id
          return (
            <Polyline
              key={`line-${crew.id}`}
              positions={coords(crew)}
              pathOptions={{
                color: crew.color,
                weight: active && selectedCrew ? 4 : 2.5,
                opacity: active ? 0.9 : 0.3,
                dashArray: active && selectedCrew ? undefined : '6 6',
              }}
            />
          )
        })}

        {visibleCrews.flatMap((crew) => {
          const active = !selectedCrew || crew.id === selectedCrew.id
          return crew.stops.map(({ task, assignment, order }) => {
            const selected = task.id === selectedTaskId
            const late = (assignment?.late_min ?? 0) > 0
            return (
              <Marker
                key={`stop-${task.id}`}
                position={[task.lat, task.lon]}
                icon={stopIcon(order, getTaskKind(task), selected ? 'selected' : active ? 'active' : 'muted', late)}
                zIndexOffset={selected ? 1000 : active ? 500 : 0}
                eventHandlers={{ click: () => onSelectTask(task.id) }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <div className="text-label-md">
                    <div className="font-semibold">
                      #{task.id} · {crew.name}
                    </div>
                    <div>{task.address}</div>
                    {assignment && (
                      <div className="text-text-muted">
                        {formatPlanTime(assignment.start_min)} – {formatPlanTime(assignment.end_min)}
                        {late && <span className="text-signal-warning"> · опоздание {assignment.late_min} мин</span>}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </Marker>
            )
          })
        })}
      </MapContainer>

      <div className="pointer-events-none absolute top-3 left-3 z-[1000] flex items-center gap-2 rounded-lg border border-border bg-bg-surface/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
        <span className="size-2.5 animate-pulse rounded-full bg-signal-success" />
        <span className="text-title-sm">Слой маршрутов</span>
        <span className="text-text-muted">|</span>
        <span className="text-label-sm text-text-secondary">
          {selectedCrew ? `${selectedCrew.name} выбрана` : `${view.crews.length} бригад`}
        </span>
      </div>

      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1 rounded-lg border border-border bg-bg-surface/95 p-1 shadow-sm backdrop-blur-sm">
        {[
          { id: true, icon: 'layers', label: 'Все маршруты' },
          { id: false, icon: 'my_location', label: 'Только выбранная' },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            disabled={!opt.id && !selectedCrew}
            onClick={() => setShowAll(opt.id)}
            className={cn(
              'flex items-center gap-1 rounded px-2.5 py-1 text-label-sm font-medium disabled:opacity-40',
              showAll === opt.id ? 'bg-primary-soft text-type-connection' : 'text-text-secondary hover:bg-bg-subtle',
            )}
          >
            <Icon name={opt.icon} size={16} />
            {opt.label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 z-[1000] space-y-1.5 rounded-lg border border-border bg-bg-surface/95 p-2.5 text-label-sm shadow-md backdrop-blur-md">
        <div className="mb-1 text-title-sm">Типы заявок:</div>
        {(Object.keys(TASK_KIND_META) as TaskKind[]).map((kind) => (
          <div key={kind} className="flex items-center gap-2">
            <span className={cn('size-3 shrink-0 rounded-full ring-1 ring-white', TASK_KIND_META[kind].bg)} />
            <span className="text-text-secondary">{TASK_KIND_META[kind].label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-full bg-signal-warning ring-1 ring-white" />
          <span className="text-text-secondary">Опоздание</span>
        </div>
      </div>
    </main>
  )
}
