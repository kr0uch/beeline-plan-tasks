import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { fetchHealth, type Health } from '@/entities/plan'
import { usePlan } from '@/features/load-plan'
import { cn } from '@/shared/lib'
import { Icon } from '@/shared/ui'

type NavItem = { to: string; icon: string; label: string; count?: number; accent?: boolean }

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <>
      <span className="px-4 pt-4 pb-1.5 text-label-sm font-semibold tracking-wider text-text-muted uppercase">{title}</span>
      <nav className="flex flex-col gap-0.5 px-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between border-l-[3px] px-3 py-2 text-title-sm transition-colors',
                isActive
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-transparent font-medium text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
              )
            }
          >
            <span className="flex items-center gap-2">
              <Icon name={item.icon} />
              {item.label}
            </span>
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-label-sm',
                  item.accent ? 'bg-surface-high text-type-connection' : 'border border-border bg-bg-subtle text-text-secondary',
                )}
              >
                {item.count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

function useHealth() {
  const [health, setHealth] = useState<Health | null | 'down'>(null)
  useEffect(() => {
    const check = () =>
      fetchHealth()
        .then(setHealth)
        .catch(() => setHealth('down'))
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])
  return health
}

export function AppSidebar() {
  const { plan, view } = usePlan()
  const health = useHealth()
  const apiUp = health !== null && health !== 'down'
  const mlUp = apiUp && /^(ok|up|available|healthy)$/i.test(health.ml)
  const tone = health === null ? 'bg-text-muted' : !apiUp ? 'bg-signal-danger' : mlUp ? 'bg-signal-success' : 'bg-signal-warning'
  const label = health === null ? 'проверка…' : !apiUp ? 'недоступен' : mlUp ? 'онлайн' : `онлайн, ML: ${health.ml}`

  return (
    <aside className="z-50 flex h-full w-60 shrink-0 flex-col justify-between border-r border-border bg-bg-surface select-none">
      <div className="flex flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
            <Icon name="navigation" />
          </div>
          <div className="flex flex-col">
            <span className="text-headline-sm leading-tight">МаршрутПро</span>
            <span className="text-label-sm text-text-muted">Logistics Core</span>
          </div>
        </div>

        <NavSection
          title="Операции"
          items={[
            { to: '/planning', icon: 'calendar_month', label: 'Планирование' },
            { to: '/replan', icon: 'emergency', label: 'Перепланирование' },
            { to: '/orders', icon: 'assignment', label: 'Заявки', count: plan?.ml_metrics.total_tasks, accent: true },
            { to: '/crews', icon: 'group', label: 'Бригады', count: view?.crews.length },
            { to: '/analytics', icon: 'bar_chart', label: 'Аналитика' },
          ]}
        />
        <div className="mx-3 mt-2 border-t border-border" />
        <NavSection
          title="Конфигурация"
          items={[
            { to: '/settings', icon: 'tune', label: 'Настройки алгоритма' },
            { to: '/import', icon: 'cloud_upload', label: 'Импорт данных' },
          ]}
        />
      </div>

      <div className="flex items-center gap-1.5 border-t border-border bg-bg-subtle p-3">
        <span className="relative flex size-2">
          <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-75', tone)} />
          <span className={cn('relative inline-flex size-2 rounded-full', tone)} />
        </span>
        <span className="truncate text-label-sm text-text-secondary">
          Сервер: <strong className={cn('font-medium', apiUp ? (mlUp ? 'text-signal-success' : 'text-signal-warning') : 'text-signal-danger')}>{label}</strong>
        </span>
      </div>
    </aside>
  )
}
