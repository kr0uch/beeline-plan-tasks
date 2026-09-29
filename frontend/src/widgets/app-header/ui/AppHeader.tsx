import { RecalculateButton, RegionSelect, UploadButton, usePlan } from '@/features/load-plan'
import { Badge, Icon } from '@/shared/ui'

const today = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

export function AppHeader() {
  const { region, setRegion, plan, fileName, isDemo, status, updatedAt } = usePlan()

  return (
    <header className="z-40 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-bg-surface px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-subtle px-3">
          <Icon name="calendar_today" className="text-text-secondary" />
          <span className="text-title-sm whitespace-nowrap">Сегодня, {today}</span>
        </div>
        <RegionSelect value={region} onChange={setRegion} disabled={status === 'loading'} />
        {plan && (
          <div className="flex min-w-0 items-center gap-1.5 text-label-md text-text-muted">
            <Icon name="description" size={16} />
            <span className="truncate">{fileName}</span>
            {isDemo && <Badge className="bg-type-upsell-bg text-type-upsell">Демо</Badge>}
            {updatedAt && (
              <span className="whitespace-nowrap">
                · {updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {plan && <UploadButton />}
        <RecalculateButton />
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="flex flex-col text-right">
            <span className="text-title-sm leading-tight">Диспетчер</span>
            <span className="text-label-sm leading-tight text-text-muted">Москва</span>
          </div>
          <div className="flex size-8 items-center justify-center rounded-full border border-border bg-primary-soft text-primary">
            <Icon name="person" />
          </div>
        </div>
      </div>
    </header>
  )
}
