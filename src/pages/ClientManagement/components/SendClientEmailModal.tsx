/**
 * Write an e-mail to the client from the project mailbox — a new letter or a
 * reply in the thread of a letter from the list.
 *
 * There is no recipient field on purpose: the server always writes to the
 * address of the client's card, so the operator cannot mistype someone else's.
 * Plain text only; attachments and HTML are not part of the channel.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'
import { getErrorMessage } from '@/lib/errors'
import { piiProps } from '@/lib/openreplay/pii'
import { useSendClientEmail, type SendClientEmailRequest } from '@/features/clientEmail'

/** Limits of the send door; the server refuses anything longer. */
const SUBJECT_MAX_LENGTH = 998
const BODY_MAX_LENGTH = 20000

/** The letter being answered. */
export interface ClientEmailReplyTarget {
  id: string
  subject: string | null
}

export interface SendClientEmailModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  replyTo?: ClientEmailReplyTarget
}

/** «Re: …» once — answering an answer must not grow «Re: Re: …». */
function replySubject(subject: string | null | undefined): string {
  const base = (subject ?? '').trim()
  if (!base) return ''
  return /^re:/i.test(base) ? base : `Re: ${base}`
}

export function SendClientEmailModal({
  open,
  onClose,
  clientId,
  replyTo,
}: SendClientEmailModalProps) {
  const { t } = useTranslation('common')
  const [subject, setSubject] = useState(() => (replyTo ? replySubject(replyTo.subject) : ''))
  const [body, setBody] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)
  const sendEmail = useSendClientEmail(clientId)
  /**
   * The disabled button is not enough on its own: two clicks inside one frame
   * both reach the handler before React re-renders the button as disabled, and
   * the door has no idempotency key — that would be two letters to the client.
   */
  const inFlight = useRef(false)

  const filled = subject.trim() !== '' && body.trim() !== ''

  async function handleSend() {
    if (!filled || inFlight.current) return
    inFlight.current = true
    setRefusal(null)
    const request: SendClientEmailRequest = { subject: subject.trim(), body_text: body }
    if (replyTo) request.in_reply_to_message_id = replyTo.id
    try {
      await sendEmail.mutateAsync(request)
      toast.success(t('pages.clients.email.sent'))
      onClose()
    } catch (error) {
      setRefusal(getErrorMessage(error))
    } finally {
      inFlight.current = false
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl" className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-6">
        <ModalHeader
          icon={
            <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
              <Icons.Mail size={20} className="text-primary-foreground sm:size-6" />
            </div>
          }
          title={replyTo ? t('pages.clients.email.reply') : t('pages.clients.email.write')}
        />
        <ModalContent>
          <div className="flex flex-col gap-4">
            <Input
              {...piiProps}
              label={t('pages.clients.email.subject')}
              value={subject}
              maxLength={SUBJECT_MAX_LENGTH}
              onChange={(event) => setSubject(event.target.value)}
            />
            <Textarea
              {...piiProps}
              label={t('pages.clients.email.body')}
              value={body}
              maxLength={BODY_MAX_LENGTH}
              textareaSize="lg"
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          {refusal && (
            <p role="alert" className="text-error-500 mt-3 text-sm">
              {refusal}
            </p>
          )}
        </ModalContent>
        <ModalFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
          <Button variant="cancel" size="sm" onClick={onClose} className="w-full rounded-md">
            {t('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSend()}
            disabled={!filled}
            isLoading={sendEmail.isPending}
            className="w-full rounded-md"
            leftIcon={<Icons.MailSend01 size={18} className="sm:size-5" />}
          >
            {t('pages.clients.email.send')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default SendClientEmailModal
