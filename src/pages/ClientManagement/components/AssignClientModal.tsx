/**
 * Assign Client Modal
 *
 * Modal for assigning a single client to an employee or searcher.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { useClient } from '@/features/clients/hooks/useClients'
import { usePriorityThresholds } from '@/features/clients/hooks/useConfig'
import { mapScoreToPriority } from '@/features/clients/api/configApi'
import { PriorityBadge } from './PriorityBadge'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'

// Format currency for Ukrainian Hryvnia
const formatUAH = (amount: number) => {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  })
    .format(amount)
    .replace(/,/g, ' ')
}

interface AssignClientModalProps {
  open: boolean
  clientId: number | null
  onClose: () => void
  onAssign: (assignmentData: { employeeId?: string; searcherId?: string; reason: string }) => void
}

const assignmentReasons = [
  'New Client',
  'Workload Distribution',
  'Specialist Required',
  'Reassignment',
  'Other',
]

export function AssignClientModal({ open, clientId, onClose, onAssign }: AssignClientModalProps) {
  const { t } = useTranslation('common')
  const { data: client, isLoading } = useClient(clientId || 0, open && !!clientId)
  const { data: thresholds } = usePriorityThresholds()
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)

  // Fetch active users for employee and searcher dropdowns
  const { data: operators } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  // Map users to dropdown options (full name format)
  const userOptions = useMemo(() => {
    if (!operators) return []
    return operators.map((user) => ({
      id: user.id.toString(),
      name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
    }))
  }, [operators])

  const [employeeId, setEmployeeId] = useState<string>('')
  const [searcherId, setSearcherId] = useState<string>('')
  const [reason, setReason] = useState<string>('')

  // Populate current assignments when modal opens
  useEffect(() => {
    if (open && client) {
      // Use requestAnimationFrame to defer state update and avoid lint error
      requestAnimationFrame(() => {
        setEmployeeId(client.responsible_employee_id?.toString() || '')
        setSearcherId(client.responsible_searcher_id?.toString() || '')
      })
    }
  }, [open, client])

  const handleSubmit = () => {
    if (!employeeId && !searcherId) {
      return // Validation: at least one must be selected
    }

    onAssign({
      employeeId: employeeId || undefined,
      searcherId: searcherId || undefined,
      reason,
    })

    // Reset form
    setEmployeeId('')
    setSearcherId('')
    setReason('')
    onClose()
  }

  const handleCancel = () => {
    // Reset form
    setEmployeeId('')
    setSearcherId('')
    setReason('')
    onClose()
  }

  if (!client && !isLoading) {
    return null
  }

  const fullName = client
    ? [client.first_name, client.middle_name, client.last_name].filter(Boolean).join(' ')
    : ''
  const email = client?.email || '-'
  const phone = client?.phone_primary || '-'
  const priority =
    (client?.manual_priority as 'Critical' | 'High' | 'Medium' | 'Low' | undefined) ||
    (client && thresholds
      ? mapScoreToPriority(client.priority_score, thresholds)
      : ('High' as 'Critical' | 'High' | 'Medium' | 'Low'))
  const score = client?.priority_score || 0
  const totalDebt = Number(client?.total_debt) || 0
  const debtCount = client?.debt_count || 0

  const canSubmit = (employeeId || searcherId) && reason

  return (
    <Modal open={open} onClose={handleCancel} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Tick02 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.assignClient.title', { fullName })}
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex flex-col gap-6">
            {/* Client Information Section Skeleton */}
            <div className="flex flex-col items-start gap-2 self-stretch">
              <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
              <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
                <div className="flex flex-col items-start gap-2 self-stretch">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-start gap-6 self-stretch">
                      <div className="h-4 w-[120px] animate-pulse rounded bg-gray-200" />
                      <div className="h-4 flex-1 animate-pulse rounded bg-gray-200" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Assignment Details Section Skeleton */}
            <div className="flex flex-col items-start gap-2 self-stretch">
              <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
              <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
                <div className="flex items-start gap-4 self-stretch">
                  {/* Employee Dropdown Skeleton */}
                  <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
                    <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                  </div>

                  {/* Searcher Dropdown Skeleton */}
                  <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
                    <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                  </div>
                </div>
                <div className="flex items-start gap-4 self-stretch">
                  {/* Assignment Reason Skeleton */}
                  <div className="flex flex-1 flex-col items-start justify-center gap-1">
                    <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-pulse rounded-full bg-gray-200" />
                          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Client Information Section */}
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.assignClient.clientInformation')}
              </span>
              <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white/100 bg-white/50 p-4 sm:gap-5 sm:p-5 md:p-6">
                <div className="flex flex-col items-start gap-3 self-stretch sm:gap-2">
                  <div className="flex flex-col gap-1 self-stretch sm:flex-row sm:items-start sm:gap-6">
                    <span className="w-full text-xs leading-[150%] font-light tracking-[-0.24px] text-gray-600 sm:w-[120px] sm:text-sm sm:tracking-[-0.28px]">
                      {t('pages.clients.modals.assignClient.name')}
                    </span>
                    <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                      {fullName}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 self-stretch sm:flex-row sm:items-start sm:gap-6">
                    <span className="w-full text-xs leading-[150%] font-light tracking-[-0.24px] text-gray-600 sm:w-[120px] sm:text-sm sm:tracking-[-0.28px]">
                      {t('pages.clients.modals.assignClient.email')}
                    </span>
                    <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                      {email}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 self-stretch sm:flex-row sm:items-start sm:gap-6">
                    <span className="w-full text-xs leading-[150%] font-light tracking-[-0.24px] text-gray-600 sm:w-[120px] sm:text-sm sm:tracking-[-0.28px]">
                      {t('pages.clients.modals.assignClient.phone')}
                    </span>
                    <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                      {phone}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 self-stretch sm:flex-row sm:items-start sm:gap-6">
                    <span className="w-full text-xs leading-[150%] font-light tracking-[-0.24px] text-gray-600 sm:w-[120px] sm:text-sm sm:tracking-[-0.28px]">
                      {t('pages.clients.modals.assignClient.priority')}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                      <PriorityBadge
                        priority={priority as 'Critical' | 'High' | 'Medium' | 'Low'}
                        variant="compact"
                      />
                      <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                        {t('pages.clients.modals.assignClient.score')}: {score}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 self-stretch sm:flex-row sm:items-start sm:gap-6">
                    <span className="w-full text-xs leading-[150%] font-light tracking-[-0.24px] text-gray-600 sm:w-[120px] sm:text-sm sm:tracking-[-0.28px]">
                      {t('pages.clients.modals.assignClient.totalDebt')}
                    </span>
                    <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                      {formatUAH(totalDebt)} ₴ ({debtCount}{' '}
                      {debtCount === 1
                        ? t('pages.clients.modals.assignClient.debt')
                        : t('pages.clients.modals.assignClient.debts')}
                      )
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Details Section */}
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.assignClient.assignmentDetails')}
              </span>
              <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white/100 bg-white/50 p-4 sm:gap-5 sm:p-5 md:p-6">
                <div className="flex w-full flex-col gap-4 self-stretch sm:flex-row sm:items-start sm:gap-4">
                  {/* Employee Dropdown */}
                  <div className="flex min-h-[63px] w-full flex-col items-start justify-center gap-1 sm:flex-1">
                    <Label
                      htmlFor="employee"
                      className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                    >
                      {t('pages.clients.modals.assignClient.employee')}
                    </Label>
                    <SearchableSelect
                      id="employee"
                      options={userOptions}
                      value={employeeId}
                      onValueChange={setEmployeeId}
                      placeholder={t('pages.clients.modals.assignClient.selectEmployee')}
                    />
                  </div>

                  {/* Searcher Dropdown */}
                  <div className="flex min-h-[63px] w-full flex-col items-start justify-center gap-1 sm:flex-1">
                    <Label
                      htmlFor="searcher"
                      className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                    >
                      {t('pages.clients.modals.assignClient.searcher')}
                    </Label>
                    <SearchableSelect
                      id="searcher"
                      options={userOptions}
                      value={searcherId}
                      onValueChange={setSearcherId}
                      placeholder={t('pages.clients.modals.assignClient.selectSearcher')}
                    />
                  </div>
                </div>
                <div className="flex w-full flex-col gap-4 self-stretch sm:flex-row sm:items-start sm:gap-4">
                  {/* Assignment Reason */}
                  <div className="flex w-full flex-col items-start justify-center gap-1 sm:flex-1">
                    <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {t('pages.clients.modals.assignClient.assignmentReason')}
                    </Label>
                    <RadioGroup value={reason} onValueChange={setReason}>
                      <div className="flex flex-col gap-2">
                        {assignmentReasons.map((assignmentReason) => {
                          const reasonKeyMap: Record<string, string> = {
                            'New Client': 'newClient',
                            'Workload Distribution': 'workloadDistribution',
                            'Specialist Required': 'specialistRequired',
                            Reassignment: 'reassignment',
                            Other: 'other',
                          }
                          const reasonKey =
                            reasonKeyMap[assignmentReason] || assignmentReason.toLowerCase()
                          const translationKey = `pages.clients.modals.assignClient.reasons.${reasonKey}`
                          return (
                            <div key={assignmentReason} className="flex items-center gap-2">
                              <RadioItem
                                value={assignmentReason}
                                id={`reason-${assignmentReason}`}
                              />
                              <Label
                                htmlFor={`reason-${assignmentReason}`}
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
              </div>

              {/* Warning Message */}
              {!employeeId && !searcherId && (
                <div className="bg-warning-50 flex w-full items-center justify-center gap-2 rounded-md p-3">
                  <Icons.Warning
                    size={20}
                    className="text-warning-500 flex-shrink-0"
                    strokeWidth={2}
                  />
                  <p className="text-warning-800 text-sm">
                    {t('pages.clients.modals.assignClient.warningMessage')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
          {t('pages.clients.modals.assignClient.assignClient')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
