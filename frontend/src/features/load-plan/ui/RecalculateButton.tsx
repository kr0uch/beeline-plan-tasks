import { cn } from '@/shared/lib'
import { Icon } from '@/shared/ui'
import { usePlan } from '../model/context'

export function RecalculateButton() {
  const { recalculate, status, plan } = usePlan()
  const loading = status === 'loading'

  return (
    <button
      type="button"
      disabled={!plan || loading}
      onClick={() => void recalculate()}
      className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-title-sm text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name="refresh" className={cn(loading && 'animate-spin')} />
      {loading ? 'Расчёт…' : 'Пересчитать план'}
    </button>
  )
}
