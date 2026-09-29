import { REGIONS, type Region } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Icon } from '@/shared/ui'

type Props = {
  value: Region
  onChange: (region: Region) => void
  disabled?: boolean
  className?: string
}

export function RegionSelect({ value, onChange, disabled, className }: Props) {
  return (
    <label
      className={cn(
        'relative flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-subtle pr-2 pl-3 transition-colors hover:bg-surface-high',
        disabled && 'opacity-60',
        className,
      )}
    >
      <Icon name="map" className="text-text-secondary" />
      <select
        aria-label="Регион планирования"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Region)}
        className="cursor-pointer appearance-none bg-transparent pr-5 text-title-sm text-text-primary outline-none"
      >
        {REGIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <Icon name="expand_more" className="pointer-events-none absolute right-2 text-text-muted" />
    </label>
  )
}
