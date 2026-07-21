/**
 * Client info popup (KAN-379, design: operator-03).
 *
 * A compact client card shown during a routed call: identity, phone, a link to
 * the full client card, and the 5 most recent interactions.
 *
 * NOTE: the design's payment tiles (total paid / verified / pending) need the
 * client profile + payment summary endpoints; they are deferred to a follow-up
 * (this popup covers identity + recent interactions).
 */

import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'

import { RecentInteractions } from './RecentInteractions'

interface ClientInfoPopupProps {
  open: boolean
  onClose: () => void
  clientId: number
  clientName: string
  phone: string
}

export function ClientInfoPopup({
  open,
  onClose,
  clientId,
  clientName,
  phone,
}: ClientInfoPopupProps) {
  const { t } = useTranslation('common')

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={<Icons.UserCircle02Icon size={22} className="text-primary-600" />}
        title={clientName}
      />
      <ModalContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-muted-foreground text-xs">{t('dialer.call.phone', 'Phone')}</p>
              <p className="text-foreground text-sm font-medium">{phone}</p>
            </div>
            <a href={`/dashboard/clients/${clientId}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" rightIcon={<Icons.ArrowRight02 size={16} />}>
                {t('dialer.call.viewClient', 'View Client')}
              </Button>
            </a>
          </div>

          <div>
            <p className="text-foreground mb-2 text-sm font-medium">
              {t('dialer.call.recentInteractions', 'Recent interactions with this client')}
            </p>
            <RecentInteractions clientId={clientId} />
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}

export default ClientInfoPopup
