export function transportIcon(transport: string): string {
  const t = transport.toLowerCase()
  if (/пеш|walk|foot|метро/.test(t)) return 'directions_walk'
  if (/газел|груз|truck|van/.test(t)) return 'local_shipping'
  if (/вело|bike/.test(t)) return 'pedal_bike'
  return 'directions_car'
}
