/**
 * Edit Payment Modal
 *
 * Modal for editing an existing payment.
 */

import { useState, useMemo } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'

export interface EditPaymentModalProps {
  open: boolean
  onClose: () => void
  payment: {
    paymentId: string
    amount: number
    paymentDate: string
    method: 'Bank Transfer' | 'Card Payment' | 'Other'
    reference: string
    createdBy: string
    createdAt: string
    currentDebt: number
  }
  onSave: (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Card Payment' | 'Other'
    reference: string
  }) => void
}

const formatCurrency = (amount: number) => {
  return `₴ ${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const formatCurrencySimple = (amount: number) => {
  return `₴ ${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export function EditPaymentModal({ open, onClose, payment, onSave }: EditPaymentModalProps) {
  // Parse original payment date
  const originalDate = useMemo(() => {
    const date = new Date(payment.paymentDate)
    return isNaN(date.getTime()) ? new Date() : date
  }, [payment.paymentDate])

  // Calculate days since creation
  const daysSinceCreation = useMemo(() => {
    const created = new Date(payment.createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }, [payment.createdAt])

  const [paymentAmount, setPaymentAmount] = useState<string>(payment.amount.toString())
  const [paymentDate, setPaymentDate] = useState<Date | null>(originalDate)
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Card Payment' | 'Other'>(
    payment.method
  )
  const [reference, setReference] = useState<string>(payment.reference)

  const amountValue = parseFloat(paymentAmount) || 0
  const originalAmount = payment.amount
  const originalDebt = payment.currentDebt + originalAmount // Debt before original payment
  const newDebt = originalDebt - amountValue
  const debtChange = amountValue - originalAmount

  const handleSave = () => {
    if (!paymentDate || amountValue <= 0) {
      // TODO: Show validation error
      return
    }

    onSave({
      amount: amountValue,
      date: paymentDate,
      method: paymentMethod,
      reference,
    })

    // Reset form
    setPaymentAmount(payment.amount.toString())
    setPaymentDate(originalDate)
    setPaymentMethod(payment.method)
    setReference(payment.reference)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setPaymentAmount(payment.amount.toString())
    setPaymentDate(originalDate)
    setPaymentMethod(payment.method)
    setReference(payment.reference)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={`Edit Payment #${payment.paymentId}`}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-200px)]">
        {/* Editing Payment Info */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            Editing Payment
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <div className="flex items-start gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Can edit:{' '}
                </span>
                <span className="text-dark-500 w-[120px] flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  Created {daysSinceCreation} {daysSinceCreation === 1 ? 'day' : 'days'} ago{' '}
                  <span className="font-light">(within 7-day limit)</span>
                </span>
              </div>
              <div className="flex items-start gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Requires:
                </span>
                <span className="text-dark-500 w-[120px] flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  Supervisor approval
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Original Payment Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            Original Payment
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            <div className="flex items-center gap-4 self-stretch">
              <div className="flex flex-1 flex-col items-start gap-1 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Amount: <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Date: <span className="font-medium">{payment.paymentDate}</span>
                  </span>
                </div>
              </div>

              <div className="mx-2 h-[46px] w-px bg-gray-200"></div>

              <div className="flex flex-1 flex-col items-start gap-1 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Method: <span className="font-medium">{payment.method}</span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Reference: <span className="font-medium">{payment.reference}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-6 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                Created by:{' '}
                <span className="font-medium">
                  {payment.createdBy} on{' '}
                  {new Date(payment.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}{' '}
                  {new Date(payment.createdAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Edit Payment Information Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            Edit Payment Information
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            <div className="flex items-start gap-5 self-stretch">
              {/* Payment Amount */}
              <div className="flex flex-1 flex-col items-start justify-center gap-2">
                <Label
                  htmlFor="edit-amount"
                  className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]"
                >
                  Payment Amount <span className="text-error-500">*</span>
                </Label>
                <div className="relative w-full">
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
                    <span className="text-dark-500 text-sm font-medium">₴</span>
                  </div>
                  <Input
                    id="edit-amount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="h-[42px] rounded-md pl-8"
                    inputSize="md"
                  />
                </div>
              </div>
              {/* Payment Date */}
              <div className="flex flex-1 flex-col items-start justify-center gap-2">
                <label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  Payment Date <span className="text-error-500">*</span>
                </label>
                <DateSelect
                  value={paymentDate}
                  onChange={({ value }) => setPaymentDate(value)}
                  format="yyyy-MM-dd"
                  className="max-h-[42px] rounded-md"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="flex flex-col items-start justify-center gap-2 self-stretch">
              <Label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Payment Method
              </Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as 'Bank Transfer' | 'Card Payment' | 'Other')
                }
                className="flex items-start gap-2 self-stretch"
              >
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Bank Transfer" id="bank-transfer" />
                  <Label
                    htmlFor="bank-transfer"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Bank Transfer
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Card Payment" id="card-payment" />
                  <Label
                    htmlFor="card-payment"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Card Payment
                  </Label>
                </div>
                <div className="flex flex-1 items-center gap-1">
                  <RadioItem value="Other" id="other" />
                  <Label
                    htmlFor="other"
                    className="cursor-pointer text-sm font-light text-gray-950"
                  >
                    Other
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Transaction Reference */}
            <div className="flex h-[71px] flex-col items-start justify-center gap-2 self-stretch">
              <Label
                htmlFor="transaction-reference"
                className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]"
              >
                Transaction Reference
              </Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                inputSize="md"
                id="transaction-reference"
                className="h-[42px] rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Impact Comparison Section */}
        <div className="flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            Impact comparison
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
            <div className="flex items-center gap-5 self-stretch">
              {/* Before Column */}
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  Before
                </span>
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Payment: <span className="font-medium">{formatCurrency(originalAmount)}</span>
                </span>
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Debt: <span className="font-medium">{formatCurrencySimple(originalDebt)}</span>
                </span>
              </div>

              {/* Arrow Icon */}
              <div className="w-[26px] self-stretch">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="27"
                  height="80"
                  viewBox="0 0 27 80"
                  fill="none"
                >
                  <path d="M6.44629 0.22589L26.4463 39.7259L6.44629 79.2259" stroke="#DFDFDF" />
                  <path d="M0.446289 0.22589L20.4463 39.7259L0.446286 79.2259" stroke="#DFDFDF" />
                </svg>
              </div>

              {/* After Column */}
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  After
                </span>
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Payment: <span className="font-medium">{formatCurrency(amountValue)}</span>
                </span>
                <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                  Debt: <span className="font-medium">{formatCurrencySimple(newDebt)}</span>
                </span>
              </div>
            </div>

            <div className="h-px w-full bg-gray-200" />

            {/* Change Summary */}
            <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
              Change:{' '}
              <span className="font-medium">
                {formatCurrency(Math.abs(debtChange))} {debtChange > 0 ? 'less' : 'more'} debt
              </span>
            </span>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col gap-3 self-stretch border-none">
        <div className="flex items-center gap-3 self-stretch">
          <Button
            variant="cancel"
            onClick={handleClose}
            className="h-12 flex-1 self-stretch rounded-md p-0"
          >
            Cancel
          </Button>
          <div className="flex flex-1 flex-col items-center gap-1">
            <Button
              variant="primary"
              leftIcon={<Icons.Success size={20} />}
              onClick={handleSave}
              className="h-12 w-full self-stretch rounded-md"
            >
              Save Changes
            </Button>
            <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
              Requires supervisor approval
            </span>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  )
}
