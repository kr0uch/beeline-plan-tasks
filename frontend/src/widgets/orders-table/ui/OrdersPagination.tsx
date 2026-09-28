import { cn } from '@/shared/lib'
import { Icon } from '@/shared/ui'
import { PAGE_SIZES } from '../config/pageSizes'

type Props = {
  shown: number
  total: number
  page: number
  pageCount: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

function pageList(page: number, count: number): Array<number | null> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))
  const sorted = [...set].sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]))
}

export function OrdersPagination({ shown, total, page, pageCount, pageSize, onPage, onPageSize }: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-bg-subtle px-4 py-2 text-body-sm text-text-secondary">
      <div className="flex items-center gap-4">
        <span>
          Показано: <strong className="text-metric text-text-primary">{shown}</strong> из {total}
        </span>
        <label className="flex items-center gap-2">
          <span className="text-text-muted">На странице:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-6 rounded border border-border bg-bg-surface px-1 text-[12px] text-text-primary outline-none"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Предыдущая страница"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="flex size-7 items-center justify-center rounded border border-border bg-bg-surface text-text-muted hover:text-text-primary disabled:opacity-50"
        >
          <Icon name="chevron_left" size={16} />
        </button>
        {pageList(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              className={cn(
                'flex size-7 items-center justify-center rounded text-[12px]',
                p === page
                  ? 'bg-primary font-semibold text-white'
                  : 'border border-border bg-bg-surface text-text-secondary hover:bg-surface-high',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Следующая страница"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="flex size-7 items-center justify-center rounded border border-border bg-bg-surface text-text-muted hover:text-text-primary disabled:opacity-50"
        >
          <Icon name="chevron_right" size={16} />
        </button>
      </div>
    </div>
  )
}
