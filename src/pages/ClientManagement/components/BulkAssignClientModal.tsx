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
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import { useHasAnyPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { piiProps } from '@/lib/openreplay/pii'
import { toast } from 'sonner'

// Format currency for Ukrainian Hryvnia
const formatUAH = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  })
    .format(num)
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
    debt: string
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

  // Fetch active users for employee and searcher dropdowns (project-scoped)
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  // Map users to dropdown options (full name format)
  const userOptions = useMemo(() => {
    if (!operators) return []
    return operators.map((user) => ({
      id: user.id.toString(),
      name: user.full_name,
    }))
  }, [operators])

  const [employeeId, setEmployeeId] = useState<string>('')
  const [searcherId, setSearcherId] = useState<string>('')
  const [distributionMethod, setDistributionMethod] = useState<'assign-all' | 'distribute-evenly'>(
    'assign-all'
  )
  const [reason, setReason] = useState<string>('Workload Distribution')
  const [notes, setNotes] = useState<string>('')

  // Pattern Y for bulk (Option B): the BE accepts either `edit_clients` OR
  // `reassign_client_responsible` at the route, then per-client applies the
  // per-field rule from KAN-562 §3 (initial vs reassignment). The FE only
  // blocks the submit when the user has *neither* permission; otherwise let
  // the BE return per-client failures for clients that needed the reassign
  // perm the caller doesn't hold.
  const hasAnyAssignPerm = useHasAnyPermission([
    PERMISSIONS.CLIENTS.EDIT,
    PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE,
  ])

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalDebt = selectedClients.reduce((sum, client) => sum + (Number(client.debt) || 0), 0)
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

    if (!hasAnyAssignPerm) {
      toast.warning(t('errors:permissions.bulkAssign'))
      return
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
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.UserCheck01 size={20} className="text-primary-foreground" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.bulkAssignClient.title', { count: selectedCount })}
      />
      <ModalContent>
        <div className="flex flex-col gap-6">
          {/* Selected Clients Preview Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.bulkAssignClient.selectedClientsPreview')}
            </span>
            <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border p-4 sm:p-5 md:p-6">
              {/* Preview list */}
              <div className="flex flex-col items-start gap-3 self-stretch sm:gap-2">
                {previewClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex w-full flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-2"
                  >
                    <span
                      className="text-foreground w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[50%] sm:text-sm sm:tracking-[-0.28px]"
                      {...piiProps}
                    >
                      {client.fullName} (#{client.id})
                    </span>
                    <div className="w-full sm:w-[25%]">
                      <PriorityBadge priority={client.priority} variant="compact" />
                    </div>
                    <span className="text-foreground w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[25%] sm:text-sm sm:tracking-[-0.28px]">
                      {formatUAH(client.debt)} ₴
                    </span>
                  </div>
                ))}
                {remainingCount > 0 && (
                  <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                    {t('pages.clients.modals.bulkAssignClient.andMoreClients', {
                      count: remainingCount,
                      client: t(
                        `pages.clients.modals.bulkAssignClient.${remainingCount === 1 ? 'client' : 'clients'}`
                      ),
                    })}
                  </span>
                )}
              </div>
              <div className="bg-border my-2 h-px w-full" />
              {/* Summary */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                <div>
                  <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                    {t('pages.clients.modals.bulkAssignClient.totalDebt')}{' '}
                    <span className="font-medium">{formatUAH(summary.totalDebt)} ₴</span>
                  </span>
                </div>
                <div>
                  <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                    {t('pages.clients.modals.bulkAssignClient.avgScore')}{' '}
                    <span className="font-medium">{summary.avgScore}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Options Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.bulkAssignClient.assignmentOptions')}
            </span>
            <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border p-4 sm:gap-5 sm:p-5 md:p-6">
              <div className="flex w-full flex-col gap-4 self-stretch sm:flex-row sm:items-start sm:gap-4">
                {/* Employee Dropdown */}
                <div className="flex min-h-[63px] w-full flex-col items-start justify-center gap-1 sm:flex-1">
                  <Label
                    htmlFor="bulk-employee"
                    className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.assignEmployeeToAll')}
                  </Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger
                      id="bulk-employee"
                      className="h-[45px] w-full rounded-md sm:flex-1"
                    >
                      <SelectValue
                        placeholder={t('pages.clients.modals.bulkAssignClient.selectEmployee')}
                      />
                    </SelectTrigger>
                    <SelectContent searchable>
                      {userOptions.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-6 text-center text-sm">
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
                <div className="flex min-h-[63px] w-full flex-col items-start justify-center gap-1 sm:flex-1">
                  <Label
                    htmlFor="bulk-searcher"
                    className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.assignSearcherToAll')}
                  </Label>
                  <Select value={searcherId} onValueChange={setSearcherId}>
                    <SelectTrigger
                      id="bulk-searcher"
                      className="h-[45px] w-full rounded-md sm:flex-1"
                    >
                      <SelectValue
                        placeholder={t('pages.clients.modals.bulkAssignClient.selectSearcher')}
                      />
                    </SelectTrigger>
                    <SelectContent searchable>
                      {userOptions.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-6 text-center text-sm">
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
              <div className="flex w-full flex-col gap-4 self-stretch sm:flex-row sm:items-start sm:gap-2">
                {/* Distribution Method */}
                <div className="flex w-full flex-col items-start justify-center gap-1 sm:self-stretch">
                  <Label className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]">
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
                          className="text-foreground cursor-pointer text-xs font-light tracking-[-0.24px]"
                        >
                          {t('pages.clients.modals.bulkAssignClient.assignAllToSelected')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <RadioItem value="distribute-evenly" id="distribute-evenly" disabled />
                        <Label
                          htmlFor="distribute-evenly"
                          className="text-muted-foreground cursor-not-allowed text-xs font-light tracking-[-0.24px] opacity-50"
                        >
                          {t('pages.clients.modals.bulkAssignClient.distributeEvenly')}
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Assignment Reason Dropdown */}
                <div className="flex min-h-[63px] w-full flex-col items-start justify-center gap-1 sm:flex-1">
                  <Label
                    htmlFor="bulk-reason"
                    className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.assignmentReason')}
                  </Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger
                      id="bulk-reason"
                      className="h-[45px] w-full rounded-md sm:flex-1"
                    >
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
              <div className="flex w-full items-start gap-4 self-stretch">
                {/* Notes */}
                <div className="flex w-full flex-col items-start justify-center gap-1 sm:flex-1">
                  <Label
                    htmlFor="bulk-notes"
                    className="text-foreground text-xs leading-[140%] font-medium tracking-[-0.24px]"
                  >
                    {t('pages.clients.modals.bulkAssignClient.notes')}
                  </Label>
                  <Textarea
                    id="bulk-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('pages.clients.modals.bulkAssignClient.enterAdditionalNotes')}
                    textareaSize="md"
                    className="text-foreground w-full rounded-md text-xs leading-[140%] font-light tracking-[-0.24px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="border-warning-200 bg-warning-100/40 text-warning-700 flex w-full items-center gap-2 rounded-md border p-3">
            <Icons.Warning size={20} className="text-warning-500 flex-shrink-0" strokeWidth={2} />
            <p className="text-warning-700 text-sm">
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
          {t('pages.clients.modals.bulkAssignClient.assignAllClients')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
