import { useRef } from 'react'
import { cn } from '@/shared/lib'
import { Icon } from '@/shared/ui'
import { usePlan } from '../model/context'

export function UploadButton({ className }: { className?: string }) {
  const { submit, status } = usePlan()
  const input = useRef<HTMLInputElement>(null)

  return (
    <>
      <button
        type="button"
        disabled={status === 'loading'}
        onClick={() => input.current?.click()}
        className={cn(
          'flex h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 text-title-sm text-text-primary transition-colors hover:bg-bg-subtle disabled:opacity-60',
          className,
        )}
      >
        <Icon name="upload_file" className="text-text-secondary" />
        Загрузить CSV
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void submit(file)
          e.target.value = ''
        }}
      />
    </>
  )
}
