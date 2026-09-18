/**
 * Delete Client Modal
 *
 * Modal for confirming client deletion with detailed information and warnings.
 * Uses soft delete pattern - data can be recovered by administrators.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { useDeleteClient } from '@/features/clients/hooks/useClients'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'
import { withCurrency } from '@/lib/formatters'

export interface DeleteClientModalProps {
  open: boolean
  client: {
    id: number
    full_name: string
    tax_id: string
    phone_primary: string
    total_debt: number
    debt_count: number
  }
  onClose: () => void
  onSuccess: () => void
}

export function DeleteClientModal({
  open,
  client,
  onClose,
  onSuccess: _onSuccess,
}: DeleteClientModalProps) {
  const { t, i18n } = useTranslation('common')
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient()

  const formatCurrency = (amount: number) => {
    return withCurrency(
      amount.toLocaleString(intlLocaleForUiLanguage(i18n.language), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmDelete(false)
      onClose()
    }
  }

  const handleConfirmDelete = () => {
    if (!confirmDelete) return

    deleteClient(client.id, {
      onSuccess: () => {
        toast.success(t('pages.clients.modals.deleteClient.deletedSuccess'))
        setConfirmDelete(false)
        onClose()
        navigate('/clients')
      },
      onError: (error: AxiosError<{ detail?: string }>) => {
        toast.error(
          error?.response?.data?.detail || t('pages.clients.modals.deleteClient.deleteFailed')
        )
      },
    })
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Delete size={20} className="text-primary-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.clients.modals.deleteClient.title')}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-200px)]">
        {/* Warning Banner */}
        <div className="border-error-200 bg-error-50 mb-4 flex w-full items-start gap-3 rounded-xl border px-6 py-3">
          <Icons.Warning size={28} className="text-error-500 flex-shrink-0" strokeWidth={2} />
          <span className="text-error-500 text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.deleteClient.softDeleteWarning')}
          </span>
        </div>

        {/* Client Information Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.deleteClient.clientDetails')}
          </span>
          <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.clients.modals.deleteClient.fieldName')}{' '}
                <span className="font-medium">{client.full_name}</span>
              </span>
            </div>
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.clients.modals.deleteClient.fieldTaxId')}{' '}
                <span className="font-medium">{client.tax_id}</span>
              </span>
            </div>
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.clients.modals.deleteClient.fieldPhone')}{' '}
                <span className="font-medium">{client.phone_primary}</span>
              </span>
            </div>
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.clients.modals.deleteClient.fieldTotalDebt')}{' '}
                <span className="text-error-500 font-medium">
                  {formatCurrency(client.total_debt)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Impact Warning Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.deleteClient.impactTitle')}
          </span>
          <ul className="text-foreground list-disc space-y-2 pl-5 text-xs sm:text-sm">
            <li>{t('pages.clients.modals.deleteClient.impact1')}</li>
            <li>{t('pages.clients.modals.deleteClient.impact2')}</li>
            <li>{t('pages.clients.modals.deleteClient.impact3')}</li>
            <li>{t('pages.clients.modals.deleteClient.impact4')}</li>
            <li>
              {t('pages.clients.modals.deleteClient.debtsSummary', {
                count: client.debt_count,
                amount: formatCurrency(client.total_debt),
              })}
            </li>
          </ul>
        </div>

        {/* Confirmation Checkbox */}
        <div className="mt-4 flex items-start gap-3">
          <Checkbox
            id="confirm-delete"
            checked={confirmDelete}
            onCheckedChange={(checked) => setConfirmDelete(checked as boolean)}
            disabled={isDeleting}
            className="mt-1"
          />
          <label
            htmlFor="confirm-delete"
            className="text-foreground cursor-pointer text-sm leading-[150%] font-medium"
          >
            {t('pages.clients.modals.deleteClient.confirmCheckbox')}
          </label>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirmDelete}
          disabled={!confirmDelete || isDeleting}
          {...(isDeleting && { loading: true })}
        >
          {isDeleting
            ? t('pages.clients.modals.deleteClient.deleting')
            : t('pages.clients.modals.deleteClient.submitDelete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
