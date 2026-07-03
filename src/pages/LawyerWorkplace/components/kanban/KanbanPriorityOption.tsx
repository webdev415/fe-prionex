import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { CREATE_TASK_PRIORITIES, type KanbanTaskPriority } from './constants'

interface KanbanPriorityIconProps {
  priority: KanbanTaskPriority
}

export function KanbanPriorityIcon({ priority }: KanbanPriorityIconProps) {
  switch (priority) {
    case 'highest':
      return <Icons.ArrowUpDouble size={16} strokeWidth={2.5} className="text-error-600" />
    case 'high':
      return <Icons.ArrowUp size={16} strokeWidth={2.5} className="text-error-500" />
    case 'medium':
      return <Icons.EqualSign size={16} strokeWidth={2.5} className="text-warning-500" />
    case 'low':
      return <Icons.ArrowDown size={16} strokeWidth={2.5} className="text-information-500" />
    case 'lowest':
      return <Icons.ArrowDownDouble size={16} strokeWidth={2.5} className="text-information-600" />
  }
}

interface KanbanPriorityOptionProps {
  priority: KanbanTaskPriority
  className?: string
}

export function KanbanPriorityOption({ priority, className }: KanbanPriorityOptionProps) {
  const { t } = useTranslation('common')
  const config = CREATE_TASK_PRIORITIES.find((item) => item.id === priority)

  if (!config) return null

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <KanbanPriorityIcon priority={priority} />
      </span>
      <span className={cn('text-[14px] font-light', config.textClass)}>
        {t(config.key, config.fallback)}
      </span>
    </span>
  )
}
