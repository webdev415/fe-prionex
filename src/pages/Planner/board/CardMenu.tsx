/**
 * `⋯` of a kanban card (planner story 5.3, AC3; UX «Карточка задачи», U-10):
 * «Відкрити», «Перемістити в…» (the board's other statuses, with
 * `change_status`), «Змінити порядок» (`Вище` · `Нижче` · `На початок колонки`,
 * with `reorder`) and «Копіювати посилання». It is the way to move a card
 * without a mouse (WCAG 2.5.7): `Shift+F10` or the context-menu key opens it
 * from anywhere in the card.
 *
 * Inside the card the trigger is out of the Tab order (reached with ← →,
 * `cardFocus`); the menu itself is Radix — arrows, `Enter`, `Esc`.
 */
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MdMoreHoriz } from 'react-icons/md'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'
import type { PlannerBoardStatus, PlannerTaskCard } from '@/api/planner/plannerApi'
import { CATEGORY_DOT } from '../plannerTones'
import { taskLinkPath } from '../plannerFormat'
import type { ReorderStep } from './kanbanMove'
import { useCardTabIndex } from '../components/cardFocus'

export interface CardMoveActions {
  /** Statuses the card may move to (all but its own); empty without `change_status`. */
  targets: PlannerBoardStatus[]
  onMoveTo: (status: PlannerBoardStatus) => void
  /** Present only with `reorder`. */
  reorder?: {
    canUp: boolean
    canDown: boolean
    onReorder: (step: ReorderStep) => void
  }
}

interface CardMenuProps {
  task: Pick<PlannerTaskCard, 'key'>
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenTask: (key: string) => void
  actions?: CardMoveActions
}

async function copyTaskLink(key: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${taskLinkPath(key)}`)
    return true
  } catch {
    return false
  }
}

export function CardMenu({ task, open, onOpenChange, onOpenTask, actions }: CardMenuProps) {
  const { t } = useTranslation('planner')
  const tabIndex = useCardTabIndex()
  const targets = actions?.targets ?? []
  const reorder = actions?.reorder
  // A move takes the card (and this trigger) elsewhere: the board gives the
  // focus back to the moved card, the menu does not return it to `⋯`.
  const moving = useRef(false)
  const moveBy = (run: () => void) => () => {
    moving.current = true
    run()
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={tabIndex}
          aria-label={t('card.menu', { key: task.key })}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-6 w-6 shrink-0 items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none"
        >
          <MdMoreHoriz aria-hidden="true" className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem]"
        onCloseAutoFocus={(event) => {
          if (moving.current) event.preventDefault()
          moving.current = false
        }}
      >
        <DropdownMenuItem className="cursor-pointer text-sm" onSelect={() => onOpenTask(task.key)}>
          {t('card.open')}
        </DropdownMenuItem>

        {targets.length > 0 && actions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup aria-label={t('card.moveTo')}>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {t('card.moveTo')}
              </DropdownMenuLabel>
              {targets.map((status) => (
                <DropdownMenuItem
                  key={status.id}
                  className="flex cursor-pointer items-center gap-1.5 text-sm"
                  onSelect={moveBy(() => actions.onMoveTo(status))}
                >
                  <span
                    aria-hidden="true"
                    className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOT[status.category])}
                  />
                  {status.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}

        {reorder && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup aria-label={t('card.reorder')}>
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                {t('card.reorder')}
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="cursor-pointer text-sm"
                disabled={!reorder.canUp}
                onSelect={moveBy(() => reorder.onReorder('up'))}
              >
                {t('card.up')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-sm"
                disabled={!reorder.canDown}
                onSelect={moveBy(() => reorder.onReorder('down'))}
              >
                {t('card.down')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-sm"
                disabled={!reorder.canUp}
                onSelect={moveBy(() => reorder.onReorder('top'))}
              >
                {t('card.top')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          onSelect={() => {
            void copyTaskLink(task.key).then((copied) =>
              copied ? toast.success(t('card.linkCopied')) : toast.error(t('card.linkCopyFailed'))
            )
          }}
        >
          {t('card.copyLink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CardMenu
