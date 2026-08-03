/**
 * Confirmation dialog for soft-cancelling a write-off entry (KAN-245).
 *
 * Wired from the per-row "Cancel" affordance in DebtWriteoffSection.
 * Calls ``useCancelWriteoff`` which DELETE /api/v1/writeoffs/{id} and
 * surfaces the 409 WRITEOFF_ALREADY_CANCELLED case via toast.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { useCancelWriteoff } from '@/features/writeoffs/hooks/useWriteoffs'
import type { WriteoffEntry } from '@/features/writeoffs/api/types'

export interface WriteoffCancelDialogProps {
  open: boolean
  onClose: () => void
  entry: WriteoffEntry
}

export function WriteoffCancelDialog({ open, onClose, entry }: WriteoffCancelDialogProps) {
  const { t } = useTranslation('common')
  const [reason, setReason] = useState('')

  // Reset on close. Allowed `set-state-in-effect` — clearing the
  // reason field after the dialog closes so a re-open starts fresh.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) setReason('')
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const { mutate, isPending } = useCancelWriteoff(entry.id)

  const handleConfirm = () => {
    mutate(
      { cancellation_reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.detail.writeOffCancelDialog.cancelSuccess'))
          onClose()
        },
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 sm:h-12 sm:w-12">
            <Icons.CancelCircle size={20} className="text-red-600 sm:size-6" strokeWidth={2} />
          </div>
        }
        title={t('pages.clients.detail.writeOffCancelDialog.title')}
      />
      <ModalContent>
        <div className="flex flex-col gap-4">
          <p className="text-foreground text-sm">
            {t('pages.clients.detail.writeOffCancelDialog.body', {
              accrualType: t(`pages.clients.detail.writeOffModal.components.${entry.accrual_type}`),
              amount: formatMoneyUAHTwoDecimals(Number(entry.amount)),
            })}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-foreground text-sm font-medium">
              {t('pages.clients.detail.writeOffCancelDialog.reasonLabel')}
              <span className="text-muted-foreground ml-1">({t('common.optional')})</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t('pages.clients.detail.writeOffCancelDialog.reasonPlaceholder')}
            />
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={handleConfirm} isLoading={isPending}>
          {t('pages.clients.detail.writeOffCancelDialog.confirmButton')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
