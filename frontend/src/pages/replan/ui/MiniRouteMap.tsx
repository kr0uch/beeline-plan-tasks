import L from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import type { PlannedStop, Task } from '@/entities/plan'

type Props = {
  stops: PlannedStop[]
  color: string
  emergency?: Task
  dashed?: boolean
}

function dot(label: string, color: string, size: number) {
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 10px Inter,sans-serif">${label}</div>`,
  })
}

export function MiniRouteMap({ stops, color, emergency, dashed }: Props) {
  const points = stops.map((s): L.LatLngTuple => [s.task.lat, s.task.lon])
  const all = emergency ? [...points, [emergency.lat, emergency.lon] as L.LatLngTuple] : points
  if (!all.length) return <div className="h-full bg-bg-subtle" />

  return (
    <MapContainer
      key={all.map((p) => p.join(",")).join(";")}
      bounds={L.latLngBounds(all)}
      boundsOptions={{ padding: [28, 28], maxZoom: 14 }}
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" className="map-tiles-muted" />
      <Polyline positions={points} pathOptions={{ color, weight: 3, dashArray: dashed ? '6 6' : undefined }} />
      {stops.map((s, i) => {
        const isEmergency = s.task.id === emergency?.id
        return (
          <Marker
            key={s.task.id}
            position={[s.task.lat, s.task.lon]}
            icon={isEmergency ? dot('⚡', '#DC2626', 28) : dot(String(i + 1), color, 18)}
            zIndexOffset={isEmergency ? 1000 : 0}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              #{s.task.id} · {s.task.address}
            </Tooltip>
          </Marker>
        )
      })}
      {emergency && !stops.some((s) => s.task.id === emergency.id) && (
        <Marker position={[emergency.lat, emergency.lon]} icon={dot('⚡', '#DC2626', 22)} opacity={0.6}>
          <Tooltip direction="top" permanent offset={[0, -10]}>
            Авария (ещё не в плане)
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  )
}
