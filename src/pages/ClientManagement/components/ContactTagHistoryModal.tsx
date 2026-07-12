import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useContactTagHistory } from '@/features/contactTags/hooks/useContactTags'
import { formatDateTime } from '@/lib/formatters'

interface ContactTagHistoryModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  contactId: number
  phoneNumber: string
}

export function ContactTagHistoryModal({
  open,
  onClose,
  clientId,
  contactId,
  phoneNumber,
}: ContactTagHistoryModalProps) {
  const { t } = useTranslation('common')
  const { data: history = [], isLoading } = useContactTagHistory(clientId, contactId, open)

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title={`${t('pages.contactTags.tagHistory', 'Tag history')} — ${phoneNumber}`} />
      <ModalContent className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <p>{t('common.loading', 'Loading...')}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t('pages.contactTags.noHistory', 'No changes yet')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((entry) => (
              <li key={entry.id} className="rounded border p-3 text-sm">
                <div className="font-medium">{entry.category_name}</div>
                <div className="text-gray-600">
                  {entry.old_value_names.length ? entry.old_value_names.join(', ') : '—'} →{' '}
                  {entry.new_value_names.length ? entry.new_value_names.join(', ') : '—'}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {entry.actor_name} · {formatDateTime(entry.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          {t('common.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
