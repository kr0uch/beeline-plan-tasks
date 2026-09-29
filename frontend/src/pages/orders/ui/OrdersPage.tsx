import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { buildOrders } from '@/entities/plan'
import { ExportOrdersButton } from '@/features/export-orders'
import { PlanUploadForm, usePlan } from '@/features/load-plan'
import { OrderCard } from '@/widgets/order-card'
import { OrdersPagination, OrdersTable, PAGE_SIZES } from '@/widgets/orders-table'
import { useNow } from '@/shared/lib'
import { Icon } from '@/shared/ui'
import { applyFilters, DEFAULT_FILTERS, type OrderFilters } from '../model/filters'
import { OrdersToolbar } from './OrdersToolbar'

export function OrdersPage() {
  const { plan, view, status, updatedAt, recalculate } = usePlan()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const now = useNow()

  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_FILTERS)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  const [planStamp, setPlanStamp] = useState(updatedAt)

  if (planStamp !== updatedAt) {
    setPlanStamp(updatedAt)
    setChecked(new Set())
    setPage(1)
  }

  const orders = useMemo(() => (view ? buildOrders(view, now) : []), [view, now])
  const baseOrders = useMemo(() => applyFilters(orders, filters, true), [orders, filters])
  const filtered = useMemo(() => applyFilters(orders, filters), [orders, filters])

  if (!plan || !view) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <PlanUploadForm />
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageOrders = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const selectedId = Number(params.get('id')) || null
  const selected = orders.find((o) => o.id === selectedId) ?? null

  const setSelected = (id: number | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === null) next.delete('id')
        else next.set('id', String(id))
        return next
      },
      { replace: true },
    )

  const changeFilters = (patch: Partial<OrderFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setChecked((prev) => {
      const next = new Set(prev)
      const all = pageOrders.every((o) => next.has(o.id))
      for (const o of pageOrders) {
        if (all) next.delete(o.id)
        else next.add(o.id)
      }
      return next
    })

  const openRoute = (id: number) => navigate(`/planning?task=${id}`)
  const exportList = checked.size ? orders.filter((o) => checked.has(o.id)) : filtered
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  return (
    <div className="flex h-full min-h-[640px] flex-col">
      <OrdersToolbar
        filters={filters}
        onChange={changeFilters}
        baseOrders={baseOrders}
        crews={view.crews}
        total={orders.length}
        unassignedCount={view.unassigned.length}
        criticalCount={orders.filter((o) => o.kind === 'emergency').length}
        lateCount={orders.filter((o) => o.risk === 'late').length}
        actions={
          <>
            {checked.size > 0 && (
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="h-9 rounded-lg px-3 text-title-sm text-text-secondary hover:bg-bg-subtle"
              >
                Снять выбор
              </button>
            )}
            <ExportOrdersButton orders={exportList} selectedCount={checked.size} />
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col bg-bg-surface">
          <div className="min-h-0 flex-1 overflow-auto">
            <OrdersTable
              orders={pageOrders}
              selectedId={selectedId}
              checked={checked}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onOpen={setSelected}
              onOpenRoute={openRoute}
            />
            {!filtered.length && (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-body-sm text-text-muted">
                <Icon name="search_off" size={28} />
                Ничего не найдено
                {filtersActive && (
                  <button type="button" onClick={() => changeFilters(DEFAULT_FILTERS)} className="text-title-sm text-primary hover:underline">
                    Сбросить фильтры
                  </button>
                )}
              </div>
            )}
          </div>
          <OrdersPagination
            shown={pageOrders.length}
            total={filtered.length}
            page={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </div>

        {selected && (
          <OrderCard
            order={selected}
            now={now}
            replanning={status === 'loading'}
            onClose={() => setSelected(null)}
            onReplan={() => void recalculate()}
            onOpenRoute={() => openRoute(selected.id)}
          />
        )}
      </div>
    </div>
  )
}
