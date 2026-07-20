import { cn } from '@/lib/utils'

interface FilterCountBadgeProps {
  count: number
  active: boolean
}

export function FilterCountBadge({ count, active }: FilterCountBadgeProps) {
  return (
    <span
      className={cn(
        'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none',
        active ? 'bg-primary-300 text-foreground' : 'bg-muted text-foreground'
      )}
    >
      {count}
    </span>
  )
}
