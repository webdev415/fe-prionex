/**
 * Record Payment Modal
 *
 * Modal for recording a new payment for a client.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
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
    method: 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
    status: 'Pending Verification' | 'Verified'
    generateReceipt: boolean
    updateBalance: boolean
    referenceNumber?: string
    last4Digits?: string
    paymentMethodDetails?: string
  }) => void
}

export function RecordPaymentModal({
  open,
  onClose,
  customerName,
  currentDebt,
  onSave,
}: RecordPaymentModalProps) {
  const { t, i18n } = useTranslation('common')

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  const [paymentAmount, setPaymentAmount] = useState<string>('10000.00')
  const [paymentDate, setPaymentDate] = useState<Date | null>(() => {
    // Set default date to today
    // CRITICAL: Create a Date at midnight LOCAL time using today's date components
    // Use Date.now() to get current timestamp, then extract local date components
    const now = new Date()

    // Get local date components (what user sees)
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()

    // Create Date at midnight LOCAL time (00:00:00 local time)
    // This ensures the date matches what the user expects (today's date)
    const today = new Date(year, month, day, 0, 0, 0, 0)

    console.log('📅 RecordPaymentModal: Initializing payment date:', {
      now: now.toString(),
      nowISO: now.toISOString(),
      localYear: year,
      localMonth: month,
      localDay: day,
      today: today.toString(),
      todayISO: today.toISOString(),
      todayLocalString: today.toLocaleDateString(),
    })

    return today
  })
  const [paymentMethod, setPaymentMethod] = useState<
    'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
  >('Bank Transfer')
  const [paymentStatus, setPaymentStatus] = useState<'Pending Verification' | 'Verified'>(
    'Pending Verification'
  )
  const [generateReceipt, setGenerateReceipt] = useState(true)
  const [updateBalance, setUpdateBalance] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [last4Digits, setLast4Digits] = useState<string>('')
  const [paymentMethodDetails, setPaymentMethodDetails] = useState<string>('')
  const [referenceNumberError, setReferenceNumberError] = useState<string | null>(null)
  const [last4DigitsError, setLast4DigitsError] = useState<string | null>(null)

  const amountValue = parseFloat(paymentAmount) || 0
  const minAmount = 100
  const maxAmount = currentDebt
  const newDebt = currentDebt - amountValue
  const hasDebt = newDebt > 0

  // Calculate date restrictions
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of today
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  oneYearAgo.setHours(0, 0, 0, 0) // Start of day one year ago

  // Validate reference number when Bank Transfer is selected
  const handleReferenceNumberChange = (value: string) => {
    setReferenceNumber(value)
    if (paymentMethod === 'Bank Transfer' && !value.trim()) {
      setReferenceNumberError(t('pages.clients.modals.recordPayment.referenceNumberRequired'))
    } else {
      setReferenceNumberError(null)
    }
  }

  // Validate last 4 digits when Card is selected
  const handleLast4DigitsChange = (value: string) => {
    // Only allow numeric characters
    const numericValue = value.replace(/\D/g, '')
    // Limit to 4 digits
    const limitedValue = numericValue.slice(0, 4)
    setLast4Digits(limitedValue)

    if (paymentMethod === 'Card') {
      if (!limitedValue) {
        setLast4DigitsError(t('pages.clients.modals.recordPayment.last4DigitsRequired'))
      } else if (limitedValue.length !== 4) {
        setLast4DigitsError(t('pages.clients.modals.recordPayment.last4DigitsMustBe4'))
      } else {
        setLast4DigitsError(null)
      }
    }
  }

  // Handle payment method change - clear related fields
  const handlePaymentMethodChange = (value: string) => {
    const newMethod = value as 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
    setPaymentMethod(newMethod)

    // Clear errors and fields when switching methods
    if (newMethod !== 'Bank Transfer') {
      setReferenceNumber('')
      setReferenceNumberError(null)
    }
    if (newMethod !== 'Card') {
      setLast4Digits('')
      setLast4DigitsError(null)
    }

    // Re-validate if switching to a method that requires validation
    if (newMethod === 'Bank Transfer') {
      // Validate reference number if it exists, or set error if empty
      if (!referenceNumber.trim()) {
        setReferenceNumberError(t('pages.clients.modals.recordPayment.referenceNumberRequired'))
      }
    }
    if (newMethod === 'Card') {
      // Validate last 4 digits if they exist, or set error if empty
      if (!last4Digits) {
        setLast4DigitsError(t('pages.clients.modals.recordPayment.last4DigitsRequired'))
      } else if (last4Digits.length !== 4) {
        setLast4DigitsError(t('pages.clients.modals.recordPayment.last4DigitsMustBe4'))
      }
    }
  }

  // Check if there are validation errors
  const hasValidationErrors =
    !!amountError ||
    !!referenceNumberError ||
    !!last4DigitsError ||
    !paymentDate ||
    amountValue < 0 ||
    amountValue < minAmount ||
    amountValue > maxAmount ||
    (paymentMethod === 'Bank Transfer' && !referenceNumber.trim()) ||
    (paymentMethod === 'Card' && last4Digits.length !== 4)

  // Validate payment amount on change
  const handleAmountChange = (value: string) => {
    setPaymentAmount(value)
    const numValue = parseFloat(value) || 0

    // Clear previous error
    setAmountError(null)

    // Validate: must be positive
    if (numValue < 0) {
      setAmountError(t('pages.clients.modals.recordPayment.validationPaymentMustBePositive'))
      return
    }

    // Validate: cannot exceed current debt
    if (numValue > currentDebt) {
      setAmountError(
        t('pages.clients.modals.recordPayment.validationPaymentExceedsDebt', {
          amount: formatCurrency(currentDebt),
        })
      )
      return
    }
  }

  const handleSave = (status: 'Pending Verification' | 'Verified') => {
    // Validate payment amount
    if (amountValue < 0) {
      setAmountError(t('pages.clients.modals.recordPayment.validationPaymentMustBePositive'))
      return
    }

    if (amountValue > currentDebt) {
      setAmountError(
        t('pages.clients.modals.recordPayment.validationPaymentExceedsDebt', {
          amount: formatCurrency(currentDebt),
        })
      )
      return
    }

    if (!paymentDate || amountValue < minAmount || amountValue > maxAmount) {
      // Show validation error if amount is below minimum
      if (amountValue < minAmount) {
        setAmountError(t('pages.clients.modals.recordPayment.validationPaymentMustBePositive'))
      }
      return
    }

    onSave({
      amount: amountValue,
      date: paymentDate,
      method: paymentMethod,
      status,
      generateReceipt,
      updateBalance,
      referenceNumber: paymentMethod === 'Bank Transfer' ? referenceNumber.trim() : undefined,
      last4Digits: paymentMethod === 'Card' ? last4Digits : undefined,
      paymentMethodDetails: paymentMethodDetails.trim() || undefined,
    })

    // Reset form
    setPaymentAmount('10000.00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setPaymentDate(today)
    setPaymentMethod('Bank Transfer')
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    setAmountError(null)
    setReferenceNumber('')
    setLast4Digits('')
    setPaymentMethodDetails('')
    setReferenceNumberError(null)
    setLast4DigitsError(null)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setPaymentAmount('10000.00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setPaymentDate(today)
    setPaymentMethod('Bank Transfer')
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    setAmountError(null)
    setReferenceNumber('')
    setLast4Digits('')
    setPaymentMethodDetails('')
    setReferenceNumberError(null)
    setLast4DigitsError(null)
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
        title={t('pages.clients.modals.recordPayment.title')}
        className="pb-6"
      />

      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-250px)]">
        {/* Client Info Section */}
        <div className="mb-6 flex flex-col items-start gap-3 self-stretch sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
              <Icons.User size={18} className="text-dark-500 sm:size-5" />
            </div>
            <span className="text-dark-500 text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
              {customerName}
            </span>
          </div>
          <span className="text-dark-500 text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
            {t('pages.clients.modals.recordPayment.currentDebt')}{' '}
            <span className="font-medium">{formatCurrency(currentDebt)}</span>
          </span>
        </div>

        {/* Two Column Layout */}
        <div className="mb-6 flex flex-col items-start gap-4 self-stretch lg:flex-row">
          {/* Left Column - Payment Information */}
          <div className="flex w-full flex-1 flex-col items-start gap-2 lg:w-auto">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.recordPayment.paymentInformation')}
            </span>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-5">
              <div className="flex flex-col items-start gap-5 self-stretch">
                {/* Payment Amount */}
                <div className="flex flex-col items-start justify-end gap-2 self-stretch">
                  <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.modals.recordPayment.paymentAmount')}
                  </Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    inputSize="md"
                    className="rounded-md"
                    error={amountError || undefined}
                  />
                  {!amountError && (
                    <div className="flex items-center gap-2 self-stretch">
                      <Icons.Money01 size={20} className="text-gray-700" />
                      <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                        ({t('pages.clients.modals.recordPayment.min')} {formatCurrency(minAmount)},{' '}
                        {t('pages.clients.modals.recordPayment.max')} {formatCurrency(maxAmount)})
                      </span>
                    </div>
                  )}
                </div>
                {/* Payment Date */}
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.modals.recordPayment.paymentDate')}
                  </Label>
                  <DateSelect
                    value={paymentDate}
                    onChange={({ value }) => {
                      // Date is already normalized in DateSelect component
                      // Just set it directly
                      setPaymentDate(value)
                    }}
                    placeholder={t('pages.clients.modals.recordPayment.selectDate')}
                    className="rounded-md"
                    min={oneYearAgo}
                    max={today}
                  />
                </div>
              </div>
              {/* Payment Method */}
              <div className="flex flex-col items-start gap-2 self-stretch">
                <Label className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.clients.modals.recordPayment.paymentMethod')}
                </Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={handlePaymentMethodChange}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioItem value="Bank Transfer" id="method-bank" />
                    <Label
                      htmlFor="method-bank"
                      className="text-dark-500 cursor-pointer text-sm font-light"
                    >
                      {t('pages.clients.modals.recordPayment.bankTransfer')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Online Gateway" id="method-online" disabled />
                    <Label
                      htmlFor="method-online"
                      className="text-dark-500 cursor-not-allowed text-sm font-light opacity-50"
                    >
                      {t('pages.clients.modals.recordPayment.onlineGateway')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Cash" id="method-cash" disabled />
                    <Label
                      htmlFor="method-cash"
                      className="text-dark-500 cursor-not-allowed text-sm font-light opacity-50"
                    >
                      {t('pages.clients.modals.recordPayment.cash')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Card" id="method-card" />
                    <Label
                      htmlFor="method-card"
                      className="text-dark-500 cursor-pointer text-sm font-light"
                    >
                      {t('pages.clients.modals.recordPayment.card')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Other" id="method-other" />
                    <Label
                      htmlFor="method-other"
                      className="text-dark-500 cursor-pointer text-sm font-light"
                    >
                      {t('pages.clients.modals.recordPayment.other')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Conditional Fields Based on Payment Method */}
              {paymentMethod === 'Bank Transfer' && (
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.modals.recordPayment.referenceNumber')}
                  </Label>
                  <Input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => handleReferenceNumberChange(e.target.value)}
                    placeholder={t('pages.clients.modals.recordPayment.referenceNumberPlaceholder')}
                    inputSize="md"
                    className="rounded-md"
                    error={referenceNumberError || undefined}
                  />
                </div>
              )}

              {paymentMethod === 'Card' && (
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.modals.recordPayment.last4Digits')}
                  </Label>
                  <Input
                    type="text"
                    value={last4Digits}
                    onChange={(e) => handleLast4DigitsChange(e.target.value)}
                    placeholder={t('pages.clients.modals.recordPayment.last4DigitsPlaceholder')}
                    inputSize="md"
                    className="rounded-md"
                    error={last4DigitsError || undefined}
                    maxLength={4}
                  />
                </div>
              )}

              {/* Payment Method Details - Shown for all payment methods */}
              <div className="flex flex-col items-start gap-2 self-stretch">
                <Label className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.clients.modals.recordPayment.paymentMethodDetails')}
                </Label>
                <Textarea
                  value={paymentMethodDetails}
                  onChange={(e) => setPaymentMethodDetails(e.target.value)}
                  placeholder={t(
                    'pages.clients.modals.recordPayment.paymentMethodDetailsPlaceholder'
                  )}
                  className="rounded-md"
                  textareaSize="md"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Impact Preview */}
          <div className="flex w-full flex-1 flex-col items-start gap-2 self-stretch lg:w-auto">
            <h3 className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.recordPayment.impactPreview')}
            </h3>

            <div className="flex flex-1 flex-col items-start gap-6 self-stretch rounded-xl border border-white/100 bg-white/50 p-4 sm:p-6">
              <div className="flex flex-col items-start gap-4 self-stretch">
                <div className="flex items-center gap-5 self-stretch">
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.recordPayment.currentTotalDebt')}
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
                        {t('pages.clients.modals.recordPayment.paymentAmountLabel')}
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
                      {t('pages.clients.modals.recordPayment.newTotalDebt')}
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
                  {t('pages.clients.modals.recordPayment.newStatus')}
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
                        {hasDebt
                          ? t('pages.clients.statuses.active')
                          : t('pages.clients.statuses.paid')}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {hasDebt && t('pages.clients.modals.recordPayment.stillHasDebt')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-4 self-stretch">
          <div className="flex flex-row items-start gap-4 self-stretch">
            <div className="flex flex-1 flex-col items-start gap-2">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.recordPayment.verification')}
              </span>
              <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-[20px_24px]">
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                    {t('pages.clients.modals.recordPayment.paymentStatus')}
                  </Label>
                  <RadioGroup
                    value={paymentStatus}
                    onValueChange={(value) =>
                      setPaymentStatus(value as 'Pending Verification' | 'Verified')
                    }
                    className="flex flex-col items-start gap-3 self-stretch sm:flex-row sm:gap-4"
                  >
                    <div className="flex flex-1 items-center gap-1">
                      <RadioItem value="Pending Verification" id="status-pending" />
                      <Label
                        htmlFor="status-pending"
                        className="text-dark-500 cursor-pointer text-sm font-light"
                      >
                        {t('pages.clients.modals.recordPayment.pendingVerification')}
                      </Label>
                    </div>
                    <div className="flex flex-1 flex-col items-start gap-2">
                      <div className="flex items-center gap-1">
                        <RadioItem value="Verified" id="status-verified" />
                        <Label
                          htmlFor="status-verified"
                          className="text-dark-500 cursor-pointer text-sm font-light"
                        >
                          {t('pages.clients.modals.recordPayment.verified')}
                        </Label>
                      </div>
                      <span className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.modals.recordPayment.requiresSupervisorPermission')}
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
                      {t('pages.clients.modals.recordPayment.generateReceiptAutomatically')}
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
                      {t('pages.clients.modals.recordPayment.updateDebtBalanceImmediately')}
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col items-start gap-4 self-stretch border-none">
        <div className="flex w-full flex-col items-stretch gap-3 gap-6 self-stretch sm:flex-row">
          <Button
            variant="secondary"
            leftIcon={<Icons.Clock04 size={18} />}
            onClick={() => handleSave('Pending Verification')}
            className="h-12 w-full rounded-md sm:w-auto"
            disabled={hasValidationErrors}
          >
            {t('pages.clients.modals.recordPayment.saveAsPending')}
          </Button>
          <Button
            variant="primary"
            leftIcon={<Icons.CheckmarkSquare03 size={18} />}
            onClick={() => handleSave('Verified')}
            className="h-12 w-full rounded-md sm:w-auto"
            disabled={hasValidationErrors}
          >
            {t('pages.clients.modals.recordPayment.saveAndVerify')}
          </Button>
        </div>

        <Button
          variant="cancel"
          onClick={handleClose}
          className="flex h-12 w-full self-stretch rounded-md"
        >
          {t('pages.clients.modals.recordPayment.cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
