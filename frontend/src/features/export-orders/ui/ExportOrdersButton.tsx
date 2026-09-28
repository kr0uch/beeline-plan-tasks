import type { Order } from '@/entities/plan'
import { Icon } from '@/shared/ui'
import { downloadOrdersCsv } from '../lib/ordersCsv'

type Props = {
  orders: Order[]
  selectedCount: number
}

export function ExportOrdersButton({ orders, selectedCount }: Props) {
  const date = new Date().toISOString().slice(0, 10)
  return (
    <button
      type="button"
      disabled={!orders.length}
      onClick={() => downloadOrdersCsv(orders, `orders-${date}.csv`)}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 text-title-sm text-text-primary shadow-sm transition-colors hover:bg-bg-subtle disabled:opacity-50"
    >
      <Icon name="download" className="text-text-secondary" />
      {selectedCount ? `Экспорт выбранных (${selectedCount})` : 'Экспорт CSV'}
    </button>
  )
}
