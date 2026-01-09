/**
 * Bulk Assign Client Modal
 *
 * Modal for assigning multiple clients to employees or searchers.
 */

import { useState, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { PriorityBadge } from './PriorityBadge'
import { useUsers } from '@/features/users/hooks/useUsers'

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

interface BulkAssignClientModalProps {
  open: boolean
  selectedClientIds: Set<number | string>
  selectedClients: Array<{
    id: number
    fullName: string
    priority: 'Critical' | 'High' | 'Medium' | 'Low'
    score: number
    debt: number
  }>
  totalSelectedCount?: number // Total count when all clients are selected
  onClose: () => void
  onAssign: (assignmentData: {
    employeeId?: string
    searcherId?: string
    distributionMethod: 'assign-all' | 'distribute-evenly'
    reason: string
    notes?: string
  }) => void
}

const assignmentReasons = [
  'New Client',
  'Workload Distribution',
  'Specialist Required',
  'Reassignment',
  'Other',
]

export function BulkAssignClientModal({
  open,
  selectedClientIds: _selectedClientIds,
  selectedClients,
  totalSelectedCount,
  onClose,
  onAssign,
}: BulkAssignClientModalProps) {
  const { t } = useTranslation('common')

  // Fetch active users for employee and searcher dropdowns
  const { data: usersResponse } = useUsers({
    status: 'active',
    page_size: 100,
  })

  // Map users to dropdown options (full name format)
  const userOptions = useMemo(() => {
    if (!usersResponse?.users) return []
    return usersResponse.users.map((user) => ({
      id: user.id.toString(),
      name: [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' '),
    }))
  }, [usersResponse])

  const [employeeId, setEmployeeId] = useState<string>('')
  const [searcherId, setSearcherId] = useState<string>('')
  const [distributionMethod, setDistributionMethod] = useState<'assign-all' | 'distribute-evenly'>(
    'assign-all'
  )
  const [reason, setReason] = useState<string>('Workload Distribution')
  const [notes, setNotes] = useState<string>('')

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalDebt = selectedClients.reduce((sum, client) => sum + client.debt, 0)
    const avgScore =
      selectedClients.length > 0
        ? selectedClients.reduce((sum, client) => sum + client.score, 0) / selectedClients.length
        : 0

    return {
      totalDebt,
      avgScore: Math.round(avgScore),
    }
  }, [selectedClients])

  // Show preview of first 3 clients
  const previewClients = selectedClients.slice(0, 3)
  // Calculate remaining count using totalSelectedCount if available, otherwise use selectedClients.length
  const totalCount = totalSelectedCount ?? selectedClients.length
  const remainingCount = totalCount - previewClients.length

  const handleSubmit = () => {
    if (!employeeId && !searcherId) {
      return // Validation: at least one must be selected
    }

    if (!reason) {
      return // Reason is required
    }

    onAssign({
      employeeId: employeeId || undefined,
      searcherId: searcherId || undefined,
      distributionMethod,
      reason,
      notes: notes || undefined,
    })

    // Reset form
    setEmployeeId('')
    setSearcherId('')
    setDistributionMethod('assign-all')
    setReason('Workload Distribution')
    setNotes('')
    onClose()
  }

  const handleCancel = () => {
    // Reset form
    setEmployeeId('')
    setSearcherId('')
    setDistributionMethod('assign-all')
    setReason('Workload Distribution')
    setNotes('')
    onClose()
  }

  const canSubmit = (employeeId || searcherId) && reason
  // Use totalSelectedCount if provided (for all-selected case), otherwise use selectedClients array length
  const selectedCount = totalSelectedCount ?? selectedClients.length

  return (
    <Modal open={open} onClose={handleCancel} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.UserCheck01 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.bulkAssignClient.title', { count: selectedCount })}
      />
      <ModalContent>
        <div className="flex flex-col gap-6">
          {/* Selected Clients Preview Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.bulkAssignClient.selectedClientsPreview')}
            </span>
            <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
              {/* Preview list */}
              <div className="flex flex-col items-start gap-2 self-stretch">
                {previewClients.map((client) => (
                  <div key={client.id} className="flex items-center gap-2 self-stretch">
                    <span className="text-dark-500 w-[50%] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {client.fullName} (#{client.id})
                    </span>
                    <div className="w-[25%]">
                      <PriorityBadge priority={client.priority} variant="compact" />
                    </div>
                    <span className="text-dark-500 w-[25%] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {' '}
                      {formatUAH(client.debt)} ₴
                    </span>
                  </div>
                ))}
                {remainingCount > 0 && (
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.bulkAssignClient.andMoreClients', {
                      count: remainingCount,
                      client: t(
                        `pages.clients.modals.bulkAssignClient.${remainingCount === 1 ? 'client' : 'clients'}`
                      ),
                    })}
                  </span>
                )}
              </div>
              <div className="my-2 h-px w-full bg-gray-200" />
              {/* Summary */}
              <div className="flex items-center gap-5">
                <div>
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.bulkAssignClient.totalDebt')}{' '}
                    <span className="font-medium">{formatUAH(summary.totalDebt)} ₴</span>
                  </span>
                </div>
                <div>
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.bulkAssignClient.avgScore')}{' '}
                    <span className="font-medium">{summary.avgScore}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Options Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.bulkAssignClient.assignmentOptions')}
            </span>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
              <div className="flex items-start gap-4 self-stretch">
                {/* Employee Dropdown */}
                <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
                  <Label
                    htmlFor="bulk-employee"
                    className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.assignEmployeeToAll')}
                  </Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger id="bulk-employee" className="h-[45px] flex-1 rounded-md">
                      <SelectValue
                        placeholder={t('pages.clients.modals.bulkAssignClient.selectEmployee')}
                      />
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

                {/* Searcher Dropdown */}
                <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
                  <Label
                    htmlFor="bulk-searcher"
                    className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.assignSearcherToAll')}
                  </Label>
                  <Select value={searcherId} onValueChange={setSearcherId}>
                    <SelectTrigger id="bulk-searcher" className="h-[45px] flex-1 rounded-md">
                      <SelectValue
                        placeholder={t('pages.clients.modals.bulkAssignClient.selectSearcher')}
                      />
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
              </div>
              <div className="flex items-start gap-2 self-stretch">
                {/* Distribution Method */}
                <div className="flex flex-col items-start justify-center gap-1 self-stretch">
                  <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.clients.modals.bulkAssignClient.distributionMethod')}
                  </Label>
                  <RadioGroup
                    value={distributionMethod}
                    onValueChange={(value) =>
                      setDistributionMethod(value as 'assign-all' | 'distribute-evenly')
                    }
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-0.5">
                        <RadioItem value="assign-all" id="distribute-assign-all" />
                        <Label
                          htmlFor="distribute-assign-all"
                          className="text-dark-500 cursor-pointer text-xs font-light tracking-[-0.24px]"
                        >
                          {t('pages.clients.modals.bulkAssignClient.assignAllToSelected')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <RadioItem value="distribute-evenly" id="distribute-evenly" disabled />
                        <Label
                          htmlFor="distribute-evenly"
                          className="text-dark-500 cursor-not-allowed text-xs font-light tracking-[-0.24px] opacity-50"
                        >
                          {t('pages.clients.modals.bulkAssignClient.distributeEvenly')}
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Assignment Reason Dropdown */}
                <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
                  <Label
                    htmlFor="bulk-reason"
                    className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.assignmentReason')}
                  </Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="bulk-reason" className="h-[45px] flex-1 rounded-md">
                      <SelectValue
                        placeholder={t('pages.clients.modals.bulkAssignClient.selectReason')}
                      />
                    </SelectTrigger>
                    <SelectContent>
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
                        const translationKey = `pages.clients.modals.bulkAssignClient.reasons.${reasonKey}`
                        return (
                          <SelectItem key={assignmentReason} value={assignmentReason}>
                            {t(translationKey, assignmentReason)}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-start gap-4 self-stretch">
                {/* Notes */}
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <Label
                    htmlFor="bulk-notes"
                    className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.notes')}
                  </Label>
                  <Textarea
                    id="bulk-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('pages.clients.modals.bulkAssignClient.enterAdditionalNotes')}
                    textareaSize="md"
                    className="text-dark-500 rounded-md text-xs leading-[140%] font-light tracking-[-0.24px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-warning-50 flex w-full items-center gap-2 rounded-md p-3">
            <Icons.Warning size={20} className="text-warning-500 flex-shrink-0" strokeWidth={2} />
            <p className="text-warning-800 text-sm">
              {t('pages.clients.modals.bulkAssignClient.warningMessage', {
                count: selectedCount,
                client: t(
                  `pages.clients.modals.bulkAssignClient.${selectedCount === 1 ? 'client' : 'clients'}`
                ),
              })}
            </p>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={handleCancel}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-[45px] flex-1 text-sm"
        >
          {t('pages.clients.modals.bulkAssignClient.assignAllClients')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
