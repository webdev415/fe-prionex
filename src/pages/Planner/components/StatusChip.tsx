/**
 * Status chip of a task (planner story 1.10, AC3; UX «Чип статуса»).
 *
 * Category dot + the board's status name. It is a button only when the server
 * put `change_status` in the task's `allowed_actions`; otherwise it is plain
 * text — no dead control. The list is the board's statuses with the current one
 * on top; the change goes out as `PATCH /tasks/{id}` under `If-Match`.
 * A status marked `requires_reason` asks for the reason first (UX «Диалог причины»).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import type { PlannerBoardStatus, PlannerTaskCard } from '@/api/planner/plannerApi'
import { useChangeTaskStatus } from '../hooks/usePlannerMutations'

type Category = PlannerTaskCard['status']['category']

const DOT: Record<Category, string> = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-info-500',
  done: 'bg-success-500',
}

type ChipTask = Pick<
  PlannerTaskCard,
  'id' | 'key' | 'version' | 'status' | 'allowed_actions' | 'board'
>

function ChipFace({ name, category }: { name: string; category: Category }) {
  return (
    <>
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', DOT[category])} />
      <span className="truncate">{name}</span>
    </>
  )
}

export function StatusChip({ task }: { task: ChipTask }) {
  const { t } = useTranslation('planner')
  const [open, setOpen] = useState(false)
  const [reasonFor, setReasonFor] = useState<PlannerBoardStatus | null>(null)
  const [reason, setReason] = useState('')
  const canChange = task.allowed_actions.includes('change_status')
  const board = usePlannerBoard(task.board.code, canChange && open)
  const change = useChangeTaskStatus()

  const chipClass =
    'border-border bg-card text-foreground inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs'

  if (!canChange) {
    return (
      <span className={chipClass}>
        <ChipFace name={task.status.name} category={task.status.category} />
      </span>
    )
  }

  const statuses = [...(board.data?.config.statuses ?? [])].sort((a, b) => a.position - b.position)
  const others = statuses.filter((s) => s.id !== task.status.id)

  const send = (status: PlannerBoardStatus, withReason?: string) =>
    change.mutate({
      id: task.id,
      key: task.key,
      boardCode: task.board.code,
      version: task.version,
      statusId: status.id,
      reason: withReason,
    })

  const pick = (status: PlannerBoardStatus) => {
    if (status.requires_reason) {
      setReason('')
      setReasonFor(status)
      return
    }
    send(status)
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
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
          {others.map((status) => (
            <DropdownMenuItem
              key={status.id}
              className="flex cursor-pointer items-center gap-1.5 text-xs"
              onSelect={() => pick(status)}
            >
              <ChipFace name={status.name} category={status.category} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={reasonFor !== null} onClose={() => setReasonFor(null)} maxWidth="sm">
        <ModalHeader title={reasonFor ? `${task.key} → ${reasonFor.name}` : ''} />
        <ModalContent>
          <Textarea
            label={t('reasonDialog.label')}
            value={reason}
            maxLength={500}
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
              if (reasonFor) send(reasonFor, reason.trim())
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
