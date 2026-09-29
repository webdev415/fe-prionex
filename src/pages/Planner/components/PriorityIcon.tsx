/**
 * Priority icon (planner story 5.1, AC2; DESIGN.md «Иконка приоритета», U-35).
 *
 * The icon follows the level's position in the board's scale, not its name —
 * boards name their levels themselves (3–5 levels, position 1 is the lowest,
 * as in the planner templates «Низький · Середній · Високий · Критичний»):
 * down, flat, up, double up, exclamation. Only the top level of the scale is
 * coloured (amber — red belongs to overdue); the rest are neutral. The level's
 * name is the tooltip and the accessible name. Display only: the priority
 * changes in the task panel.
 *
 * The scale comes from the task's board (the cached `GET /boards/{code}`, no
 * polling). Until it is known, or when the level is not in it any more, there
 * is no icon: a guessed position would claim an importance nobody set.
 */
import { useTranslation } from 'react-i18next'
import {
  MdDragHandle,
  MdKeyboardArrowDown,
  MdKeyboardArrowUp,
  MdKeyboardDoubleArrowUp,
  MdPriorityHigh,
} from 'react-icons/md'
import { cn } from '@/lib/utils'
import { usePlannerBoard } from '@/api/planner/plannerQueries'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { PRIORITY_TOP_INK } from '../plannerTones'
import { PlannerTooltip } from './PlannerTooltip'
import { useCardTabIndex } from './cardFocus'

/** By position in the scale, lowest first; the name marks the icon in the DOM. */
const ICONS = [
  ['down', MdKeyboardArrowDown],
  ['flat', MdDragHandle],
  ['up', MdKeyboardArrowUp],
  ['double-up', MdKeyboardDoubleArrowUp],
  ['exclamation', MdPriorityHigh],
] as const

interface PriorityIconProps {
  task: Pick<PlannerTaskCard, 'priority' | 'board'>
}

export function PriorityIcon({ task }: PriorityIconProps) {
  const { t } = useTranslation('planner')
  const { priority } = task
  // Inside a kanban card: reached with ← →, not with Tab (story 5.3).
  const cardTabIndex = useCardTabIndex()
  const board = usePlannerBoard(task.board.code, priority !== null, { poll: false })
  const scale = [...(board.data?.config.priorities ?? [])].sort((a, b) => a.position - b.position)
  const index = priority ? scale.findIndex((level) => level.id === priority.id) : -1
  if (!priority || index < 0) return null

  const [shape, Icon] = ICONS[Math.min(index, ICONS.length - 1)]
  const top = index === scale.length - 1
  const label = t('priority.label', { name: priority.name })
  return (
    <PlannerTooltip label={label}>
      <span
        role="img"
        aria-label={label}
        data-priority-icon={shape}
        // The level name opens on keyboard focus as on hover (UX: «подсказка
        // по наведению и по фокусу»); the icon has no action of its own.
        // Inside a kanban card it is reached with ← → instead of Tab (5.3).
        tabIndex={cardTabIndex ?? 0}
        className={cn(
          'focus-visible:ring-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none',
          top ? PRIORITY_TOP_INK : 'text-muted-foreground'
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
    </PlannerTooltip>
  )
}

export default PriorityIcon
