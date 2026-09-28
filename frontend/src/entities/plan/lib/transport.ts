export function transportIcon(transport: string): string {
  const t = transport.toLowerCase()
  if (/пеш|walk|foot|метро|public/.test(t)) return 'directions_walk'
  if (/газел|груз|truck|van/.test(t)) return 'local_shipping'
  if (/вело|bike/.test(t)) return 'pedal_bike'
  return 'directions_car'
}

const TRANSPORT_LABELS: Record<string, string> = {
  car: 'Авто',
  truck: 'Грузовой',
  van: 'Фургон',
  foot: 'Пешком',
  walk: 'Пешком',
  public: 'Общ. транспорт',
  bike: 'Велосипед',
}

export function transportLabel(transport: string): string {
  return TRANSPORT_LABELS[transport.trim().toLowerCase()] ?? transport
}
