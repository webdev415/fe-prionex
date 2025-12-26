/**
 * Record Payment Modal
 *
 * Modal for recording a new payment for a client.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  customerName: string
  currentDebt: number
  onSave: (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Card Payment' | 'Other'
    status: 'Pending Verification' | 'Verified'
    generateReceipt: boolean
    updateBalance: boolean
  }) => void
}

const formatCurrency = (amount: number) => {
  return `₴ ${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function RecordPaymentModal({
  open,
  onClose,
  customerName,
  currentDebt,
  onSave,
}: RecordPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState<string>('10000.00')
  const [paymentDate, setPaymentDate] = useState<Date | null>(new Date())
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Card Payment' | 'Other'>(
    'Bank Transfer'
  )
  const [paymentStatus, setPaymentStatus] = useState<'Pending Verification' | 'Verified'>(
    'Pending Verification'
  )
  const [generateReceipt, setGenerateReceipt] = useState(true)
  const [updateBalance, setUpdateBalance] = useState(false)

  const amountValue = parseFloat(paymentAmount) || 0
  const minAmount = 100
  const maxAmount = currentDebt
  const newDebt = currentDebt - amountValue
  const hasDebt = newDebt > 0

  const handleSave = (status: 'Pending Verification' | 'Verified') => {
    if (!paymentDate || amountValue < minAmount || amountValue > maxAmount) {
      // TODO: Show validation error
      return
    }

    onSave({
      amount: amountValue,
      date: paymentDate,
      method: paymentMethod,
      status,
      generateReceipt,
      updateBalance,
    })

    // Reset form
    setPaymentAmount('10000.00')
    setPaymentDate(new Date())
    setPaymentMethod('Bank Transfer')
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setPaymentAmount('10000.00')
    setPaymentDate(new Date())
    setPaymentMethod('Bank Transfer')
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.MoneyReceive01 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title="Record Payment"
        className="pb-6"
      />

      <ModalContent className="max-h-[calc(90vh-250px)]">
        {/* Client Info Section */}
        <div className="mb-6 flex items-center justify-between self-stretch">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
              <Icons.User size={20} className="text-dark-500" />
            </div>
            <span className="text-dark-500 text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
              {customerName}
            </span>
          </div>
          <span className="text-dark-500 text-base leading-[155%] font-light tracking-[-0.32px]">
            Current Debt: <span className="font-medium">{formatCurrency(currentDebt)}</span>
          </span>
        </div>

        {/* Two Column Layout */}
        <div className="mb-6 flex items-start gap-4 self-stretch">
          {/* Left Column - Payment Information */}
          <div className="flex flex-1 flex-col items-start gap-2">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              Payment Information
            </span>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-5">
              <div className="flex flex-col items-start gap-5 self-stretch">
                {/* Payment Amount */}
                <div className="flex flex-col items-start justify-end gap-2 self-stretch">
                  <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    Payment Amount
                  </Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    inputSize="md"
                    className="rounded-md"
                  />
                  <div className="flex items-center gap-2 self-stretch">
                    <Icons.Money01 size={20} className="text-gray-700" />
                    <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                      (min: {formatCurrency(minAmount)}, max: {formatCurrency(maxAmount)})
                    </span>
                  </div>
                </div>
                {/* Payment Date */}
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    Payment Date
                  </Label>
                  <DateSelect
                    value={paymentDate}
                    onChange={({ value }) => setPaymentDate(value)}
                    placeholder="Select date"
                    className="rounded-md"
                  />
                </div>
              </div>
              {/* Payment Method */}
              <div className="flex flex-col items-start gap-2 self-stretch">
                <Label className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  Payment Method:
                </Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setPaymentMethod(value as 'Bank Transfer' | 'Card Payment' | 'Other')
                  }
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioItem value="Bank Transfer" id="method-bank" />
                    <Label
                      htmlFor="method-bank"
                      className="text-dark-500 cursor-pointer text-sm font-light"
                    >
                      Bank Transfer
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Card Payment" id="method-card" />
                    <Label
                      htmlFor="method-card"
                      className="text-dark-500 cursor-pointer text-sm font-light"
                    >
                      Card Payment
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Other" id="method-other" />
                    <Label
                      htmlFor="method-other"
                      className="text-dark-500 cursor-pointer text-sm font-light"
                    >
                      Other
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          {/* Right Column - Impact Preview */}
          <div className="flex flex-1 flex-col items-start gap-2 self-stretch">
            <h3 className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              Impact Preview
            </h3>

            <div className="flex flex-1 flex-col items-start gap-6 self-stretch rounded-xl border border-white/100 bg-white/50 p-6">
              <div className="flex flex-col items-start gap-4 self-stretch">
                <div className="flex items-center gap-5 self-stretch">
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    Current Total Debt:
                  </span>
                  <div className="flex flex-1 items-start justify-end gap-2.5">
                    <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {formatCurrency(currentDebt)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <div className="flex flex-col items-start gap-1 self-stretch">
                    <div className="flex items-center gap-5 self-stretch">
                      <span className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                        Payment Amount:
                      </span>
                      <div className="flex flex-1 items-center gap-2.5">
                        <span className="text-dark-500 flex-1 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          - {formatCurrency(amountValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-px w-full bg-gray-200" />
                  <div className="flex items-center gap-5 self-stretch">
                    <span className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      Payment Amount:
                    </span>
                    <div className="flex flex-1 items-center gap-2.5">
                      <span className="text-dark-500 flex-1 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        {formatCurrency(Math.max(0, newDebt))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start justify-center gap-3 self-stretch">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                  New Status:
                </span>
                <div className="flex items-center gap-3 self-stretch">
                  <div className="flex items-center gap-1 rounded-[16px] bg-white px-3 py-1">
                    <div className="flex items-center justify-center gap-2.5">
                      <span
                        className={cn(
                          'inline-flex h-4 w-4 items-center justify-center rounded-full',
                          hasDebt ? 'bg-success-200' : 'bg-gray-200'
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            hasDebt ? 'bg-success-500' : 'bg-gray-500'
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          hasDebt ? 'text-success-500' : 'text-gray-500'
                        )}
                      >
                        {hasDebt ? 'Active' : 'Paid'}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {hasDebt && 'still has debt'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-4 self-stretch">
          <div className="flex items-start gap-4 self-stretch">
            <div className="flex flex-1 flex-col items-start gap-2">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Verification
              </span>
              <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 p-[20px_24px]">
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                    Payment Status:
                  </Label>
                  <RadioGroup
                    value={paymentStatus}
                    onValueChange={(value) =>
                      setPaymentStatus(value as 'Pending Verification' | 'Verified')
                    }
                    className="flex items-start gap-4 self-stretch"
                  >
                    <div className="flex flex-1 items-center gap-1">
                      <RadioItem value="Pending Verification" id="status-pending" />
                      <Label
                        htmlFor="status-pending"
                        className="text-dark-500 cursor-pointer text-sm font-light"
                      >
                        Pending Verification
                      </Label>
                    </div>
                    <div className="flex flex-1 flex-col items-start gap-2">
                      <div className="flex items-center gap-1">
                        <RadioItem value="Verified" id="status-verified" />
                        <Label
                          htmlFor="status-verified"
                          className="text-dark-500 cursor-pointer text-sm font-light"
                        >
                          Verified
                        </Label>
                      </div>
                      <span className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        Requires supervisor permission
                      </span>
                    </div>
                  </RadioGroup>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-col items-start gap-3 self-stretch">
                  <div className="flex items-center gap-1 self-stretch">
                    <Checkbox
                      checked={generateReceipt}
                      onCheckedChange={(checked) => setGenerateReceipt(checked === true)}
                      id="generate-receipt"
                    />
                    <Label
                      htmlFor="generate-receipt"
                      className="flex flex-1 cursor-pointer flex-col justify-center self-stretch text-sm font-light text-gray-950"
                    >
                      Generate receipt automatically
                    </Label>
                  </div>
                  <div className="flex items-center gap-1 self-stretch">
                    <Checkbox
                      checked={updateBalance}
                      onCheckedChange={(checked) => setUpdateBalance(checked === true)}
                      id="update-balance"
                    />
                    <Label
                      htmlFor="update-balance"
                      className="flex flex-1 cursor-pointer flex-col justify-center self-stretch text-sm font-light text-gray-950"
                    >
                      Update debt balance immediately
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col items-start gap-4 self-stretch border-none">
        <div className="flex items-start gap-6 self-stretch">
          <Button
            variant="secondary"
            leftIcon={<Icons.Clock04 size={18} />}
            onClick={() => handleSave('Pending Verification')}
            className="flex-1"
          >
            Save as Pending
          </Button>
          <Button
            variant="primary"
            leftIcon={<Icons.CheckmarkSquare03 size={18} />}
            onClick={() => handleSave('Verified')}
            className="flex-1"
          >
            Save & Verify
          </Button>
        </div>

        <Button variant="cancel" onClick={handleClose} className="flex self-stretch">
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  )
}
