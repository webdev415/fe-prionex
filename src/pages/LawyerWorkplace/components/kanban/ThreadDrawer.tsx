import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useLegalDrawerThread,
  type LegalKanbanTaskPatch,
  type LegalLawyer,
  type LegalLetterType,
} from '@/features/lawyerWorkplace'
import { useLegalProfileTimezone } from '@/features/lawyerWorkplace/hooks/useLegalProfileTimezone'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import { EmailThreadPanel } from '../thread/EmailThreadPanel'
import { LetterContextPanel } from '../thread/LetterContextPanel'
import { KanbanTaskDetailPanel } from './KanbanTaskDetailPanel'
import { KanbanTaskActionsMenuItems } from './KanbanTaskEditMenus'

export interface KanbanThreadDrawerTarget {
  letterId: string | null
  task: KanbanTask
}

interface ThreadDrawerProps {
  target: KanbanThreadDrawerTarget | null
  letterTypes?: LegalLetterType[]
  lawyers?: LegalLawyer[]
  /** Active letter types offered in the change-type menu. */
  editableLetterTypes?: LegalLetterType[]
  onClose: () => void
  onMoveTask?: (taskId: string, columnId: KanbanColumnId) => void
  onTaskUpdate?: (taskId: string, patch: LegalKanbanTaskPatch) => void
}

/** A task whose letters were grouped (same client + lawyer + day) shows a merged thread. */
function isGroupedTask(task: KanbanTask): boolean {
  return task.letterCount > 1 && task.legalTaskId > 0
}

function ThreadDrawerContent({ task }: { task: KanbanTask }) {
  const { t } = useTranslation('common')
  const [replyDraft, setReplyDraft] = useState('')
  const [contextOpen, setContextOpen] = useState(false)
  const { letter, isLoading, isError } = useLegalDrawerThread({
    legalTaskId: task.legalTaskId,
    fallbackLetterId: task.letterId,
    letterCount: task.letterCount,
    assignedUserId: task.assigneeUserId,
    replyDraft,
  })

  return (
    <div className="relative flex h-full min-h-0">
      {/* Left — email thread + composer (fills; the context rail takes the rest on desktop). */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <EmailThreadPanel
          letter={letter}
          isLoading={isLoading}
          isError={isError}
          replyDraft={replyDraft}
          onReplyDraftChange={setReplyDraft}
        />
      </div>

      {/* Right — read-only context rail (desktop side column). */}
      {letter && (
        <aside className="border-border hidden min-h-0 w-[360px] shrink-0 overflow-hidden border-l lg:block">
          <LetterContextPanel letter={letter} task={task} />
        </aside>
      )}

      {/* Mobile — the rail is behind a toggle instead of a side column. */}
      {letter && (
        <>
          <button
            type="button"
            onClick={() => setContextOpen(true)}
            className="border-border bg-card text-foreground hover:bg-muted absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm lg:hidden"
          >
            <Icons.Info size={13} strokeWidth={1.5} className="text-muted-foreground" />
            {t('pages.lawyerWorkplace.context.openContext', 'Context')}
          </button>

          {contextOpen && (
            <div className="bg-card absolute inset-0 z-20 flex flex-col lg:hidden">
              <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
                <span className="text-foreground text-[13px] font-medium">
                  {t('pages.lawyerWorkplace.context.title', 'Letter context')}
                </span>
                <button
                  type="button"
                  onClick={() => setContextOpen(false)}
                  aria-label={t('pages.lawyerWorkplace.context.close', 'Close context')}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                >
                  <Icons.Cancel01 size={18} strokeWidth={1.5} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <LetterContextPanel letter={letter} task={task} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ThreadDrawer({
  target,
  letterTypes = [],
  lawyers = [],
  editableLetterTypes = [],
  onClose,
  onMoveTask,
  onTaskUpdate,
}: ThreadDrawerProps) {
  const { t } = useTranslation('common')
  const timezone = useLegalProfileTimezone()
  const isOpen = target !== null
  const task = target?.task ?? null
  const letterId = target?.letterId ?? null
  const isGroup = task ? isGroupedTask(task) : false
  const showThread = isOpen && task != null && (letterId != null || isGroup)
  const showTaskOnly = isOpen && task != null && letterId == null && !isGroup
  const isTaskActive = task != null && task.columnId !== 'completed'

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label={t('pages.lawyerWorkplace.thread.closeThread', 'Close thread')}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'bg-card fixed inset-y-0 right-0 z-50 flex w-full flex-col shadow-2xl transition-transform duration-200 ease-out sm:w-[85vw]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!isOpen}
      >
        <div className="bg-card border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
          <span className="text-foreground text-[13px] font-medium">
            {showTaskOnly
              ? t('pages.lawyerWorkplace.kanban.taskDetails', 'Task details')
              : t('pages.lawyerWorkplace.kanban.emailThread', 'Email thread')}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Explicit status action — lawyers never found the card's kebab menu.
                Task-only mode renders its own button inside the detail panel. */}
            {task && isTaskActive && showThread && onMoveTask && task.columnId !== 'in_progress' ? (
              <Button
                type="button"
                variant="primary"
                size="xs"
                onClick={() => onMoveTask(task.id, 'in_progress')}
              >
                <Icons.ArrowRight size={13} strokeWidth={1.8} />
                {t('pages.lawyerWorkplace.kanban.startWork', 'Передати в роботу')}
              </Button>
            ) : null}
            {/* Thread view has no inline field editors — offer the full task menu here. */}
            {task && isTaskActive && showThread && (onMoveTask || onTaskUpdate) ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-primary-500 hover:bg-muted flex h-7 w-7 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2"
                    title={t('pages.lawyerWorkplace.kanban.moreOptions', 'More options')}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="2" cy="7" r="1.4" />
                      <circle cx="7" cy="7" r="1.4" />
                      <circle cx="12" cy="7" r="1.4" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[190px] p-1.5">
                  <KanbanTaskActionsMenuItems
                    task={task}
                    lawyers={lawyers}
                    editableLetterTypes={editableLetterTypes}
                    timezone={timezone}
                    onMoveTask={onMoveTask}
                    onTaskUpdate={onTaskUpdate}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('pages.lawyerWorkplace.thread.closeThread', 'Close thread')}
              className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 w-7 items-center justify-center rounded-md transition-colors"
            >
              <Icons.Cancel01 size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {showThread && task ? <ThreadDrawerContent key={task.taskId} task={task} /> : null}
          {showTaskOnly && task ? (
            <KanbanTaskDetailPanel
              task={task}
              letterTypes={letterTypes}
              lawyers={lawyers}
              editableLetterTypes={editableLetterTypes}
              onMoveTask={onMoveTask}
              onTaskUpdate={onTaskUpdate}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}
