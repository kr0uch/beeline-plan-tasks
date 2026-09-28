import { NavLink } from 'react-router'
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

export function AppSidebar() {
  const { plan, view } = usePlan()

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
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal-success opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-signal-success" />
        </span>
        <span className="truncate text-label-sm text-text-secondary">
          API: <strong className="font-medium text-signal-success">/api/v1</strong>
        </span>
      </div>
    </aside>
  )
}
