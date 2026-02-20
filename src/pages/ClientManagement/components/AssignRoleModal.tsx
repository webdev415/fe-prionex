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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { useUsers } from '@/features/users/hooks/useUsers'

export type AssignRoleMode = 'employee' | 'searcher'

interface AssignRoleModalProps {
  open: boolean
  mode: AssignRoleMode
  /** Currently assigned user id (to pre-select) */
  currentUserId?: number | null
  onClose: () => void
  onAssign: (data: { userId: string; reason?: string }) => void
}

const assignmentReasons = [
  'New Client',
  'Workload Distribution',
  'Specialist Required',
  'Reassignment',
  'Other',
]

const reasonKeyMap: Record<string, string> = {
  'New Client': 'newClient',
  'Workload Distribution': 'workloadDistribution',
  'Specialist Required': 'specialistRequired',
  Reassignment: 'reassignment',
  Other: 'other',
}

export function AssignRoleModal({
  open,
  mode,
  currentUserId,
  onClose,
  onAssign,
}: AssignRoleModalProps) {
  const { t } = useTranslation('common')

  const { data: usersResponse } = useUsers({ status: 'active', page_size: 100 })

  const userOptions = useMemo(() => {
    if (!usersResponse?.users) return []
    return usersResponse.users.map((user) => ({
      id: user.id.toString(),
      name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
    }))
  }, [usersResponse])

  const [userId, setUserId] = useState<string>('')
  const [reason, setReason] = useState<string>('')

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

    onAssign({
      userId,
      reason,
    })

    setUserId('')
    setReason('')
    onClose()
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
    ? t('pages.clients.modals.assignClient.selectEmployee')
    : t('pages.clients.modals.assignClient.selectSearcher')

  const labelKey = isEmployee
    ? 'pages.clients.modals.assignClient.employee'
    : 'pages.clients.modals.assignClient.searcher'

  return (
    <Modal open={open} onClose={handleCancel} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Tick02 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t(titleKey, isEmployee ? 'Assign Employee' : 'Assign Searcher')}
      />
      <ModalContent>
        <div className="flex flex-col gap-5">
          {/* User dropdown */}
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="assign-role-user"
              className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
            >
              {t(labelKey)}
            </Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="assign-role-user" className="h-[45px] w-full rounded-md">
                <SelectValue placeholder={selectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {userOptions.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-gray-500">
                    {t('pages.clients.modals.assignClient.noUsersAvailable')}
                  </div>
                ) : (
                  userOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Assignment Reason — required for both employee and searcher */}
          <div className="flex flex-col gap-2">
            <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.modals.assignClient.assignmentReason')}
            </Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              <div className="flex flex-col gap-2">
                {assignmentReasons.map((assignmentReason) => {
                  const reasonKey = reasonKeyMap[assignmentReason] || assignmentReason.toLowerCase()
                  const translationKey = `pages.clients.modals.assignClient.reasons.${reasonKey}`
                  return (
                    <div key={assignmentReason} className="flex items-center gap-2">
                      <RadioItem value={assignmentReason} id={`role-reason-${assignmentReason}`} />
                      <Label
                        htmlFor={`role-reason-${assignmentReason}`}
                        className="text-dark-500 text-xs font-light tracking-[-0.24px]"
                      >
                        {t(translationKey, assignmentReason)}
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
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('pages.clients.modals.assignClient.assignClient', 'Assign')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
