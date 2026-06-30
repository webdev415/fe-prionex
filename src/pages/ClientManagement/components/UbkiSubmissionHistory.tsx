/**
 * UBKI Submission History
 *
 * Collapsible section on the client card's Loans tab listing the client's
 * outbound UBKI (credit bureau) submission attempts. Data comes from the
 * shared `useUbkiLogs` hook (GET /api/v1/ubki/logs); the backend already
 * project-scopes the rows, so here we only narrow them to the client's own
 * loans by `debt_id`.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/formatters'
import { useUbkiLogs, type UbkiLogEntry } from '@/features/ubki'

interface UbkiSubmissionHistoryProps {
  clientId: number
  /** The client's loans: internal debt `id` + the human-facing `loanNumber`
   *  (contract_number). Used to scope the log rows AND to show the loan number
   *  instead of the internal debt_id. */
  loans: { id: number; loanNumber: string }[]
}

const STATUS_COLORS: Record<UbkiLogEntry['status'], string> = {
  success: 'text-green-600',
  skipped: 'text-gray-400',
  error: 'text-red-600',
}

export function UbkiSubmissionHistory({ clientId, loans }: UbkiSubmissionHistoryProps) {
  const { t } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)

  // The history is rendered regardless of clientId but only fetched when the
  // client is valid. `clientId` is part of the props purely so callers pass an
  // explicit scope; filtering is by `debt_id` against the client's loans.
  // Results from bulk submissions now arrive asynchronously (background job),
  // so poll every 5s while the panel is open to surface newly-completed rows.
  const { data: logs, isLoading } = useUbkiLogs({ limit: 100 }, clientId > 0, isOpen ? 5000 : false)

  // debt_id -> human loan number (contract_number). The log stores the internal
  // debt_id; operators recognise the loan number, so display that.
  const loanNumberById = new Map(loans.map((l) => [l.id, l.loanNumber]))
  const entries = (logs ?? []).filter((entry) => loanNumberById.has(entry.debt_id))

  const renderResult = (entry: UbkiLogEntry) => {
    if (entry.status === 'success') {
      return entry.ubki_request_id ?? '-'
    }
    const code = entry.error_code ?? ''
    const message = entry.error_message ?? ''
    if (code && message) return `${code}: ${message}`
    return code || message || '-'
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-sm">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium text-[#05040D] transition-colors hover:bg-[#F9FAF8]"
      >
        <Icons.ArrowRight
          size={16}
          strokeWidth={2}
          className={cn('shrink-0 transition-transform', isOpen ? 'rotate-90' : '')}
        />
        <span className="text-sm">
          {t('pages.clients.detail.ubki.history.title', 'UBKI submission history')}
        </span>
        <span className="ml-auto text-sm font-normal text-[#374151]">{entries.length}</span>
      </button>

      {isOpen && (
        <div className="border-t border-[#EBECE8]">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-[#6B7280]">
              {t('common.loading', 'Loading...')}
            </div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#6B7280]">
              {t('pages.clients.detail.ubki.history.empty', 'No UBKI submissions yet.')}
            </div>
          ) : (
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[170px]" />
                <col className="w-[100px]" />
                <col className="w-[110px]" />
                <col className="w-[110px]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-[#EBECE8] text-xs font-medium text-[#05040D]">
                  <th className="px-3 py-2">
                    {t('pages.clients.detail.ubki.history.headers.date', 'Date')}
                  </th>
                  <th className="px-3 py-2">
                    {t('pages.clients.detail.ubki.history.headers.loan', 'Loan')}
                  </th>
                  <th className="px-3 py-2">
                    {t('pages.clients.detail.ubki.history.headers.mode', 'Mode')}
                  </th>
                  <th className="px-3 py-2">
                    {t('pages.clients.detail.ubki.history.headers.status', 'Status')}
                  </th>
                  <th className="px-3 py-2">
                    {t('pages.clients.detail.ubki.history.headers.result', 'Result')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[#EBECE8] last:border-b-0 hover:bg-[#F9FAF8]"
                  >
                    <td className="px-3 py-2 text-sm text-[#6B7280]">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-3 py-2 text-sm text-[#05040D]">
                      {loanNumberById.get(entry.debt_id) ?? entry.debt_id}
                    </td>
                    <td className="px-3 py-2 text-sm text-[#6B7280]">{entry.mode}</td>
                    <td className="px-3 py-2">
                      <span className={cn('text-sm font-medium', STATUS_COLORS[entry.status])}>
                        {entry.status}
                      </span>
                    </td>
                    <td
                      className="truncate px-3 py-2 text-sm text-[#6B7280]"
                      title={renderResult(entry)}
                    >
                      {renderResult(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
