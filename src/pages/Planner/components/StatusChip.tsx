/**
 * Status chip of a task (planner stories 1.10 AC3, 5.1 AC2/AC5; UX «Чип статуса»).
 *
 * Category dot (DESIGN.md `cat-*`, `plannerTones`) + the board's status name,
 * as the board spelled it. It is a button only when the server put
 * `change_status` in the task's `allowed_actions`; otherwise it is plain text —
 * no dead control. The contract has no per-transition rules (any status of the
 * board is a legal target once `change_status` is there), so the menu is the
 * board's statuses with the current one on top; the change goes out as
 * `PATCH /tasks/{id}` under `If-Match` and is undone from a 5 s «Скасувати»
 * toast. A status marked `requires_reason` asks for the reason first (UX
 * «Диалог причины»), and a task that LEAVES such a status gets no undo: going
 * back would need a reason nobody typed.
 *
 * The board (its statuses) is loaded as soon as the chip is a button, not when
 * the menu opens: otherwise the first click on «Мої задачі» or in the task panel
 * opens an empty menu. While it loads, or when it failed, the menu says so and
 * offers a retry — a menu with no items is never shown. When only a re-read
 * failed, the statuses already loaded stay usable and a quiet «Повторити» sits
 * under them; the error text is for a menu that has nothing else to offer.
 *
 * The reason is limited as the contract says (1–1000 characters after trimming,
 * counted in code points like the planner's runes). An overflow is reported in
 * the dialog, never cut off by `maxLength`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/localeFormat'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import { usePlannerBoard } from '@/api/planner/plannerQueries'
import {
  PLANNER_REASON_MAX,
  plannerTextLength,
  type PlannerBoardStatus,
  type PlannerTaskCard,
} from '@/api/planner/plannerApi'
import { useChangeTaskStatus } from '../hooks/usePlannerMutations'
import { CATEGORY_DOT } from '../plannerTones'

type Category = PlannerTaskCard['status']['category']

type ChipTask = Pick<
  PlannerTaskCard,
  'id' | 'key' | 'version' | 'status' | 'allowed_actions' | 'board'
>

function ChipFace({ name, category }: { name: string; category: Category }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOT[category])}
      />
      <span className="truncate">{name}</span>
    </>
  )
}

export function StatusChip({ task }: { task: ChipTask }) {
  const { t, i18n } = useTranslation('planner')
  const [open, setOpen] = useState(false)
  const [reasonFor, setReasonFor] = useState<PlannerBoardStatus | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()
  const canChange = task.allowed_actions.includes('change_status')
  const board = usePlannerBoard(task.board.code, canChange, { poll: false })
  const change = useChangeTaskStatus()

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    // The chip does not poll the board; opening the menu is when a stale
    // configuration (a status renamed or added meanwhile) matters.
    if (next && board.isStale && !board.isFetching) void board.refetch()
  }

  const chipClass =
    'border-border bg-card text-foreground inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs'

  if (!canChange) {
    return (
      <span className={chipClass}>
        <ChipFace name={task.status.name} category={task.status.category} />
      </span>
    )
  }

  // A failed re-read keeps the last good board in `data` (status `error`):
  // those statuses are still the right menu.
  const loaded = board.data !== undefined
  // A retry after an error keeps the query in `error` while it fetches.
  const boardLoading = !loaded && (board.isPending || (board.isError && board.isFetching))
  const boardFailed = !loaded && board.isError && !board.isFetching
  const refreshFailed = loaded && board.isError && !board.isFetching
  const statuses = [...(board.data?.config.statuses ?? [])].sort((a, b) => a.position - b.position)
  const others = statuses.filter((s) => s.id !== task.status.id)

  const retryItem = (className: string) => (
    <DropdownMenuItem
      className={className}
      onSelect={(event) => {
        // Keep the menu open: the statuses appear in it once loaded.
        event.preventDefault()
        void board.refetch()
      }}
    >
      {t('status.retry')}
    </DropdownMenuItem>
  )

  // Unknown in the loaded configuration (renamed away meanwhile) counts as
  // «needs a reason»: no undo rather than an undo the server refuses.
  const leavesReasonStatus = statuses.find((s) => s.id === task.status.id)?.requires_reason ?? true

  const send = (status: PlannerBoardStatus, withReason?: string) =>
    change.mutate({
      id: task.id,
      key: task.key,
      boardCode: task.board.code,
      version: task.version,
      statusId: status.id,
      reason: withReason,
      undo: leavesReasonStatus ? undefined : { statusId: task.status.id, toName: status.name },
    })

  const pick = (status: PlannerBoardStatus) => {
    if (status.requires_reason) {
      setReason('')
      setReasonError(undefined)
      setReasonFor(status)
      return
    }
    send(status)
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(chipClass, 'hover:bg-muted cursor-pointer')}
            aria-label={t('status.change', { status: task.status.name })}
            disabled={change.isPending}
            onClick={(event) => event.stopPropagation()}
          >
            <ChipFace name={task.status.name} category={task.status.category} />
            <span aria-hidden="true">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem disabled className="flex items-center gap-1.5 text-xs">
            <ChipFace name={task.status.name} category={task.status.category} />
          </DropdownMenuItem>
          {boardLoading && (
            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
              {t('status.loading')}
            </DropdownMenuItem>
          )}
          {boardFailed && (
            <>
              <DropdownMenuItem disabled className="text-xs">
                {t('status.error')}
              </DropdownMenuItem>
              {retryItem('cursor-pointer text-xs')}
            </>
          )}
          {others.map((status) => (
            <DropdownMenuItem
              key={status.id}
              className="flex cursor-pointer items-center gap-1.5 text-xs"
              onSelect={() => pick(status)}
            >
              <ChipFace name={status.name} category={status.category} />
            </DropdownMenuItem>
          ))}
          {refreshFailed && retryItem('text-muted-foreground cursor-pointer text-xs')}
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={reasonFor !== null} onClose={() => setReasonFor(null)} maxWidth="sm">
        <ModalHeader title={reasonFor ? `${task.key} → ${reasonFor.name}` : ''} />
        <ModalContent>
          <Textarea
            label={t('reasonDialog.label')}
            value={reason}
            error={reasonError}
            onChange={(event) => setReason(event.target.value)}
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={() => setReasonFor(null)}>
            {t('create.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={reason.trim() === ''}
            onClick={() => {
              const trimmed = reason.trim()
              if (plannerTextLength(trimmed) > PLANNER_REASON_MAX) {
                setReasonError(
                  t('reasonDialog.tooLong', {
                    max: formatNumber(PLANNER_REASON_MAX, i18n.language ?? 'uk'),
                  })
                )
                return
              }
              if (reasonFor) send(reasonFor, trimmed)
              setReasonFor(null)
            }}
          >
            {t('reasonDialog.confirm')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

export default StatusChip
