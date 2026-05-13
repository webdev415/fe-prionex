import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'

interface ReassignPaymentEmployeeModalProps {
  open: boolean
  onClose: () => void
  currentEmployeeName: string
  currentUserId?: number | null
  isSubmitting?: boolean
  onConfirm: (newUserId: number) => void
}

function ReassignBody({
  onClose,
  currentEmployeeName,
  currentUserId,
  isSubmitting,
  onConfirm,
}: Omit<ReassignPaymentEmployeeModalProps, 'open'>) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? Number(user.active_project_id) : null
  const { data: operators = [], isLoading } = useOperators(projectId)

  const [selectedUserId, setSelectedUserId] = useState<string>('')

  const userOptions = useMemo(
    () =>
      operators.map((u) => ({
        id: u.id.toString(),
        name: u.full_name || u.username,
      })),
    [operators]
  )

  const canConfirm =
    !!selectedUserId &&
    !isSubmitting &&
    (currentUserId == null || Number(selectedUserId) !== currentUserId)

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(Number(selectedUserId))
  }

  return (
    <>
      <ModalHeader title={t('pages.clients.modals.reassignEmployee.title')} onClose={onClose} />
      <ModalContent className="space-y-4">
        <p className="text-sm text-gray-600">
          {t('pages.clients.modals.reassignEmployee.description')}
        </p>

        <div className="space-y-1">
          <Label className="text-dark-500 text-xs font-medium">
            {t('pages.clients.modals.reassignEmployee.currentLabel')}
          </Label>
          <p className="text-dark-500 text-sm font-medium">{currentEmployeeName || '—'}</p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="reassign-target" className="text-dark-500 text-xs font-medium">
            {t('pages.clients.modals.reassignEmployee.newLabel')}
          </Label>
          <SearchableSelect
            id="reassign-target"
            options={userOptions}
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            placeholder={
              isLoading
                ? t('pages.clients.modals.reassignEmployee.loadingOperators')
                : t('pages.clients.modals.reassignEmployee.selectPlaceholder')
            }
            searchPlaceholder={t('pages.clients.modals.reassignEmployee.searchPlaceholder')}
            disabled={isLoading || isSubmitting}
          />
        </div>
      </ModalContent>
      <ModalFooter className="flex justify-end gap-3">
        <Button variant="cancel" size="md" onClick={onClose} disabled={isSubmitting}>
          {t('pages.clients.modals.reassignEmployee.cancel')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={handleConfirm}
          disabled={!canConfirm}
          isLoading={isSubmitting}
        >
          {isSubmitting
            ? t('pages.clients.modals.reassignEmployee.saving')
            : t('pages.clients.modals.reassignEmployee.confirm')}
        </Button>
      </ModalFooter>
    </>
  )
}

export function ReassignPaymentEmployeeModal({ open, ...rest }: ReassignPaymentEmployeeModalProps) {
  return (
    <Modal open={open} onClose={rest.onClose} className="max-w-md">
      {/* Remount on open so the form state resets without a setState-in-effect. */}
      {open && <ReassignBody {...rest} />}
    </Modal>
  )
}
