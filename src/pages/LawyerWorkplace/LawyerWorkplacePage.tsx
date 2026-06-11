/**
 * Lawyer Workplace (KAN-486)
 *
 * Initial UI shell matching the Figma inbox layout:
 * incoming list | email thread | letter parameters panel.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { IncomingListPanel } from './components/inbox/IncomingListPanel'
import { EmailThreadPanel } from './components/thread/EmailThreadPanel'
import { LetterParametersPanel } from './components/parameters/LetterParametersPanel'
import { LegalKanbanPlaceholder } from './components/kanban/LegalKanbanPlaceholder'
import { PlaceholderTab } from './components/PlaceholderTab'
import { getLetterDetail, MOCK_LETTERS } from './mockData'
import type { IncomingFolder, IncomingMailboxFilter, LawyerWorkplaceTab } from './types'

const WORKPLACE_TABS: LawyerWorkplaceTab[] = ['inbox', 'kanban', 'documents', 'settings']

function isWorkplaceTab(value: string | null): value is LawyerWorkplaceTab {
  return value !== null && (WORKPLACE_TABS as string[]).includes(value)
}

export function LawyerWorkplacePage() {
  const { t } = useTranslation('common')
  const [searchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab: LawyerWorkplaceTab = isWorkplaceTab(rawTab) ? rawTab : 'inbox'

  const [activeFolder, setActiveFolder] = useState<IncomingFolder>('inbox')
  const [activeFilter, setActiveFilter] = useState<IncomingMailboxFilter>('all')
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(
    MOCK_LETTERS[0]?.id ?? null
  )
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
  }

  return (
    // Fixed-height column flush against the 60px header (no gap).
    // -mt-[20px] cancels the extra 20px in main's pt-[80px] (header = 60px).
    // Height is calc(100vh-60px) so the page still ends at the viewport bottom.
    // -mx/-mb cancel horizontal and bottom DashboardLayout padding.
    <div className="-mx-4 -mt-[20px] -mb-4 flex h-[calc(100vh-60px)] flex-col overflow-hidden sm:-mx-6 sm:-mb-6 lg:-mx-[28px] lg:-mb-[20px]">
      {/* ── Panels (flex-1 so they fill all space above the footer) ─── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'inbox' && (
          <div className="flex h-full overflow-hidden">
            <div className="h-full w-[28%] shrink-0">
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

            <EmailThreadPanel
              letter={selectedLetter}
              replyDraft={replyDraft}
              onReplyDraftChange={setReplyDraft}
              markAsNbuResponse={markAsNbuResponse}
              onMarkAsNbuResponseChange={setMarkAsNbuResponse}
            />

            <LetterParametersPanel letter={selectedLetter} />
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
        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-5 py-2">
          <div className="text-light-700 flex items-center gap-2 text-[11px]">
            <span className="bg-success-700 h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
            <span>{t('pages.lawyerWorkplace.footer.syncHint', 'Email Service · sync hourly')}</span>
            <span className="text-gray-300">|</span>
            <span>{t('pages.lawyerWorkplace.footer.mailboxes', '6 mailboxes connected')}</span>
          </div>
          <span className="text-light-700 text-[11px]">
            {t('pages.lawyerWorkplace.version', 'v0.7.18')}
          </span>
        </div>
      )}
    </div>
  )
}
