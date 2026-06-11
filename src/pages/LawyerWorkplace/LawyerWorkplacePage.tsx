/**
 * Lawyer Workplace (KAN-486)
 *
 * Initial UI shell matching the Figma inbox layout:
 * incoming list | email thread | letter parameters panel.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { IncomingListPanel } from './components/inbox/IncomingListPanel'
import { EmailThreadPanel } from './components/thread/EmailThreadPanel'
import { LetterParametersPanel } from './components/parameters/LetterParametersPanel'
import { LegalKanbanPlaceholder } from './components/kanban/LegalKanbanPlaceholder'
import { PlaceholderTab } from './components/PlaceholderTab'
import { getLetterDetail, MOCK_LETTERS } from './mockData'
import type { IncomingFolder, IncomingMailboxFilter, LawyerWorkplaceTab } from './types'

const WORKPLACE_TABS: LawyerWorkplaceTab[] = ['inbox', 'kanban', 'documents', 'settings']

type InboxPane = 'list' | 'thread' | 'parameters'

function isWorkplaceTab(value: string | null): value is LawyerWorkplaceTab {
  return value !== null && (WORKPLACE_TABS as string[]).includes(value)
}

export function LawyerWorkplacePage() {
  const { t } = useTranslation('common')
  const [searchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab: LawyerWorkplaceTab = isWorkplaceTab(rawTab) ? rawTab : 'inbox'

  const isCompactInbox = useMediaQuery('(max-width: 1023px)')
  const isDesktopThreeCol = useMediaQuery('(min-width: 1280px)')

  const [activeFolder, setActiveFolder] = useState<IncomingFolder>('inbox')
  const [activeFilter, setActiveFilter] = useState<IncomingMailboxFilter>('all')
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(
    MOCK_LETTERS[0]?.id ?? null
  )
  const [inboxPane, setInboxPane] = useState<InboxPane>('list')
  const [replyDraft, setReplyDraft] = useState('')
  const [markAsNbuResponse, setMarkAsNbuResponse] = useState(false)

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
    }
    return items.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
  }, [activeFilter])

  const handleSelectLetter = (letterId: string) => {
    setSelectedLetterId(letterId)
    const detail = getLetterDetail(letterId)
    setReplyDraft(detail?.replyDraft ?? '')
    if (isCompactInbox) {
      setInboxPane('thread')
    }
  }

  const closeParameters = () => setInboxPane('thread')

  return (
    // Fixed-height column flush against the 60px header (no gap).
    // -mt-[20px] cancels the extra 20px in main's pt-[80px] (header = 60px).
    // Height is calc(100vh-60px) so the page still ends at the viewport bottom.
    // -mx/-mb cancel horizontal and bottom DashboardLayout padding.
    <div className="-mx-4 -mt-[20px] -mb-4 flex h-[calc(100vh-60px)] flex-col overflow-hidden sm:-mx-6 sm:-mb-6 lg:-mx-[28px] lg:-mb-[20px]">
      {/* ── Panels (flex-1 so they fill all space above the footer) ─── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'inbox' && (
          <div className="relative flex h-full overflow-hidden">
            {/* Incoming list — full width on mobile, ~38% on tablet, 28% on desktop */}
            <div
              className={cn(
                'h-full shrink-0',
                'w-full lg:w-[38%] xl:w-[28%]',
                inboxPane !== 'list' && 'hidden lg:block'
              )}
            >
              <IncomingListPanel
                letters={filteredLetters}
                selectedLetterId={selectedLetterId}
                activeFolder={activeFolder}
                activeFilter={activeFilter}
                onFolderChange={setActiveFolder}
                onFilterChange={setActiveFilter}
                onSelectLetter={handleSelectLetter}
              />
            </div>

            {/* Email thread — hidden on mobile until a letter is selected */}
            <div
              className={cn(
                'min-h-0 flex-1 flex-col',
                inboxPane === 'thread' || !isCompactInbox ? 'flex' : 'hidden'
              )}
            >
              <EmailThreadPanel
                letter={selectedLetter}
                replyDraft={replyDraft}
                onReplyDraftChange={setReplyDraft}
                markAsNbuResponse={markAsNbuResponse}
                onMarkAsNbuResponseChange={setMarkAsNbuResponse}
                onBack={isCompactInbox ? () => setInboxPane('list') : undefined}
                onOpenParameters={!isDesktopThreeCol ? () => setInboxPane('parameters') : undefined}
              />
            </div>

            {/* Parameters — third column on xl+ */}
            {isDesktopThreeCol && (
              <div className="h-full w-[22%] shrink-0">
                <LetterParametersPanel letter={selectedLetter} />
              </div>
            )}

            {/* Parameters — full-screen pane on mobile */}
            {isCompactInbox && inboxPane === 'parameters' && (
              <div className="absolute inset-0 z-30 flex h-full w-full flex-col bg-white">
                <LetterParametersPanel letter={selectedLetter} onClose={closeParameters} />
              </div>
            )}

            {/* Parameters — slide-over on tablet (lg–xl) */}
            {!isCompactInbox && !isDesktopThreeCol && inboxPane === 'parameters' && (
              <>
                <button
                  type="button"
                  className="absolute inset-0 z-40 bg-black/20"
                  aria-label={t('pages.lawyerWorkplace.parameters.close', 'Close parameters')}
                  onClick={closeParameters}
                />
                <div className="absolute inset-y-0 right-0 z-50 w-[min(380px,92vw)] bg-white shadow-2xl">
                  <LetterParametersPanel letter={selectedLetter} onClose={closeParameters} />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'kanban' && (
          <div className="flex h-full overflow-hidden">
            <LegalKanbanPlaceholder />
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
          <div className="flex h-full overflow-hidden">
            <PlaceholderTab
              titleKey="pages.lawyerWorkplace.settings.title"
              titleFallback="Settings"
              descriptionKey="pages.lawyerWorkplace.settings.comingSoon"
              descriptionFallback="Letter type directory and mailbox settings — coming soon."
            />
          </div>
        )}
      </div>

      {/* ── Full-width footer bar (inbox tab only) ─────────────────── */}
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
