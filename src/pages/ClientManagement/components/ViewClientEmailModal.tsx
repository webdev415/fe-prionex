/**
 * Read one letter of the client's correspondence.
 *
 * 🔴 Text only. The door returns `body_text` (or text it derived from an
 * HTML-only letter) and never `body_html`: the stored HTML points its inline
 * images at the lawyers' doors, which are closed to this channel. So nothing
 * here renders markup — the text goes into the DOM as text, and a letter that
 * says `<b>` shows the characters `<b>`.
 *
 * The modal is a portal, and the PII attribute does not cross a portal: every
 * block with the client's data carries its own `piiProps`.
 */
import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { getErrorMessage } from '@/lib/errors'
import { formatDateTime } from '@/lib/localeFormat'
import { piiProps } from '@/lib/openreplay/pii'
import { useAuthStore } from '@/stores/authStore'
import { useClientEmailMessage } from '@/features/clientEmail'
import type { ClientEmailReplyTarget } from './SendClientEmailModal'

export interface ViewClientEmailModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  messageId: string | null
  /** Offer «Відповісти» — the caller may send and the project mailbox is connected. */
  canReply: boolean
  onReply: (target: ClientEmailReplyTarget) => void
}

export function ViewClientEmailModal({
  open,
  onClose,
  clientId,
  messageId,
  canReply,
  onReply,
}: ViewClientEmailModalProps) {
  const { t, i18n } = useTranslation('common')
  const timezone = useAuthStore((s) => s.user?.timezone)
  const letterQuery = useClientEmailMessage(clientId, open ? messageId : null)
  const { data: letter, isLoading, error } = letterQuery
  // The type is written by hand: a missing list must not take the whole modal down.
  const attachments = letter?.attachments ?? []

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl" className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        <ModalHeader
          icon={
            <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
              <Icons.Mail size={20} className="text-primary-foreground sm:size-6" />
            </div>
          }
          title={t('pages.clients.email.viewTitle')}
        />
        <ModalContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
          ) : error ? (
            <p role="alert" className="text-error-500 text-sm">
              {getErrorMessage(error)}
            </p>
          ) : letter ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-foreground font-medium">
                  {formatDateTime(letter.at, i18n.language, timezone)}
                </span>
                <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-xs">
                  {letter.direction === 'incoming'
                    ? t('pages.clients.email.incoming')
                    : t('pages.clients.email.outgoing')}
                </span>
                {letter.channel === 'system' && (
                  <span className="bg-primary/10 text-primary-700 rounded-full px-2 py-0.5 text-xs">
                    {t('pages.clients.email.system')}
                  </span>
                )}
                <span {...piiProps} className="text-muted-foreground break-all">
                  {letter.counterparty || '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  {t('pages.clients.email.subject')}
                </span>
                <span {...piiProps} className="text-foreground text-base font-medium break-words">
                  {letter.subject || '—'}
                </span>
              </div>
              {letter.is_quarantined && (
                <p className="text-warning-700 text-sm">{t('pages.clients.email.quarantined')}</p>
              )}
              {letter.body_derived_from_html && (
                <p className="text-muted-foreground text-xs">
                  {t('pages.clients.email.derivedFromHtml')}
                </p>
              )}
              {!!letter.body_text && (
                <div
                  {...piiProps}
                  data-testid="client-email-body"
                  className="border-border bg-card text-foreground rounded-lg border px-3 py-2 text-sm font-light break-words whitespace-pre-wrap"
                >
                  {letter.body_text}
                </div>
              )}
              {attachments.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">
                    {t('pages.clients.email.attachments', { count: attachments.length })}
                  </span>
                  <ul {...piiProps} className="text-foreground list-disc pl-5 text-sm">
                    {attachments.map((attachment, index) => (
                      <li key={`${index}-${attachment.filename}`} className="break-all">
                        {attachment.filename}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </ModalContent>
        <ModalFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
          <Button variant="cancel" size="sm" onClick={onClose} className="w-full rounded-md">
            {t('actions.close')}
          </Button>
          {canReply && letter && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onReply({ id: letter.id, subject: letter.subject })}
              className="w-full rounded-md"
              leftIcon={<Icons.MailSend01 size={18} className="sm:size-5" />}
            >
              {t('pages.clients.email.reply')}
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default ViewClientEmailModal
