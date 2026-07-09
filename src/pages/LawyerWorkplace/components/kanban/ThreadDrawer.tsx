import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLegalLetterDetail } from '@/features/lawyerWorkplace'
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

export function ThreadDrawer({ target, onClose }: ThreadDrawerProps) {
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
          'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-200 ease-out sm:w-[min(640px,92vw)]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <span className="text-dark-500 text-[13px] font-medium">
            {showTaskOnly
              ? t('pages.lawyerWorkplace.kanban.taskDetails', 'Task details')
              : t('pages.lawyerWorkplace.kanban.emailThread', 'Email thread')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('pages.lawyerWorkplace.thread.closeThread', 'Close thread')}
            className="text-light-700 hover:text-dark-500 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
          >
            <Icons.Cancel01 size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isOpen && letterId ? <ThreadDrawerContent key={letterId} letterId={letterId} /> : null}
          {showTaskOnly ? <KanbanTaskDetailPanel task={target.task} /> : null}
        </div>
      </div>
    </>
  )
}
