import { Link } from 'react-router'
import { Icon } from '@/shared/ui'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon name="construction" size={36} className="text-text-muted" />
      <h1 className="text-headline-md">{title}</h1>
      <p className="text-body-md text-text-secondary">Раздел в разработке.</p>
      <Link to="/planning" className="text-title-sm text-primary hover:underline">
        Вернуться к планированию
      </Link>
    </div>
  )
}
