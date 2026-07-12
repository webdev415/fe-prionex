import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { KanbanTaskType } from '../../kanban/kanbanData'
import { LETTER_TYPE_COLOR_BY_ID } from '../settings/constants'
import { TYPE_COLOURS, TYPE_DOT_COLOURS, TYPE_I18N_KEYS, TYPE_SHORT_LABELS } from './constants'

interface KanbanTypeBadgeProps {
  type: KanbanTaskType
  /** Override badge text (e.g. settings display name). */
  label?: string
  /** Settings letter-type color id — preferred over hardcoded type colours. */
  colorId?: string
}

export function KanbanTypeBadge({ type, label, colorId }: KanbanTypeBadgeProps) {
  const { t } = useTranslation('common')
  const settingsColor = colorId ? LETTER_TYPE_COLOR_BY_ID[colorId] : undefined

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        settingsColor ? cn(settingsColor.bgClass, settingsColor.textClass) : TYPE_COLOURS[type]
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          settingsColor ? settingsColor.dotClass : TYPE_DOT_COLOURS[type]
        )}
      />
      {label ?? t(TYPE_I18N_KEYS[type], TYPE_SHORT_LABELS[type])}
    </span>
  )
}
