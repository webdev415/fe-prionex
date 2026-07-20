import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig, SettingsMailbox } from '../../../settings/types'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [5, 10, 20]

interface MailboxesTableProps {
  mailboxes: SettingsMailbox[]
  letterTypes: LetterTypeConfig[]
  onEdit: (mailbox: SettingsMailbox) => void
  onToggleStatus: (mailbox: SettingsMailbox) => void
  onAddMailbox: () => void
  onTestSync: () => Promise<void>
  isPolling?: boolean
  readOnly?: boolean
}

export function MailboxesTable({
  mailboxes,
  letterTypes: _letterTypes,
  onEdit,
  onToggleStatus,
  onAddMailbox,
  onTestSync,
  isPolling = false,
  readOnly = false,
}: MailboxesTableProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const totalPages = mailboxes.length > 0 ? Math.ceil(mailboxes.length / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1

  const paginatedMailboxes = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return mailboxes.slice(start, start + pageSize)
  }, [mailboxes, currentPage, pageSize])

  const getStatusClass = (status: SettingsMailbox['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-success-100 text-success-700'
      case 'error':
        return 'bg-error-100 text-error-700'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const isEmpty = mailboxes.length === 0

  return (
    <div className="bg-card border-border min-w-0 overflow-hidden rounded-xl border">
      <div
        className={cn(
          'border-border flex gap-3 border-b px-4 py-4 sm:px-5 lg:px-6',
          isCompact ? 'flex-col' : 'flex-row items-center justify-between'
        )}
      >
        <div className="min-w-0">
          <h2 className="text-foreground text-[13px] font-semibold">
            {t('pages.lawyerWorkplace.settings.mailboxes.tableTitle', {
              count: mailboxes.length,
              defaultValue: `Connected mailboxes · ${mailboxes.length}`,
            })}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-[11.5px]">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.tableDesc',
              'Manage addresses and routing rules'
            )}
          </p>
        </div>
        <div className={cn('flex shrink-0 items-center gap-2', isCompact && 'w-full')}>
          {!readOnly && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Icons.Reload size={16} strokeWidth={1.5} />}
                className={cn('h-9 rounded-md', isCompact && 'flex-1')}
                disabled={isPolling || isEmpty}
                onClick={() => void onTestSync()}
              >
                {isPolling
                  ? t('pages.lawyerWorkplace.settings.mailboxes.testSyncRunning', 'Syncing…')
                  : t('pages.lawyerWorkplace.settings.mailboxes.testSync', 'Test sync')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
                onClick={onAddMailbox}
                className={cn('h-9 rounded-md', isCompact && 'flex-1')}
              >
                {t('pages.lawyerWorkplace.settings.mailboxes.addMailbox', 'Add mailbox')}
              </Button>
            </>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.Mail size={22} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <p className="text-foreground text-[14px] font-medium">
            {t('pages.lawyerWorkplace.settings.mailboxes.empty.title', 'No mailboxes connected')}
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.empty.description',
              'Add a mailbox to start syncing incoming legal correspondence.'
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="data-table-scroll w-full overflow-x-auto overflow-y-hidden pb-2">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-border border-b">
                  <th
                    className={cn(
                      'text-muted-foreground py-3 text-[11px] font-medium',
                      isCompact ? 'px-4' : 'px-5'
                    )}
                  >
                    {t('pages.lawyerWorkplace.settings.mailboxes.columns.mailbox', 'Mailbox')}
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-[11px] font-medium">
                    {t('pages.lawyerWorkplace.settings.status', 'Status')}
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-[11px] font-medium">
                    {t('pages.lawyerWorkplace.settings.mailboxes.columns.letters', 'Letters')}
                  </th>
                  <th className="text-muted-foreground px-4 py-3 text-[11px] font-medium">
                    {t('pages.lawyerWorkplace.settings.mailboxes.columns.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMailboxes.map((mailbox, idx) => {
                  return (
                    <tr
                      key={mailbox.id}
                      className={cn(
                        idx < paginatedMailboxes.length - 1 && 'border-border border-b'
                      )}
                    >
                      <td className={cn('py-4', isCompact ? 'px-4' : 'px-5')}>
                        <div className="min-w-[180px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-foreground text-[13px] font-semibold">
                              {t(mailbox.displayNameKey, mailbox.displayNameFallback)}
                            </p>
                            {!mailbox.hasCredentials ? (
                              <span
                                className="bg-warning-100 text-warning-700 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                title={t(
                                  'pages.lawyerWorkplace.settings.mailboxes.noCredentials',
                                  'No credentials configured — sync and sending will fail'
                                )}
                              >
                                <Icons.Warning size={10} strokeWidth={2} />
                                {t(
                                  'pages.lawyerWorkplace.settings.mailboxes.noCredentialsShort',
                                  'No credentials'
                                )}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {mailbox.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap capitalize',
                            getStatusClass(mailbox.status)
                          )}
                        >
                          {t(
                            `pages.lawyerWorkplace.settings.mailboxes.status.${mailbox.status}`,
                            mailbox.status
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-foreground font-semibold">{mailbox.letterCount}</span>
                      </td>
                      <td className="px-4 py-4">
                        {!readOnly ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(mailbox)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-full"
                              aria-label={t('actions.edit', 'Edit')}
                            >
                              <Icons.PencilEdit02 size={15} strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleStatus(mailbox)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-full"
                              aria-label={
                                mailbox.status === 'disabled'
                                  ? t('actions.enable', 'Enable')
                                  : t('actions.disable', 'Disable')
                              }
                            >
                              {mailbox.status === 'disabled' ? (
                                <Icons.Tick02 size={15} strokeWidth={1.5} />
                              ) : (
                                <Icons.Cancel01 size={15} strokeWidth={1.5} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[12px]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              className={cn('border-border border-t px-4 sm:px-5 lg:px-6', isCompact && 'py-3')}
            />
          )}
        </>
      )}
    </div>
  )
}
