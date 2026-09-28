import type { ReactNode } from 'react'
import { cn } from '@/shared/lib'

type BadgeProps = {
  children: ReactNode
  className?: string
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-label-sm font-semibold whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  )
}
