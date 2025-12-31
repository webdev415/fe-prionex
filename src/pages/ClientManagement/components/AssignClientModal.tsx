/**
 * Assign Client Modal
 *
 * Modal for assigning a single client to an employee or searcher.
 */

import { useState } from 'react'
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
import { useClient } from '@/features/clients/hooks/useClients'
import { usePriorityThresholds } from '@/features/clients/hooks/useConfig'
import { mapScoreToPriority } from '@/features/clients/api/configApi'
import { PriorityBadge } from './PriorityBadge'

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
  onAssign: (assignmentData: {
    employeeId?: string
    searcherId?: string
    reason: string
    notes?: string
  }) => void
}

// Mock employees and searchers - replace with actual API call
const mockEmployees = [
  { id: '1', name: 'John Smith' },
  { id: '2', name: 'Jane Doe' },
  { id: '3', name: 'Mike Johnson' },
]

const mockSearchers = [
  { id: '1', name: 'Sarah Williams' },
  { id: '2', name: 'Tom Brown' },
  { id: '3', name: 'Emily Davis' },
]

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

  const [employeeId, setEmployeeId] = useState<string>('')
  const [searcherId, setSearcherId] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const handleSubmit = () => {
    if (!employeeId && !searcherId) {
      return // Validation: at least one must be selected
    }

    onAssign({
      employeeId: employeeId || undefined,
      searcherId: searcherId || undefined,
      reason,
      notes: notes || undefined,
    })

    // Reset form
    setEmployeeId('')
    setSearcherId('')
    setReason('')
    setNotes('')
    onClose()
  }

  const handleCancel = () => {
    // Reset form
    setEmployeeId('')
    setSearcherId('')
    setReason('')
    setNotes('')
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
  const totalDebt = client?.total_debt || 0
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
        title={`Assign Client: ${fullName}`}
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

                  {/* Notes Skeleton */}
                  <div className="flex flex-1 flex-col items-start justify-center gap-1">
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="h-20 w-full animate-pulse rounded-md bg-gray-200" />
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
                Client Information
              </span>
              <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                      Name
                    </span>
                    <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {fullName}
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                      Email
                    </span>
                    <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {email}
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                      Phone
                    </span>
                    <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {phone}
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                      Priority
                    </span>
                    <div className="flex items-center gap-2">
                      <PriorityBadge
                        priority={priority as 'Critical' | 'High' | 'Medium' | 'Low'}
                        variant="compact"
                      />
                      <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        Score: {score}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                      Total Debt
                    </span>
                    <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {formatUAH(totalDebt)} ₴ ({debtCount} {debtCount === 1 ? 'debt' : 'debts'})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Details Section */}
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Assignment Details
              </span>
              <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
                <div className="flex items-start gap-4 self-stretch">
                  {/* Employee Dropdown */}
                  <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
                    <Label
                      htmlFor="employee"
                      className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                    >
                      Employee (Optional)
                    </Label>
                    <Select value={employeeId} onValueChange={setEmployeeId}>
                      <SelectTrigger id="employee" className="h-[45px] flex-1 rounded-md">
                        <SelectValue placeholder="Select employee..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mockEmployees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Searcher Dropdown */}
                  <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
                    <Label
                      htmlFor="searcher"
                      className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                    >
                      Searcher (Optional)
                    </Label>
                    <Select value={searcherId} onValueChange={setSearcherId}>
                      <SelectTrigger id="searcher" className="h-[45px] flex-1 rounded-md">
                        <SelectValue placeholder="Select searcher..." />
                      </SelectTrigger>
                      <SelectContent>
                        {mockSearchers.map((searcher) => (
                          <SelectItem key={searcher.id} value={searcher.id}>
                            {searcher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-start gap-4 self-stretch">
                  {/* Assignment Reason */}
                  <div className="flex flex-1 flex-col items-start justify-center gap-1">
                    <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      Assignment Reason
                    </Label>
                    <RadioGroup value={reason} onValueChange={setReason}>
                      <div className="flex flex-col gap-2">
                        {assignmentReasons.map((assignmentReason) => (
                          <div key={assignmentReason} className="flex items-center gap-2">
                            <RadioItem value={assignmentReason} id={`reason-${assignmentReason}`} />
                            <Label
                              htmlFor={`reason-${assignmentReason}`}
                              className="text-dark-500 text-xs font-light tracking-[-0.24px]"
                            >
                              {assignmentReason}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Notes */}
                  <div className="flex flex-1 flex-col items-start justify-center gap-1">
                    <Label
                      htmlFor="notes"
                      className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
                    >
                      Notes (Optional)
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter additional notes..."
                      textareaSize="md"
                      className="text-dark-500 rounded-md text-xs leading-[140%] font-light tracking-[-0.24px]"
                    />
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
                    Note: At least one assignment (Employee or Searcher) must be selected.
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
          {t('pages.clients.assignClient', 'Assign Client')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
