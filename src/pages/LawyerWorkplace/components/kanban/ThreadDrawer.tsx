import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLegalLetterDetail, type LegalLetterType } from '@/features/lawyerWorkplace'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanTask } from '../../kanban/kanbanData'
import { EmailThreadPanel } from '../thread/EmailThreadPanel'
import { KanbanTaskDetailPanel } from './KanbanTaskDetailPanel'

export interface KanbanThreadDrawerTarget {
  letterId: string | null
  task: KanbanTask
}

interface ThreadDrawerProps {
  target: KanbanThreadDrawerTarget | null
  letterTypes?: LegalLetterType[]
  onClose: () => void
}

function ThreadDrawerContent({ letterId }: { letterId: string }) {
  const [replyDraft, setReplyDraft] = useState('')
  const { letter, isLoading, isError } = useLegalLetterDetail(letterId, { replyDraft })

  return (
    <EmailThreadPanel
      letter={letter}
      isLoading={isLoading}
      isError={isError}
      replyDraft={replyDraft}
      onReplyDraftChange={setReplyDraft}
    />
  )
}

export function ThreadDrawer({ target, letterTypes = [], onClose }: ThreadDrawerProps) {
  const { t } = useTranslation('common')
  const isOpen = target !== null
  const letterId = target?.letterId ?? null
  const showTaskOnly = isOpen && !letterId && target != null

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
          'bg-card fixed inset-y-0 right-0 z-50 flex w-full flex-col shadow-2xl transition-transform duration-200 ease-out sm:w-[min(640px,92vw)]',
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
          <button
            type="button"
            onClick={onClose}
            aria-label={t('pages.lawyerWorkplace.thread.closeThread', 'Close thread')}
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          >
            <Icons.Cancel01 size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isOpen && letterId ? <ThreadDrawerContent key={letterId} letterId={letterId} /> : null}
          {showTaskOnly ? (
            <KanbanTaskDetailPanel task={target.task} letterTypes={letterTypes} />
          ) : null}
        </div>
      </div>
    </>
  )
}
