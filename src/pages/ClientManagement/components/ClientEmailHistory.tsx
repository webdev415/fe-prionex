/**
 * «Пошта» sub-tab of the client card: the client's correspondence through the
 * project mailbox (both directions) and «Написати листа».
 *
 * Only letters of the CRM channel are here — the project mailbox and the system
 * sender. The lawyers' correspondence stays in their workplace.
 *
 * Three states are kept apart on purpose, because they mean different things to
 * the operator: «the project mailbox is not connected» (nothing can be read or
 * sent), «no correspondence yet» (the mailbox works, the client never wrote),
 * and a failed load (shown by its reason, never as an empty list).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/localeFormat'
import { piiProps } from '@/lib/openreplay/pii'
import { useAuthStore } from '@/stores/authStore'
import {
  clientEmailFailureText,
  useClientEmailCapabilities,
  useClientEmailMessages,
} from '@/features/clientEmail'
import { MessagingHistorySkeleton } from './MessagingHistorySkeleton'
import { SendClientEmailModal, type ClientEmailReplyTarget } from './SendClientEmailModal'
import { ViewClientEmailModal } from './ViewClientEmailModal'

/** One page, at the server's default ceiling (`EMAIL_CRM_LIST_LIMIT_MAX`). */
const LIST_PARAMS = { limit: 100, offset: 0 }

type Compose = { replyTo?: ClientEmailReplyTarget }

export interface ClientEmailHistoryProps {
  clientId: number
}

export function ClientEmailHistory({ clientId }: ClientEmailHistoryProps) {
  const { t, i18n } = useTranslation('common')
  const timezone = useAuthStore((s) => s.user?.timezone)
  const { data: capabilities, isLoading: isCapabilitiesLoading } = useClientEmailCapabilities()
  const connected = capabilities?.project_mailbox === 'connected'
  // The token's own right, as the door sees it — see `useClientEmailTab`.
  const canRead = capabilities?.can_read === true
  const canSend = connected && capabilities?.can_send === true
  const messages = useClientEmailMessages(clientId, LIST_PARAMS, connected && canRead)
  const [openMessageId, setOpenMessageId] = useState<string | null>(null)
  const [compose, setCompose] = useState<Compose | null>(null)

  const items = messages.data?.items ?? []

  let content
  if (isCapabilitiesLoading || (connected && canRead && messages.isLoading)) {
    content = <MessagingHistorySkeleton dateGroups={1} cardsPerGroup={2} />
  } else if (!connected) {
    content = (
      <p role="status" className="text-muted-foreground text-sm">
        {t('pages.clients.email.notConfigured')}
      </p>
    )
  } else if (!canRead) {
    // Nothing was read, so nothing is claimed — neither «no letters» nor an error.
    content = null
  } else if (messages.isError) {
    content = (
      <p role="alert" className="text-error-500 text-sm">
        {clientEmailFailureText(messages.error)}
      </p>
    )
  } else if (items.length === 0) {
    content = (
      <p role="status" className="text-muted-foreground text-sm">
        {t('pages.clients.email.none')}
      </p>
    )
  } else {
    content = (
      <ul
        className="flex flex-col gap-2 self-stretch"
        aria-label={t('pages.clients.activity.email')}
      >
        {items.map((message) => (
          <li key={message.id} data-email-row={message.id}>
            <button
              type="button"
              onClick={() => setOpenMessageId(message.id)}
              className="border-border bg-card/50 hover:bg-primary/10 flex w-full cursor-pointer flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors"
            >
              <span className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-foreground font-medium">
                  {message.at ? formatDateTime(message.at, i18n.language, timezone) : '—'}
                </span>
                <span className="bg-muted text-foreground rounded-full px-2 py-0.5">
                  {message.direction === 'incoming'
                    ? t('pages.clients.email.incoming')
                    : t('pages.clients.email.outgoing')}
                </span>
                {message.channel === 'system' && (
                  <span className="bg-primary/10 text-primary-700 rounded-full px-2 py-0.5">
                    {t('pages.clients.email.system')}
                  </span>
                )}
                {message.attachment_count > 0 && (
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <Icons.Attachment01 size={14} />
                    {t('pages.clients.email.attachments', { count: message.attachment_count })}
                  </span>
                )}
              </span>
              <span {...piiProps} className="text-foreground text-sm font-medium break-words">
                {message.subject || '—'}
              </span>
              <span {...piiProps} className="text-muted-foreground text-xs break-all">
                {message.counterparty || '—'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col items-start gap-4 self-stretch">
      {canSend && (
        <div className="flex w-full justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCompose({})}
            leftIcon={<Icons.Mail size={18} />}
            className="rounded-md"
          >
            {t('pages.clients.email.write')}
          </Button>
        </div>
      )}
      {content}
      {openMessageId && (
        <ViewClientEmailModal
          open
          clientId={clientId}
          messageId={openMessageId}
          canReply={canSend}
          onClose={() => setOpenMessageId(null)}
          onReply={(target) => {
            setOpenMessageId(null)
            setCompose({ replyTo: target })
          }}
        />
      )}
      {compose && (
        <SendClientEmailModal
          open
          clientId={clientId}
          replyTo={compose.replyTo}
          onClose={() => setCompose(null)}
        />
      )}
    </div>
  )
}

export default ClientEmailHistory
