import { cn } from '@/shared/lib'

type IconProps = {
  name: string
  size?: number
  className?: string
  title?: string
}

export function Icon({ name, size = 18, className, title }: IconProps) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn('material-symbols-outlined shrink-0', className)}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  )
}
