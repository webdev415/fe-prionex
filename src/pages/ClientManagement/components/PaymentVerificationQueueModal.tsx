/**
 * Payment Verification Queue Modal
 *
 * Modal for verifying pending payments with expandable payment cards.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { CancelPaymentModal } from './CancelPaymentModal'

export interface PendingPayment {
  id: string
  paymentId: string
  submittedAt: string
  client: string
  project: string
  amount: number
  method: string
  date: string
  reference: string
  currentDebt: number
  newDebt: number
}

export interface ProcessedPayment {
  id: string
  paymentId: string
  status: 'Verified' | 'Rejected'
  amount: number
  action: string
  time: string
}

export interface PaymentVerificationQueueModalProps {
  open: boolean
  onClose: () => void
  pendingPayments: PendingPayment[]
  processedPayments: ProcessedPayment[]
  onVerify: (paymentId: string) => void
  onReject: (paymentId: string, payment: PendingPayment) => void
  onRefresh?: () => void
}

const formatCurrency = (amount: number) => {
  return `₴ ${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const formatTimeAgo = (timeString: string) => {
  // Simple implementation - in real app, use a library like date-fns
  return timeString
}

export function PaymentVerificationQueueModal({
  open,
  onClose,
  pendingPayments,
  processedPayments,
  onVerify,
  onReject,
  onRefresh,
}: PaymentVerificationQueueModalProps) {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [sortBy, setSortBy] = useState('Oldest First')
  const [filter, setFilter] = useState('All Projects')
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(
    new Set([pendingPayments[0]?.id])
  )
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPaymentForCancel, setSelectedPaymentForCancel] = useState<PendingPayment | null>(
    null
  )

  const toggleExpanded = (paymentId: string) => {
    const newExpanded = new Set(expandedPayments)
    if (newExpanded.has(paymentId)) {
      newExpanded.delete(paymentId)
    } else {
      newExpanded.add(paymentId)
    }
    setExpandedPayments(newExpanded)
  }

  const handleRejectClick = (payment: PendingPayment) => {
    setSelectedPaymentForCancel(payment)
    setIsCancelModalOpen(true)
  }

  const handleCancelConfirm = (_data: { reason: string; additionalDetails: string }) => {
    if (selectedPaymentForCancel) {
      onReject(selectedPaymentForCancel.id, selectedPaymentForCancel)
      setIsCancelModalOpen(false)
      setSelectedPaymentForCancel(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.MoneyReceive01 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title="Payment Verification Queue"
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-200px)]">
        {/* Pending Verification Section */}
        <div className="mb-4 flex items-start justify-between self-stretch">
          <span className="text-dark-500 text-xl leading-[132%] font-light tracking-[-0.4px]">
            Pending Verification <span className="text-gray-700">({pendingPayments.length})</span>
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-6 items-center gap-3">
              <ToggleSwitch checked={autoRefresh} onChange={setAutoRefresh} />
              <span className="text-secondary-800 text-sm">Auto-refresh</span>
            </div>
            <LinkButton
              variant="regular-secondary"
              leftIcon={<Icons.Reload className="!h-6 !w-6" strokeWidth={1.5} />}
              onClick={onRefresh}
            >
              Refresh
            </LinkButton>
          </div>
        </div>
        <div className="mb-4 flex items-start gap-4 self-stretch">
          <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
            <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              Sort by:
            </span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-[45px] flex-1 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Oldest First">Oldest First</SelectItem>
                <SelectItem value="Newest First">Newest First</SelectItem>
                <SelectItem value="Amount (High to Low)">Amount (High to Low)</SelectItem>
                <SelectItem value="Amount (Low to High)">Amount (Low to High)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex h-[63px] flex-1 flex-col items-start justify-center gap-1">
            <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              Filter:
            </span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-[45px] flex-1 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Projects">All Projects</SelectItem>
                <SelectItem value="PrivatBank Collection">PrivatBank Collection</SelectItem>
                <SelectItem value="Other Project">Other Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pending Payment Cards */}
        <div className="space-y-4">
          {pendingPayments.map((payment) => {
            const isExpanded = expandedPayments.has(payment.id)
            return (
              <div key={payment.id} className="mb-4 flex flex-col items-start gap-2 self-stretch">
                {/* Payment Header */}
                <div className="flex items-start justify-between self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    Payment #{payment.paymentId}
                  </span>
                  <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    Submitted: {formatTimeAgo(payment.submittedAt)}
                  </span>
                </div>

                {/* Payment Details - Always visible */}
                {isExpanded && (
                  <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
                    <div className="flex flex-col items-start gap-2 self-stretch">
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Client:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {payment.client}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Project:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {payment.project}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Amount:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Method:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {payment.method}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Date:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {payment.date}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Reference:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {payment.reference}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Current Debt:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {formatCurrency(payment.currentDebt)}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          New Debt:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {formatCurrency(payment.newDebt)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-start gap-5 self-stretch">
                      <Button
                        variant="secondary"
                        leftIcon={<Icons.CancelCircle size={18} className="text-white" />}
                        onClick={() => handleRejectClick(payment)}
                        className="flex-1"
                      >
                        Reject Payment
                      </Button>
                      <Button
                        variant="primary"
                        leftIcon={<Icons.CheckmarkSquare03 size={18} className="text-dark-500" />}
                        onClick={() => onVerify(payment.id)}
                        className="flex-1"
                      >
                        Verify & Approve
                      </Button>
                    </div>
                  </div>
                )}
                {/* Collapsed View - Show minimal info */}
                {!isExpanded && (
                  <div className="flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border border-white/100 bg-white/50 p-[20px_24px]">
                    <div className="flex flex-col items-start gap-1 self-stretch">
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Client:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {payment.client}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Amount:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-600">
                          Method:
                        </span>
                        <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          {payment.method}
                        </span>
                      </div>
                    </div>

                    <LinkButton
                      variant="regular-secondary"
                      leftIcon={<Icons.ArrowDown className="!h-5 !w-5" />}
                      onClick={() => toggleExpanded(payment.id)}
                      className="p-0"
                    >
                      Expand Details
                    </LinkButton>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Recently Processed Section */}
        {processedPayments.length > 0 && (
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              Recently Processed
            </span>
            <div className="flex flex-col items-start justify-center gap-0 self-stretch rounded-xl border border-white bg-white/50 p-3 px-6">
              {processedPayments.map((payment) => (
                <>
                  <div key={payment.id} className="flex items-center gap-5 self-stretch">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full',
                          payment.status === 'Verified' ? 'bg-success-200' : 'bg-error-200'
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            payment.status === 'Verified' ? 'bg-success-500' : 'bg-error-500'
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-sm leading-[150%] font-medium tracking-[-0.28px]',
                          payment.status === 'Verified' ? 'text-success-500' : 'text-error-500'
                        )}
                      >
                        {payment.status}
                      </span>
                    </div>
                    <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {payment.paymentId}
                    </span>
                    <div className="flex flex-1 items-start justify-center gap-2.5">
                      <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col items-start gap-1">
                      <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        {payment.action}
                      </span>
                      <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                        {formatTimeAgo(payment.time)}
                      </span>
                    </div>
                  </div>
                  {payment.id !== processedPayments[processedPayments.length - 1].id && (
                    <div className="h-px w-full bg-gray-200" />
                  )}
                </>
              ))}
            </div>
          </div>
        )}
      </ModalContent>
      {/* Cancel Payment Modal */}
      {selectedPaymentForCancel && (
        <CancelPaymentModal
          open={isCancelModalOpen}
          onClose={() => {
            setIsCancelModalOpen(false)
            setSelectedPaymentForCancel(null)
          }}
          payment={{
            paymentId: selectedPaymentForCancel.paymentId,
            client: selectedPaymentForCancel.client,
            amount: selectedPaymentForCancel.amount,
            paymentDate: selectedPaymentForCancel.date,
            method: selectedPaymentForCancel.method,
            reference: selectedPaymentForCancel.reference,
            status: 'Verified',
            createdBy: 'Operator Sidorov',
            createdAt: '2025-12-10 09:15:32',
            currentDebt: selectedPaymentForCancel.currentDebt,
          }}
          onConfirm={handleCancelConfirm}
        />
      )}
    </Modal>
  )
}
