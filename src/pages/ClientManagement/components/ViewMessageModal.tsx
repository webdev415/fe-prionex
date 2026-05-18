import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

export interface ViewMessageModalProps {
  open: boolean
  onClose: () => void
  messageData: {
    campaignName: string
    campaignCode: string
    source: string
    channel: string
    service: string
    destination: string
    status: string
    body: string
    subject?: string
    sentAt?: string | null
    deliveredAt?: string | null
    failedAt?: string | null
    errorMessage?: string | null
  } | null
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const formatLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export function ViewMessageModal({ open, onClose, messageData }: ViewMessageModalProps) {
  const { t } = useTranslation('common')

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.ChatFeedback01 size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={
          messageData
            ? `${messageData.campaignName} (${messageData.campaignCode})`
            : t('pages.clients.modals.viewMessage.title', 'Message details')
        }
      />
      <ModalContent>
        {messageData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ['Source', formatLabel(messageData.source)],
                ['Channel', messageData.channel.toUpperCase()],
                ['Service', messageData.service],
                ['Status', formatLabel(messageData.status)],
                ['Destination', messageData.destination || '-'],
                ['Subject', messageData.subject || '-'],
                ['Sent at', formatDateTime(messageData.sentAt)],
                ['Delivered at', formatDateTime(messageData.deliveredAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs tracking-wide text-gray-500 uppercase">{label}</div>
                  <div className="text-dark-500 mt-2 text-sm font-medium">{value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-dark-500 text-sm font-medium">
                {t('pages.clients.modals.viewMessage.body', 'Rendered message')}
              </div>
              <pre className="text-dark-500 mt-2 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
                {messageData.body || '-'}
              </pre>
            </div>

            {(messageData.failedAt || messageData.errorMessage) && (
              <div className="border-error-200 bg-error-50 rounded-xl border p-4">
                <div className="text-error-700 text-sm font-medium">
                  {t('pages.clients.modals.viewMessage.failure', 'Failure details')}
                </div>
                <div className="text-error-700 mt-2 text-sm">{messageData.errorMessage || '-'}</div>
                <div className="text-error-700 mt-2 text-xs">
                  {t('pages.clients.modals.viewMessage.failedAt', 'Failed at')}:&nbsp;
                  {formatDateTime(messageData.failedAt)}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} size="sm">
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default ViewMessageModal
