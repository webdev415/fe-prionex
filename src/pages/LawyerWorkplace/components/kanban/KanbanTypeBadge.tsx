import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { KanbanTaskType } from '../../kanban/kanbanData'
import { TYPE_COLOURS, TYPE_DOT_COLOURS, TYPE_I18N_KEYS, TYPE_SHORT_LABELS } from './constants'

interface KanbanTypeBadgeProps {
  type: KanbanTaskType
}

export function KanbanTypeBadge({ type }: KanbanTypeBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        TYPE_COLOURS[type]
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TYPE_DOT_COLOURS[type])} />
      {t(TYPE_I18N_KEYS[type], TYPE_SHORT_LABELS[type])}
    </span>
  )
}
