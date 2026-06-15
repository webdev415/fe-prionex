/**
 * Lawyer Workplace (KAN-486)
 *
 * Initial UI shell matching the Figma inbox layout:
 * incoming list | email thread | letter parameters panel.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { IncomingListPanel } from './components/inbox/IncomingListPanel'
import { EmailThreadPanel } from './components/thread/EmailThreadPanel'
import { LetterParametersPanel } from './components/parameters/LetterParametersPanel'
import { LegalKanbanBoard } from './components/kanban/LegalKanbanBoard'
import { LawyerWorkspaceBanner } from './components/LawyerWorkspaceBanner'
import { LegalSettingsTab } from './components/settings/LegalSettingsTab'
import { PlaceholderTab } from './components/PlaceholderTab'
import { NewOutgoingLetterModal } from './components/thread/NewOutgoingLetterModal'
import { LawyerWorkplaceLayoutProvider } from './context/LawyerWorkplaceLayoutProvider'
import { useLawyerWorkplaceLayout } from './context/lawyerWorkplaceLayout'
import { getLetterDetail, MOCK_LETTERS } from './mockData'
import type { IncomingFolder, IncomingMailboxFilter, LawyerWorkplaceTab } from './types'

const WORKPLACE_TABS: LawyerWorkplaceTab[] = ['inbox', 'kanban', 'documents', 'settings']

type InboxPane = 'list' | 'thread' | 'parameters'

function isWorkplaceTab(value: string | null): value is LawyerWorkplaceTab {
  return value !== null && (WORKPLACE_TABS as string[]).includes(value)
}

export function LawyerWorkplacePage() {
  return (
    <LawyerWorkplaceLayoutProvider>
      <LawyerWorkplacePageContent />
    </LawyerWorkplaceLayoutProvider>
  )
}

function LawyerWorkplacePageContent() {
  const { t } = useTranslation('common')
  const { ref: layoutRef, isCompact, isWide } = useLawyerWorkplaceLayout()
  const [searchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab: LawyerWorkplaceTab = isWorkplaceTab(rawTab) ? rawTab : 'inbox'

  const [activeFolder, setActiveFolder] = useState<IncomingFolder>('inbox')
  const [activeFilter, setActiveFilter] = useState<IncomingMailboxFilter>('all')
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(
    MOCK_LETTERS[0]?.id ?? null
  )
  const [inboxPane, setInboxPane] = useState<InboxPane>('list')
  const [replyDraft, setReplyDraft] = useState('')
  const [confirmedLetterIds, setConfirmedLetterIds] = useState<Set<string>>(new Set())
  const [newLetterOpen, setNewLetterOpen] = useState(false)

  const selectedLetter = useMemo(
    () => (selectedLetterId ? getLetterDetail(selectedLetterId) : null),
    [selectedLetterId]
  )

  const filteredLetters = useMemo(() => {
    let items = [...MOCK_LETTERS]
    if (activeFilter === 'new') {
      items = items.filter((l) => l.status === 'new')
    } else if (activeFilter === 'in_progress') {
      items = items.filter((l) => l.status === 'in_progress')
    } else if (activeFilter === 'done') {
      items = items.filter(
        (l) =>
          l.status === 'sent_to_kanban' || l.status === 'on_board' || l.status === 'auto_processed'
      )
    }
    return items.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
  }, [activeFilter])

  const unprocessedCount = useMemo(
    () => MOCK_LETTERS.filter((l) => l.isUnprocessed && !confirmedLetterIds.has(l.id)).length,
    [confirmedLetterIds]
  )

  const handleSelectLetter = (letterId: string) => {
    setSelectedLetterId(letterId)
    const detail = getLetterDetail(letterId)
    setReplyDraft(detail?.replyDraft ?? '')
    if (isCompact) {
      setInboxPane('thread')
    }
  }

  const handleConfirmLetter = (letterId: string) => {
    setConfirmedLetterIds((prev) => new Set([...prev, letterId]))
  }

  const closeParameters = () => setInboxPane('thread')

  const showParametersPanel = selectedLetter !== null && selectedLetter.status !== 'auto_processed'

  return (
    <div
      ref={layoutRef}
      className="-mx-4 -mt-[20px] -mb-4 flex h-[calc(100vh-60px)] min-w-0 flex-col overflow-hidden sm:-mx-6 sm:-mb-6 lg:-mx-[28px] lg:-mb-[20px]"
    >
      <NewOutgoingLetterModal open={newLetterOpen} onClose={() => setNewLetterOpen(false)} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'inbox' && (
          <div className="relative flex h-full overflow-hidden">
            <div
              className={cn(
                'h-full shrink-0',
                isCompact ? 'w-full' : isWide ? 'w-[28%]' : 'w-[38%]',
                inboxPane !== 'list' && isCompact && 'hidden'
              )}
            >
              <IncomingListPanel
                letters={filteredLetters}
                selectedLetterId={selectedLetterId}
                activeFolder={activeFolder}
                activeFilter={activeFilter}
                unprocessedCount={unprocessedCount}
                onFolderChange={setActiveFolder}
                onFilterChange={setActiveFilter}
                onSelectLetter={handleSelectLetter}
                onNewLetter={() => setNewLetterOpen(true)}
              />
            </div>

            <div
              className={cn(
                'min-h-0 flex-1 flex-col',
                inboxPane === 'thread' || !isCompact ? 'flex' : 'hidden'
              )}
            >
              <EmailThreadPanel
                letter={selectedLetter}
                replyDraft={replyDraft}
                onReplyDraftChange={setReplyDraft}
                onBack={isCompact ? () => setInboxPane('list') : undefined}
                onOpenParameters={
                  !isWide && showParametersPanel ? () => setInboxPane('parameters') : undefined
                }
              />
            </div>

            {isWide && showParametersPanel && (
              <div className="h-full w-[22%] shrink-0">
                <LetterParametersPanel letter={selectedLetter} onConfirm={handleConfirmLetter} />
              </div>
            )}

            {isCompact && inboxPane === 'parameters' && showParametersPanel && (
              <div className="absolute inset-0 z-30 flex h-full w-full flex-col bg-white">
                <LetterParametersPanel
                  letter={selectedLetter}
                  onClose={closeParameters}
                  onConfirm={handleConfirmLetter}
                />
              </div>
            )}

            {!isCompact && !isWide && inboxPane === 'parameters' && showParametersPanel && (
              <>
                <button
                  type="button"
                  className="absolute inset-0 z-40 bg-black/20"
                  aria-label={t('pages.lawyerWorkplace.parameters.close', 'Close parameters')}
                  onClick={closeParameters}
                />
                <div className="absolute inset-y-0 right-0 z-50 w-[min(380px,92%)] bg-white shadow-2xl">
                  <LetterParametersPanel
                    letter={selectedLetter}
                    onClose={closeParameters}
                    onConfirm={handleConfirmLetter}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'kanban' && (
          <div className="relative flex h-full min-h-0 flex-col">
            <LegalKanbanBoard />
            <LawyerWorkspaceBanner />
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="flex h-full overflow-hidden">
            <PlaceholderTab
              titleKey="pages.lawyerWorkplace.documents.title"
              titleFallback="Documents"
              descriptionKey="pages.lawyerWorkplace.documents.comingSoon"
              descriptionFallback="Document journal integration — coming soon."
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex h-full overflow-auto">
            <LegalSettingsTab />
          </div>
        )}
      </div>

      {activeTab === 'inbox' && (
        <div className="flex shrink-0 flex-col gap-1 border-t border-gray-100 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
          <div className="text-light-700 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px]">
            <span className="bg-success-700 h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
            <span>{t('pages.lawyerWorkplace.footer.syncHint', 'Email Service · sync hourly')}</span>
            <span className="hidden text-gray-300 sm:inline">|</span>
            <span className="min-w-0 truncate">
              {t('pages.lawyerWorkplace.footer.mailboxesCount', {
                count: 6,
                defaultValue: '6 mailboxes connected',
              })}
            </span>
          </div>
          <span className="text-light-700 hidden shrink-0 text-[11px] sm:inline">
            {t('pages.lawyerWorkplace.version', 'v0.7.18')}
          </span>
        </div>
      )}
    </div>
  )
}
