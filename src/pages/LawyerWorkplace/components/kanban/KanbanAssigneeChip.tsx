import { cn } from '@/lib/utils'
import { getAssigneeColour } from './constants'

interface KanbanAssigneeChipProps {
  initials: string
  name: string
  assigneeUserId?: number | null
}

export function KanbanAssigneeChip({
  initials,
  name,
  assigneeUserId = null,
}: KanbanAssigneeChipProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
          getAssigneeColour(assigneeUserId, initials)
        )}
      >
        {initials}
      </span>
      <span className="text-light-700 text-[11px]">{name}</span>
    </div>
  )
}
