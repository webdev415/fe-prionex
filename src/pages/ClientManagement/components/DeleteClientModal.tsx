/**
 * Delete Client Modal
 *
 * Modal for confirming client deletion with detailed information and warnings.
 * Uses soft delete pattern - data can be recovered by administrators.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { useDeleteClient } from '@/features/clients/hooks/useClients'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'

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
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient()

  const formatCurrency = (amount: number) => {
    return `₴ ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
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
        toast.success('Client deleted successfully')
        setConfirmDelete(false)
        onClose()
        navigate('/clients')
      },
      onError: (error: AxiosError<{ detail?: string }>) => {
        toast.error(error?.response?.data?.detail || 'Failed to delete client')
      },
    })
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Delete size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title="Delete Client"
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-200px)]">
        {/* Warning Banner */}
        <div className="border-error-200 bg-error-50 mb-4 flex w-full items-start gap-3 rounded-xl border px-6 py-3">
          <Icons.Warning size={28} className="text-error-500 flex-shrink-0" strokeWidth={2} />
          <span className="text-error-500 text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
            This action will remove the client from active records (soft delete). Data can be
            recovered by administrators if needed.
          </span>
        </div>

        {/* Client Information Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            Client Details
          </span>
          <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                Name: <span className="font-medium">{client.full_name}</span>
              </span>
            </div>
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                Tax ID: <span className="font-medium">{client.tax_id}</span>
              </span>
            </div>
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                Phone: <span className="font-medium">{client.phone_primary}</span>
              </span>
            </div>
            <div className="flex items-start gap-6 self-stretch">
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                Total Debt:{' '}
                <span className="text-error-500 font-medium">
                  {formatCurrency(client.total_debt)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Impact Warning Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            What Will Happen:
          </span>
          <ul className="text-dark-500 list-disc space-y-2 pl-5 text-xs sm:text-sm">
            <li>Client will be marked as deleted (soft delete)</li>
            <li>Client will disappear from client lists</li>
            <li>Historical data (notes, calls, payments) will be preserved</li>
            <li>This action cannot be undone without admin intervention</li>
            <li>
              Associated debts: {client.debt_count} debt(s) totaling{' '}
              {formatCurrency(client.total_debt)}
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
            className="text-dark-500 cursor-pointer text-sm leading-[150%] font-medium"
          >
            I understand this action will remove the client from active records
          </label>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirmDelete}
          disabled={!confirmDelete || isDeleting}
          {...(isDeleting && { loading: true })}
        >
          {isDeleting ? 'Deleting...' : 'Delete Client'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
