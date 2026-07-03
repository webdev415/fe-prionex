/**
 * Lawyer Workplace (KAN-486)
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useLegalLetterDetail, useMappedLegalInbox } from '@/features/lawyerWorkplace'
import { useCanAccessLegalKanban } from '@/features/lawyerWorkplace/hooks/useLegalPermissions'
import { IncomingListPanel } from './components/inbox/IncomingListPanel'
import { EmailThreadPanel } from './components/thread/EmailThreadPanel'
import { LetterParametersPanel } from './components/parameters/LetterParametersPanel'
import { LegalKanbanBoard } from './components/kanban/LegalKanbanBoard'
import { LegalDocumentsTab } from './components/documents/LegalDocumentsTab'
import { LawyerWorkspaceBanner } from './components/LawyerWorkspaceBanner'
import { LegalSettingsTab } from './components/settings/LegalSettingsTab'
import { NewOutgoingLetterModal } from './components/thread/NewOutgoingLetterModal'
import { LawyerWorkplaceLayoutProvider } from './context/LawyerWorkplaceLayoutProvider'
import { useLawyerWorkplaceLayout } from './context/lawyerWorkplaceLayout'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const canAccessKanban = useCanAccessLegalKanban()
  const rawTab = searchParams.get('tab')
  const activeTab: LawyerWorkplaceTab = isWorkplaceTab(rawTab) ? rawTab : 'inbox'

  useEffect(() => {
    if (activeTab === 'kanban' && !canAccessKanban) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'inbox')
      setSearchParams(next, { replace: true })
    }
  }, [activeTab, canAccessKanban, searchParams, setSearchParams])

  const [activeFolder, setActiveFolder] = useState<IncomingFolder>('inbox')
  const [activeFilter, setActiveFilter] = useState<IncomingMailboxFilter>('all')
  const [inboxPage, setInboxPage] = useState(1)
  const [committedSearch, setCommittedSearch] = useState('')
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null)
  const [inboxPane, setInboxPane] = useState<InboxPane>('list')
  const [replyDraft, setReplyDraft] = useState('')
  const [newLetterOpen, setNewLetterOpen] = useState(false)

  const handleFolderChange = (folder: IncomingFolder) => {
    setActiveFolder(folder)
    setActiveFilter('all')
    setInboxPage(1)
    setCommittedSearch('')
  }

  const handleFilterChange = (filter: IncomingMailboxFilter) => {
    setActiveFilter(filter)
    setInboxPage(1)
  }

  const handleSearchCommit = (query: string) => {
    setCommittedSearch(query)
    setInboxPage(1)
  }

  const {
    letters: filteredLetters,
    unprocessedCount,
    connectedMailboxes,
    total: inboxTotal,
    totalPages: inboxTotalPages,
    countAll,
    countNew,
    countInProgress,
    countDone,
    isLoading: inboxLoading,
    isError: inboxError,
    refetch: refetchInbox,
  } = useMappedLegalInbox({
    activeFolder,
    activeFilter,
    page: inboxPage,
    searchQuery: committedSearch,
    enabled: activeTab === 'inbox',
  })

  const activeLetterId = useMemo(() => {
    if (inboxLoading || filteredLetters.length === 0) return null
    if (selectedLetterId && filteredLetters.some((letter) => letter.id === selectedLetterId)) {
      return selectedLetterId
    }
    return filteredLetters[0]?.id ?? null
  }, [filteredLetters, inboxLoading, selectedLetterId])

  const listFallback = useMemo(
    () => filteredLetters.find((letter) => letter.id === activeLetterId) ?? null,
    [activeLetterId, filteredLetters]
  )

  const {
    letter: selectedLetter,
    isLoading: detailLoading,
    isError: detailError,
  } = useLegalLetterDetail(activeLetterId, {
    enabled: activeTab === 'inbox',
    includeQuarantined: activeFolder === 'quarantine',
    replyDraft,
    listFallback,
  })

  const handleSelectLetter = (letterId: string) => {
    setSelectedLetterId(letterId)
    if (isCompact) {
      setInboxPane('thread')
    }
  }

  const closeParameters = () => setInboxPane('thread')

  const handleConfirmLetter = (_letterId: string) => {
    closeParameters()
  }

  const showParametersPanel = selectedLetter !== null

  return (
    <div
      ref={layoutRef}
      className={cn(
        '-mx-4 -mt-[20px] -mb-4 flex min-w-0 flex-col sm:-mx-6 sm:-mb-6 lg:-mx-[28px] lg:-mb-[20px]',
        activeTab !== 'documents' &&
          activeTab !== 'settings' &&
          'h-[calc(100vh-60px)] overflow-hidden'
      )}
    >
      <NewOutgoingLetterModal
        open={newLetterOpen}
        onClose={() => setNewLetterOpen(false)}
        onSent={(messageId) => {
          setSelectedLetterId(messageId)
          setReplyDraft('')
          if (isCompact) {
            setInboxPane('thread')
          }
        }}
      />
      <div
        className={cn(
          activeTab !== 'documents' &&
            activeTab !== 'settings' &&
            'flex min-h-0 flex-1 flex-col overflow-hidden'
        )}
      >
        {activeTab === 'inbox' && (
          <div
            className={cn(
              'relative h-full min-w-0 overflow-hidden',
              isWide
                ? showParametersPanel
                  ? 'grid grid-cols-[minmax(0,28%)_minmax(0,1fr)_minmax(0,22%)]'
                  : 'grid grid-cols-[minmax(0,28%)_minmax(0,1fr)]'
                : 'flex min-w-0'
            )}
          >
            <div
              className={cn(
                'h-full min-w-0 overflow-hidden',
                isCompact ? 'w-full' : !isWide && 'w-[38%] shrink-0',
                inboxPane !== 'list' && isCompact && 'hidden'
              )}
            >
              <IncomingListPanel
                letters={filteredLetters}
                selectedLetterId={activeLetterId}
                activeFolder={activeFolder}
                activeFilter={activeFilter}
                unprocessedCount={unprocessedCount}
                isLoading={inboxLoading}
                isError={inboxError}
                onRetry={() => void refetchInbox()}
                page={inboxPage}
                totalPages={inboxTotalPages}
                total={inboxTotal}
                countAll={countAll}
                countNew={countNew}
                countInProgress={countInProgress}
                countDone={countDone}
                committedSearch={committedSearch}
                onFolderChange={handleFolderChange}
                onFilterChange={handleFilterChange}
                onPageChange={setInboxPage}
                onSearchCommit={handleSearchCommit}
                onSelectLetter={handleSelectLetter}
                onNewLetter={() => setNewLetterOpen(true)}
              />
            </div>

            <div
              className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                inboxPane === 'thread' || !isCompact ? 'flex' : 'hidden'
              )}
            >
              <EmailThreadPanel
                letter={selectedLetter}
                isLoading={detailLoading}
                isError={detailError}
                replyDraft={replyDraft}
                onReplyDraftChange={setReplyDraft}
                onBack={isCompact ? () => setInboxPane('list') : undefined}
                onOpenParameters={
                  !isWide && showParametersPanel ? () => setInboxPane('parameters') : undefined
                }
              />
            </div>

            {isWide && showParametersPanel && (
              <div className="h-full min-w-0 overflow-hidden">
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

        {activeTab === 'kanban' && canAccessKanban && (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <LegalKanbanBoard />
            <LawyerWorkspaceBanner />
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="relative">
            <LegalDocumentsTab />
            <LawyerWorkspaceBanner />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="relative">
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
                count: connectedMailboxes,
                defaultValue: '{{count}} mailboxes connected',
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
