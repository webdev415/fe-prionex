import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { getMessagingServiceLabel, messagingStatusForCallLogCard } from '@/features/messaging'
import { formatDateTime } from '@/lib/formatters'

export interface ViewMessageModalProps {
  open: boolean
  onClose: () => void
  messageData: {
    campaignName: string
    campaignCode: string
    source: string
    channel: string
    service: string
    launchedBy?: string
    destination: string
    destinationOwner?: string
    status: string
    body: string
    subject?: string
    sentAt?: string | null
    deliveredAt?: string | null
    failedAt?: string | null
    errorMessage?: string | null
  } | null
}

function formatSourceLabel(source: string, t: ReturnType<typeof useTranslation>['t']) {
  const normalized = source.trim().toLowerCase()
  if (normalized === 'single') {
    return t('pages.clients.modals.viewMessage.sourceSingle', { defaultValue: 'Single' })
  }
  if (normalized === 'bulk') {
    return t('pages.clients.modals.viewMessage.sourceBulk', { defaultValue: 'Bulk' })
  }
  return source
    .split('_')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ')
}

function statusBadgeClasses(displayStatus: ReturnType<typeof messagingStatusForCallLogCard>) {
  switch (displayStatus) {
    case 'Delivered':
      return {
        wrap: 'bg-success-50 text-success-800 ring-success-200/60',
        dot: 'bg-success-500',
      }
    case 'Failed':
      return {
        wrap: 'bg-error-50 text-error-800 ring-error-200/60',
        dot: 'bg-error-500',
      }
    case 'Sent':
      return {
        wrap: 'bg-primary/10 text-primary-700 ring-secondary-800/20',
        dot: 'bg-primary-600',
      }
    case 'Skipped':
      return {
        wrap: 'bg-muted text-foreground ring-border',
        dot: 'bg-muted-foreground',
      }
    default:
      return {
        wrap: 'bg-warning-50 text-warning-800 ring-warning-200/60',
        dot: 'bg-warning-500',
      }
  }
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-6">
      <span className="text-foreground text-muted-foreground w-full shrink-0 text-xs font-light tracking-wide sm:w-[7.5rem] sm:text-sm">
        {label}
      </span>
      <div className="text-foreground min-w-0 flex-1 text-sm leading-relaxed font-medium">
        {children}
      </div>
    </div>
  )
}

