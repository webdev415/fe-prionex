/**
 * Assign Role Modal
 *
 * A focused modal for assigning either an Employee (with reason) or a Searcher (no reason).
 * Opened from the pencil icons next to "Responsible Employee" and "Responsible Searcher"
 * on the Client Detail Page left card.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import { useGuardedAction, useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { toast } from 'sonner'

export type AssignRoleMode = 'employee' | 'searcher'

interface AssignRoleModalProps {
  open: boolean
  mode: AssignRoleMode
  /** Currently assigned user id (to pre-select) */
  currentUserId?: number | null
  onClose: () => void
  onAssign: (data: { userId: string; reason?: string }) => void
}

const assignmentReasonKeys = [
  'newClient',
  'workloadDistribution',
  'specialistRequired',
  'reassignment',
  'other',
] as const

const assignmentReasonValueMap: Record<(typeof assignmentReasonKeys)[number], string> = {
  newClient: 'New Client',
  workloadDistribution: 'Workload Distribution',
  specialistRequired: 'Specialist Required',
  reassignment: 'Reassignment',
  other: 'Other',
}

export function AssignRoleModal({
  open,
  mode,
  currentUserId,
  onClose,
  onAssign,
}: AssignRoleModalProps) {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)

  const { data: operators } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const userOptions = useMemo(() => {
    if (!operators) return []
    return operators.map((user) => ({
      id: user.id.toString(),
      name: user.full_name,
    }))
  }, [operators])

  const [userId, setUserId] = useState<string>('')
  const [reason, setReason] = useState<string>('')

  // Pattern Y per-field reassign rule (KAN-562):
  //   - If this role (employee or searcher per `mode`) is currently NULL,
  //     setting it is initial assignment → `edit_clients`.
  //   - If currently set to someone, changing it is re-assignment →
  //     `reassign_client_responsible`.
  const hasReassignPerm = useHasPermission(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
  const guardBaseAssign = useGuardedAction(PERMISSIONS.CLIENTS.EDIT, 'errors:permissions.required')

  // Pre-select the currently assigned user when the modal opens.
  // requestAnimationFrame defers setState out of the effect body to avoid
  // the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        setUserId(currentUserId ? currentUserId.toString() : '')
        setReason('')
      })
    }
  }, [open, currentUserId])

  const handleSubmit = () => {
    if (!userId) return
    if (!reason) return

    // Single-field check: this modal only touches the one role determined by
    // `mode`. Reassignment when currentUserId is non-null AND the form picks
    // a different user. Initial assignment when currentUserId is null.
    const newUserNum = userId ? Number(userId) : null
    const requiresReassign = currentUserId != null && newUserNum !== currentUserId

    if (requiresReassign && !hasReassignPerm) {
      toast.warning(t('errors:permissions.reassignClient'))
      return
    }

    guardBaseAssign(() => {
      onAssign({
        userId,
        reason,
      })

      setUserId('')
      setReason('')
      onClose()
    })
  }

  const handleCancel = () => {
    setUserId('')
    setReason('')
    onClose()
  }

  const isEmployee = mode === 'employee'
  const canSubmit = !!userId && !!reason

  const titleKey = isEmployee
    ? 'pages.clients.modals.assignRole.titleEmployee'
    : 'pages.clients.modals.assignRole.titleSearcher'

  const selectPlaceholder = isEmployee
    ? t('pages.clients.modals.assignRole.selectEmployee')
    : t('pages.clients.modals.assignRole.selectSearcher')

  const labelKey = isEmployee
    ? 'pages.clients.modals.assignRole.employee'
    : 'pages.clients.modals.assignRole.searcher'

  return (
    <Modal open={open} onClose={handleCancel} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Tick02 size={20} className="text-primary-foreground" strokeWidth={1.5} />
          </div>
        }
        title={t(titleKey)}
      />
      <ModalContent>
        <div className="flex flex-col gap-5">
          {/* User dropdown */}
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="assign-role-user"
              className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]"
            >
              {t(labelKey)}
            </Label>
            <SearchableSelect
              id="assign-role-user"
              options={userOptions}
              value={userId}
              onValueChange={setUserId}
              placeholder={selectPlaceholder}
            />
          </div>

          {/* Assignment Reason — required for both employee and searcher */}
          <div className="flex flex-col gap-2">
            <Label className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.modals.assignRole.assignmentReason')}
            </Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              <div className="flex flex-col gap-2">
                {assignmentReasonKeys.map((reasonKey) => {
                  const translationKey = `pages.clients.modals.assignRole.reasons.${reasonKey}`
                  const reasonValue = assignmentReasonValueMap[reasonKey]
                  return (
                    <div key={reasonKey} className="flex items-center gap-2">
                      <RadioItem value={reasonValue} id={`role-reason-${reasonKey}`} />
                      <Label
                        htmlFor={`role-reason-${reasonKey}`}
                        className="text-foreground text-xs font-light tracking-[-0.24px]"
                      >
                        {t(translationKey)}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </RadioGroup>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={handleCancel}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('pages.clients.modals.assignRole.assign')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
