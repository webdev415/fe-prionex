/**
 * Cancel Payment Modal
 *
 * Modal for confirming payment cancellation with detailed information and warnings.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface PaymentToCancel {
  paymentId: string
  client: string
  amount: number
  paymentDate: string
  method: string
  reference: string
  status: 'Verified' | 'Pending' | 'Cancelled'
  createdBy: string
  createdAt: string
  currentDebt: number
}

export interface CancelPaymentModalProps {
  open: boolean
  onClose: () => void
  payment: PaymentToCancel
  onConfirm: (data: { reason: string; additionalDetails: string }) => void
}

const formatCurrency = (amount: number) => {
  return `₴ ${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function CancelPaymentModal({ open, onClose, payment, onConfirm }: CancelPaymentModalProps) {
  const [reason, setReason] = useState<string>('')
  const [additionalDetails, setAdditionalDetails] = useState<string>('')
  const [isConfirmed, setIsConfirmed] = useState(false)

  const cancelledAmount = payment.amount
  const newDebtAfterCancel = payment.currentDebt + cancelledAmount
  const debtIncrease = cancelledAmount

  const minDetailsLength = 20
  const maxDetailsLength = 100
  const detailsLength = additionalDetails.length
  const isDetailsValid = detailsLength >= minDetailsLength && detailsLength <= maxDetailsLength

  const canConfirm = reason && isDetailsValid && isConfirmed

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({ reason, additionalDetails })
    // Reset form
    setReason('')
    setAdditionalDetails('')
    setIsConfirmed(false)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setReason('')
    setAdditionalDetails('')
    setIsConfirmed(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.CancelCircle size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title="Cancel Payment: Confirmation Required"
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-200px)]">
        {/* Warning Banner */}
        <div className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white bg-white/50 px-6 py-3">
          <Icons.Warning size={24} className="text-error-500" />
          <span className="text-error-500 text-center text-sm leading-[150%] font-medium tracking-[-0.28px]">
            WARNING: This action cannot be undone
          </span>
        </div>

        <div className="mb-4 flex flex-col items-start gap-4 self-stretch">
          {/* Payment to Cancel Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Payment to cancel
              </span>
            </div>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 px-6 py-5">
              <div className="flex items-start gap-3 self-stretch">
                <div className="flex flex-1 flex-col items-start gap-1 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Payment ID: <span className="font-medium">{payment.paymentId}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Client: <span className="font-medium">{payment.client}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Amount: <span className="font-medium">{formatCurrency(payment.amount)}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Payment Date: <span className="font-medium">{payment.paymentDate}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Method: <span className="font-medium">{payment.method}</span>
                    </span>
                  </div>
                </div>

                <div className="mx-2 h-[121px] w-px bg-gray-200"></div>

                <div className="flex flex-1 flex-col items-start gap-1 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Reference: <span className="font-medium">{payment.reference}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-2 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Status:
                    </span>
                    <div className="flex items-center gap-1">
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
                          'text-sm font-medium',
                          payment.status === 'Verified' ? 'text-success-500' : 'text-error-500'
                        )}
                      >
                        {payment.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Reference: <span className="font-medium">{payment.paymentDate}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Created by: <span className="font-medium">{payment.createdBy}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Created: <span className="font-medium">{payment.createdAt}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Impact on Client Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Impact on client
              </span>
            </div>
            <div className="flex w-full flex-col items-start justify-center gap-2 rounded-xl border border-white bg-white/50 px-6 py-5">
              <div className="flex items-center gap-3 self-stretch">
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Current Debt:{' '}
                      <span className="font-medium">{formatCurrency(payment.currentDebt)}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Cancelled Payment:{' '}
                      <span className="font-medium">+{formatCurrency(cancelledAmount)}</span>
                    </span>
                  </div>
                </div>
                <div className="w-[26px] self-stretch">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="27"
                    height="51"
                    viewBox="0 0 27 51"
                    fill="none"
                  >
                    <path d="M4.36595 0.23175L17.4429 25.2318L4.36595 50.2317" stroke="#DFDFDF" />
                    <path d="M0.443097 0.23175L13.52 25.2318L0.443095 50.2317" stroke="#DFDFDF" />
                  </svg>
                </div>
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex flex-col items-start gap-1 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      New Debt After Cancel:
                    </span>
                    <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {formatCurrency(newDebtAfterCancel)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="my-2 h-px w-full bg-gray-200" />
              <div className="flex items-center justify-center gap-1 self-stretch">
                <Icons.ArrowUp02 size={16} className="text-error-500" />
                <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  Client debt will INCREASE by {formatCurrency(debtIncrease)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cancellation Reason Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              Cancellation Reason
            </span>
          </div>
          <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            <div className="flex flex-col items-start gap-1 self-stretch">
              <Label
                required
                className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
              >
                Select Reason:
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1.5 h-[45px]">
                  <SelectValue placeholder="Select Reason of Cancellation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incorrect Amount">Incorrect Amount</SelectItem>
                  <SelectItem value="Duplicate Payment">Duplicate Payment</SelectItem>
                  <SelectItem value="Payment Error">Payment Error</SelectItem>
                  <SelectItem value="Client Request">Client Request</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-start gap-2 self-stretch">
              <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                Additional Details:
              </Label>
              <div className="relative w-full">
                <Textarea
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="Required - min 20 characters"
                  textareaSize="md"
                  variant={detailsLength > 0 && !isDetailsValid ? 'error' : 'default'}
                  maxLength={maxDetailsLength}
                  className="pr-16"
                />
                <div className="absolute right-4 bottom-3 text-xs text-gray-500">
                  {detailsLength}/{maxDetailsLength}
                </div>
              </div>
              {detailsLength > 0 && detailsLength < minDetailsLength && (
                <p className="text-error-500 mt-1.5 text-xs">
                  Minimum {minDetailsLength} characters required
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Consequences Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            Consequences
          </span>
          <div className="flex flex-col items-start justify-center gap-2.5 self-stretch rounded-xl border border-white/50 bg-white/50 p-5 px-6">
            <div className="flex items-start justify-between self-stretch">
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={20} className="text-gray-700" />
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Payment status: <span className="font-medium">CANCELLED</span>
                </span>
              </div>
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={20} className="text-gray-700" />
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Client debt restored
                </span>
              </div>
            </div>
            <div className="flex items-start justify-between self-stretch">
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={20} className="text-gray-700" />
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Receipt invalidated
                </span>
              </div>
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={20} className="text-gray-700" />
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Cannot be undone
                </span>
              </div>
            </div>
            <div className="flex items-start justify-between self-stretch">
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={20} className="text-gray-700" />
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Logged in audit trail
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="flex items-center gap-1 self-stretch">
          <Checkbox
            checked={isConfirmed}
            onCheckedChange={(checked) => setIsConfirmed(checked === true)}
            id="confirm-cancellation"
          />
          <Label
            htmlFor="confirm-cancellation"
            className="text-dark-500 cursor-pointer text-sm leading-[150%] font-medium tracking-[-0.28px]"
          >
            I confirm this cancellation is correct
          </Label>
        </div>
      </ModalContent>
      <ModalFooter className="flex items-start gap-4 self-stretch border-none">
        <Button variant="cancel" onClick={handleClose} className="flex-1 self-stretch p-0">
          Cancel
        </Button>
        <div className="flex flex-1 flex-col items-center gap-2">
          <Button
            variant="primary"
            leftIcon={<Icons.Success size={18} className="text-dark-500" />}
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="self-stretch p-0"
          >
            Confirm Cancellation
          </Button>
          <p className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
            Requires supervisor approval
          </p>
        </div>
      </ModalFooter>
    </Modal>
  )
}
