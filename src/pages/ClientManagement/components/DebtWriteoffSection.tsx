/**
 * Per-loan write-off list — KAN-245.
 *
 * Renders the active write-off entries for ONE loan with per-row
 * Cancel + Edit affordances. There is NO Create button here —
 * creation is the client-scoped flow launched from the Loans-tab
 * "Write-off" button next to "RR Connect" (see ClientDetailPage).
 *
 * Permission gating (REQUIREMENTS §7.2):
 * - The component itself requires ``view_writeoffs``; the caller
 *   should gate rendering accordingly.
 * - Per-row "Cancel" → ``cancel_writeoffs``.
 * - Per-row "Edit"   → ``edit_writeoffs``.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import { useWriteoffsForDebt } from '@/features/writeoffs/hooks/useWriteoffs'
import type { WriteoffEntry } from '@/features/writeoffs/api/types'
import { WriteoffCancelDialog } from './WriteoffCancelDialog'
import { WriteoffEditDialog } from './WriteoffEditDialog'

export interface DebtWriteoffSectionProps {
  debtId: number
  /** When false, hides the section header — useful for embedding inside a card. */
  showHeader?: boolean
}

export function DebtWriteoffSection({ debtId, showHeader = true }: DebtWriteoffSectionProps) {
  const { t, i18n } = useTranslation('common')
  const canCancel = useHasPermission(PERMISSIONS.WRITEOFFS.CANCEL)
  const canEdit = useHasPermission(PERMISSIONS.WRITEOFFS.EDIT)

  const [tab, setTab] = useState<'active' | 'cancelled'>('active')
  const { data, isLoading, error } = useWriteoffsForDebt(debtId, { status: tab })

  const [cancelTarget, setCancelTarget] = useState<WriteoffEntry | null>(null)
  const [editTarget, setEditTarget] = useState<WriteoffEntry | null>(null)

  const entries = data?.items ?? []
  const dateLocale = i18n.language === 'uk' ? 'uk-UA' : 'en-US'

  return (
    <div className="flex flex-col gap-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-base font-semibold">
            {t('pages.clients.detail.writeOffSection.title')}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded px-3 py-1 text-xs ${
                tab === 'active'
                  ? 'bg-primary-600 text-white'
                  : 'bg-muted text-foreground hover:bg-muted'
              }`}
              onClick={() => setTab('active')}
            >
              {t('pages.clients.detail.writeOffSection.tabActive')}
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-xs ${
                tab === 'cancelled'
                  ? 'bg-primary-600 text-white'
                  : 'bg-muted text-foreground hover:bg-muted'
              }`}
              onClick={() => setTab('cancelled')}
            >
              {t('pages.clients.detail.writeOffSection.tabCancelled')}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">{t('common.loading')}</p>}
      {error && (
        <p className="text-error-500 text-sm">
          {t('pages.clients.detail.writeOffSection.loadError')}
        </p>
      )}
      {!isLoading && !error && entries.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {tab === 'active'
            ? t('pages.clients.detail.writeOffSection.noActiveEntries')
            : t('pages.clients.detail.writeOffSection.noCancelledEntries')}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-border flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between md:gap-4"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-foreground text-sm font-semibold">
                    {t(`pages.clients.detail.writeOffModal.components.${entry.accrual_type}`)}
                  </span>
                  <span className="text-foreground text-sm font-medium">
                    {formatMoneyUAHTwoDecimals(Number(entry.amount))}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('pages.clients.detail.writeOffSection.expiresOn')}{' '}
                  {new Date(entry.cancellation_date).toLocaleDateString(dateLocale)}
                  {' • '}
                  {t('pages.clients.detail.writeOffSection.createdBy')}{' '}
                  {entry.created_by.name ?? `#${entry.created_by.user_id}`}
                </p>
                {entry.notes && (
                  <p className="text-muted-foreground text-xs italic">{entry.notes}</p>
                )}
                {entry.status === 'cancelled' && (
                  <p className="text-muted-foreground text-xs">
                    {t(
                      `pages.clients.detail.writeOffSection.cancellationSource.${entry.cancellation_source ?? 'manual'}`
                    )}
                    {entry.cancellation_reason ? ` — ${entry.cancellation_reason}` : ''}
                  </p>
                )}
              </div>

              {entry.status === 'active' && (
                <div className="flex gap-2 md:flex-shrink-0">
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="xs"
                      leftIcon={<Icons.PencilEdit02 size={16} strokeWidth={1.5} />}
                      onClick={() => setEditTarget(entry)}
                    >
                      {t('common.edit')}
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="danger"
                      size="xs"
                      leftIcon={<Icons.Delete size={16} strokeWidth={2} />}
                      onClick={() => setCancelTarget(entry)}
                    >
                      {t('common.cancel')}
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {cancelTarget && (
        <WriteoffCancelDialog
          open={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          entry={cancelTarget}
        />
      )}
      {editTarget && (
        <WriteoffEditDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          entry={editTarget}
        />
      )}
    </div>
  )
}
