/**
 * Confirmation modal for deleting an IP whitelist entry.
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useDeleteIpWhitelistEntry, type IpWhitelistEntry } from '@/features/ipWhitelist'

interface Props {
  open: boolean
  entry: IpWhitelistEntry | null
  onClose: () => void
}

function extractApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: unknown } } }
  const detail = e?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail !== null) {
    const obj = detail as { message?: string; code?: string }
    if (obj.message) return obj.message
    if (obj.code) return obj.code
  }
  return fallback
}

export function DeleteIpWhitelistEntryModal({ open, entry, onClose }: Props) {
  const { t } = useTranslation('common')
  const mutation = useDeleteIpWhitelistEntry()

  const handleDelete = async () => {
    if (!entry) return
    try {
      await mutation.mutateAsync(entry.id)
      toast.success(t('pages.ipWhitelist.toastDeleted'))
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, t('pages.ipWhitelist.errorDelete')))
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-destructive flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Delete
              size={18}
              className="text-destructive-foreground sm:size-5"
              strokeWidth={2}
            />
          </div>
        }
        title={t('pages.ipWhitelist.deleteModalTitle', 'Delete IP address')}
      />
      <ModalContent>
        <div className="flex flex-col gap-2">
          <p className="text-foreground text-xs sm:text-sm">
            {t('pages.ipWhitelist.confirmDelete', 'Remove {{ip}} from the whitelist?', {
              ip: entry?.ip_address ?? '',
            })}
          </p>
          {entry?.label ? (
            <p className="text-muted-foreground text-xs">
              <span className="text-foreground font-medium">{entry.label}</span>
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {t(
              'pages.ipWhitelist.deleteWarning',
              'This action cannot be undone. Logins from this IP will be blocked when enforcement is enabled.'
            )}
          </p>
        </div>
      </ModalContent>
      <ModalFooter className="flex-col-reverse gap-2 sm:flex-row">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={mutation.isPending}
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={mutation.isPending}
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {mutation.isPending ? t('actions.deleting', 'Deleting…') : t('actions.delete', 'Delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