export function ViewMessageModal({ open, onClose, messageData }: ViewMessageModalProps) {
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  const displayStatus = messageData
    ? messagingStatusForCallLogCard(messageData.status, messageData.service)
    : 'Pending'
  const badge = statusBadgeClasses(displayStatus)

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="xl"
      className="flex max-h-[90vh] flex-col overflow-hidden p-4 sm:p-6"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden sm:gap-5">
        <div className="flex shrink-0 flex-col gap-2">
          <ModalHeader
            icon={
              <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
                <Icons.ChatFeedback01
                  size={20}
                  className="text-primary-foreground sm:size-6"
                  strokeWidth={1.5}
                />
              </div>
            }
            title={
              messageData?.campaignName ??
              t('pages.clients.modals.viewMessage.title', 'Message details')
            }
          />
          {messageData ? (
            <div className="-mt-1 flex flex-wrap items-center gap-2 pl-12 sm:pl-[3.75rem]">
              <span className="text-muted-foreground font-mono text-xs tracking-tight">
                {messageData.campaignCode}
              </span>
              <span className="bg-card/80 text-foreground ring-border/80 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                {messageData.channel.toUpperCase()}
              </span>
              <span className="bg-card/80 text-muted-foreground ring-border/80 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                {t(
                  `pages.messagingIntegrations.services.${messageData.service}`,
                  getMessagingServiceLabel(messageData.service)
                )}
              </span>
            </div>
          ) : null}
        </div>

        <ModalContent className="max-h-none min-h-0 flex-1 overflow-y-auto py-2 sm:max-h-none sm:py-3 md:max-h-none">
          {messageData ? (
            <div className="flex flex-col gap-4 sm:gap-5">
              <section className="border-border/80 from-card to-muted/80 rounded-2xl border bg-gradient-to-b px-4 py-1 shadow-sm sm:px-5">
                <DetailRow label={t('pages.clients.modals.viewMessage.source', 'Source')}>
                  {formatSourceLabel(messageData.source, t)}
                </DetailRow>
                <DetailRow label={t('pages.clients.modals.viewMessage.launchedBy', 'Launched by')}>
                  {messageData.launchedBy || '—'}
                </DetailRow>
                <DetailRow label={t('pages.clients.modals.viewMessage.destination', 'Destination')}>
                  <span className="font-mono text-[0.8125rem] tracking-wide">
                    {messageData.destination || '—'}
                    {messageData.destinationOwner ? (
                      <span className="text-muted-foreground font-sans">
                        {' '}
                        · {messageData.destinationOwner}
                      </span>
                    ) : null}
                  </span>
                </DetailRow>
                <DetailRow label={t('pages.clients.modals.viewMessage.status', 'Status')}>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
                      badge.wrap
                    )}
                  >
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', badge.dot)} />
                    {displayStatus}
                  </span>
                </DetailRow>
                {messageData.channel === 'email' && (
                  <DetailRow label={t('pages.clients.modals.viewMessage.subject', 'Subject')}>
                    {messageData.subject?.trim() ? messageData.subject : '—'}
                  </DetailRow>
                )}
              </section>

              <section className="border-border/80 bg-card rounded-2xl border px-4 py-3 shadow-sm sm:px-5 sm:py-4">
                <h3 className="text-foreground text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                  {t('pages.clients.modals.viewMessage.timeline', 'Delivery timeline')}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="bg-muted ring-border rounded-xl px-3 py-2.5 ring-1 ring-inset">
                    <div className="text-muted-foreground text-xs font-light">
                      {t('pages.clients.modals.viewMessage.sentAt', 'Sent')}
                    </div>
                    <div className="text-foreground mt-1 text-sm font-medium">
                      {formatDateTime(messageData.sentAt ?? undefined, userTimezone ?? undefined)}
                    </div>
                  </div>
                  <div className="bg-muted ring-border rounded-xl px-3 py-2.5 ring-1 ring-inset">
                    <div className="text-muted-foreground text-xs font-light">
                      {t('pages.clients.modals.viewMessage.deliveredAt', 'Delivered')}
                    </div>
                    <div className="text-foreground mt-1 text-sm font-medium">
                      {formatDateTime(
                        messageData.deliveredAt ?? undefined,
                        userTimezone ?? undefined
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <label className="text-foreground text-muted-foreground text-xs font-semibold tracking-wide uppercase sm:text-sm">
                  {t('pages.clients.modals.viewMessage.body', 'Message')}
                </label>
                <div
                  className="text-foreground border-border bg-card ring-border rounded-2xl border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-inner ring-1 ring-inset sm:px-5 sm:py-4"
                  role="article"
                >
                  {messageData.body?.trim() ? messageData.body : '—'}
                </div>
              </section>

              {(messageData.failedAt || messageData.errorMessage) && (
                <section
                  className="border-error-200/80 bg-error-50/90 rounded-2xl border px-4 py-3 sm:px-5"
                  role="alert"
                >
                  <div className="text-error-800 flex items-center gap-2 text-sm font-semibold">
                    <Icons.Warning size={18} className="shrink-0" />
                    {t('pages.clients.modals.viewMessage.failure', 'Failure details')}
                  </div>
                  {messageData.errorMessage ? (
                    <p className="text-error-700 mt-2 text-sm leading-relaxed">
                      {messageData.errorMessage}
                    </p>
                  ) : null}
                  {messageData.failedAt ? (
                    <p className="text-error-600 mt-2 text-xs">
                      {t('pages.clients.modals.viewMessage.failedAt', 'Failed at')}:{' '}
                      {formatDateTime(messageData.failedAt ?? undefined, userTimezone ?? undefined)}
                    </p>
                  ) : null}
                </section>
              )}
            </div>
          ) : null}
        </ModalContent>

        <ModalFooter className="mt-auto shrink-0 flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            type="button"
            variant="cancel"
            size="sm"
            onClick={onClose}
            className="w-full rounded-md"
          >
            {t('actions.close', 'Close')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default ViewMessageModal
