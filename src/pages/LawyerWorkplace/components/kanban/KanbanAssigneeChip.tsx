import { cn } from '@/lib/utils'
import { ASSIGNEE_COLOURS } from './constants'

interface KanbanAssigneeChipProps {
  initials: string
  name: string
}

export function KanbanAssigneeChip({ initials, name }: KanbanAssigneeChipProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
          ASSIGNEE_COLOURS[initials] ?? 'bg-gray-100 text-gray-500'
        )}
      >
        {initials}
      </span>
      <span className="text-light-700 text-[11px]">{name}</span>
    </div>
  )
}
