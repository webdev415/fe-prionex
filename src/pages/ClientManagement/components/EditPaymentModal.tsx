/**
 * Edit Payment Modal
 *
 * Modal for editing an existing payment.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { convertUTCToUserTimezone } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'

export interface EditPaymentModalProps {
  open: boolean
  onClose: () => void
  payment: {
    paymentId: string
    amount: number
    paymentDate: string
    method: 'Bank Transfer' | 'Card Payment' | 'Other' | 'Online Gateway' | 'Cash' | 'Card'
    reference?: string
    createdBy: string
    createdAt: string
    currentDebt: number
    referenceNumber?: string
    last4Digits?: string
    paymentMethodDetails?: string
  }
  onSave: (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
    referenceNumber?: string
    last4Digits?: string
    paymentMethodDetails?: string
  }) => void
}

export function EditPaymentModal({ open, onClose, payment, onSave }: EditPaymentModalProps) {
  const { t, i18n } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatCurrencySimple = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${amount.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`
  }
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

  // Normalize payment method from old format to new format
  const normalizeMethod = (
    method: 'Bank Transfer' | 'Card Payment' | 'Other' | 'Online Gateway' | 'Cash' | 'Card'
  ): 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other' => {
    if (method === 'Card Payment' || method === 'Card') return 'Card'
    if (method === 'Bank Transfer') return 'Bank Transfer'
    if (method === 'Online Gateway') return 'Online Gateway'
    if (method === 'Cash') return 'Cash'
    return 'Other'
  }

  const [paymentMethod, setPaymentMethod] = useState<
    'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
  >(normalizeMethod(payment.method))
  const [referenceNumber, setReferenceNumber] = useState<string>(
    payment.referenceNumber || payment.reference || ''
  )
  const [last4Digits, setLast4Digits] = useState<string>(payment.last4Digits || '')
  const [paymentMethodDetails, setPaymentMethodDetails] = useState<string>(
    payment.paymentMethodDetails || ''
  )
  const [referenceNumberError, setReferenceNumberError] = useState<string | null>(null)
  const [last4DigitsError, setLast4DigitsError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)

  const amountValue = parseFloat(paymentAmount) || 0
  const originalAmount = payment.amount
  const originalDebt = payment.currentDebt + originalAmount // Debt before original payment
  const newDebt = originalDebt - amountValue
  const debtChange = amountValue - originalAmount

  // Calculate date restrictions (same as RecordPaymentModal)
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
      if (!referenceNumber.trim()) {
        setReferenceNumberError(t('pages.clients.modals.recordPayment.referenceNumberRequired'))
      }
    }
    if (newMethod === 'Card') {
      if (!last4Digits) {
        setLast4DigitsError(t('pages.clients.modals.recordPayment.last4DigitsRequired'))
      } else if (last4Digits.length !== 4) {
        setLast4DigitsError(t('pages.clients.modals.recordPayment.last4DigitsMustBe4'))
      }
    }
  }

  const minAmount = 100
  const maxAmount = originalDebt

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
    if (numValue > maxAmount) {
      setAmountError(
        t('pages.clients.modals.recordPayment.validationPaymentExceedsDebt', {
          amount: formatCurrency(maxAmount),
        })
      )
      return
    }
  }

  // Check if there are validation errors
  const hasValidationErrors =
    !!amountError ||
    !!referenceNumberError ||
    !!last4DigitsError ||
    !paymentDate ||
    amountValue < minAmount ||
    amountValue > maxAmount ||
    (paymentMethod === 'Bank Transfer' && !referenceNumber.trim()) ||
    (paymentMethod === 'Card' && last4Digits.length !== 4)

  const handleSave = () => {
    // Validate before saving
    if (hasValidationErrors) {
      return
    }

    if (!paymentDate || amountValue <= 0) {
      return
    }

    onSave({
      amount: amountValue,
      date: paymentDate,
      method: paymentMethod,
      referenceNumber: paymentMethod === 'Bank Transfer' ? referenceNumber : undefined,
      last4Digits: paymentMethod === 'Card' ? last4Digits : undefined,
      paymentMethodDetails: paymentMethodDetails || undefined,
    })

    // Reset form
    setPaymentAmount(payment.amount.toString())
    setPaymentDate(originalDate)
    setPaymentMethod(normalizeMethod(payment.method))
    setReferenceNumber(payment.referenceNumber || payment.reference || '')
    setLast4Digits(payment.last4Digits || '')
    setPaymentMethodDetails(payment.paymentMethodDetails || '')
    setReferenceNumberError(null)
    setLast4DigitsError(null)
    setAmountError(null)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setPaymentAmount(payment.amount.toString())
    setPaymentDate(originalDate)
    setPaymentMethod(normalizeMethod(payment.method))
    setReferenceNumber(payment.referenceNumber || payment.reference || '')
    setLast4Digits(payment.last4Digits || '')
    setPaymentMethodDetails(payment.paymentMethodDetails || '')
    setReferenceNumberError(null)
    setLast4DigitsError(null)
    setAmountError(null)
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
        title={t('pages.clients.modals.editPayment.title', { paymentId: payment.paymentId })}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-200px)]">
        {/* Editing Payment Info */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.editPayment.editingPayment')}
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                <span className="text-dark-500 w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.canEdit')}
                </span>
                <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.created', {
                    days: daysSinceCreation,
                    daysText:
                      daysSinceCreation === 1
                        ? t('pages.clients.modals.editPayment.day')
                        : t('pages.clients.modals.editPayment.days'),
                  })}{' '}
                  <span className="font-light">
                    {t('pages.clients.modals.editPayment.within7DayLimit')}
                  </span>
                </span>
              </div>
              <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                <span className="text-dark-500 w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.requires')}
                </span>
                <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.supervisorApproval')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Original Payment Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.editPayment.originalPayment')}
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
            <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-1 flex-col items-start gap-1 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.editPayment.amount')}{' '}
                    <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.editPayment.date')}{' '}
                    <span className="font-medium">
                      {convertUTCToUserTimezone(payment.paymentDate, userTimezone)}
                    </span>
                  </span>
                </div>
              </div>

              <div className="hidden h-[46px] w-px bg-gray-200 sm:mx-2 sm:block"></div>
              <div className="h-px w-full bg-gray-200 sm:hidden"></div>

              <div className="flex flex-1 flex-col items-start gap-1 p-0">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.editPayment.method')}{' '}
                    <span className="font-medium">{payment.method}</span>
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.modals.editPayment.reference')}{' '}
                    <span className="font-medium">
                      {payment.referenceNumber || payment.reference || '-'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.clients.modals.editPayment.createdBy')}{' '}
                <span className="font-medium">
                  {payment.createdBy} {t('pages.clients.modals.editPayment.on')}{' '}
                  {convertUTCToUserTimezone(payment.createdAt, userTimezone)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Edit Payment Information Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.editPayment.editPaymentInformation')}
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
            <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-start sm:gap-5">
              {/* Payment Amount */}
              <div className="flex w-full flex-1 flex-col items-start justify-end gap-2 sm:w-auto">
                <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.clients.modals.recordPayment.paymentAmount')}
                </Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  inputSize="md"
                  className="w-full rounded-md sm:w-auto"
                  error={amountError || undefined}
                />
                {!amountError && (
                  <div className="flex items-center gap-2 self-stretch">
                    <Icons.Money01 size={18} className="text-gray-700 sm:size-5" />
                    <span className="text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-700 sm:text-sm">
                      ({t('pages.clients.modals.recordPayment.min')} {formatCurrency(100)},{' '}
                      {t('pages.clients.modals.recordPayment.max')} {formatCurrency(originalDebt)})
                    </span>
                  </div>
                )}
              </div>
              {/* Payment Date */}
              <div className="flex w-full flex-1 flex-col items-start justify-center gap-2 sm:w-auto">
                <label className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.paymentDateRequired')}{' '}
                  <span className="text-error-500">*</span>
                </label>
                <DateSelect
                  value={paymentDate}
                  onChange={({ value }) => setPaymentDate(value)}
                  format="yyyy-MM-dd"
                  className="max-h-[42px] w-full rounded-md sm:w-auto"
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
                className="mt-2 flex flex-col space-y-2 sm:block"
              >
                <div className="flex items-center gap-2">
                  <RadioItem value="Bank Transfer" id="method-bank" />
                  <Label
                    htmlFor="method-bank"
                    className="text-dark-500 cursor-pointer text-xs font-light sm:text-sm"
                  >
                    {t('pages.clients.modals.recordPayment.bankTransfer')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioItem value="Online Gateway" id="method-online" disabled />
                  <Label
                    htmlFor="method-online"
                    className="text-dark-500 cursor-not-allowed text-xs font-light opacity-50 sm:text-sm"
                  >
                    {t('pages.clients.modals.recordPayment.onlineGateway')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioItem value="Cash" id="method-cash" disabled />
                  <Label
                    htmlFor="method-cash"
                    className="text-dark-500 cursor-not-allowed text-xs font-light opacity-50 sm:text-sm"
                  >
                    {t('pages.clients.modals.recordPayment.cash')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioItem value="Card" id="method-card" />
                  <Label
                    htmlFor="method-card"
                    className="text-dark-500 cursor-pointer text-xs font-light sm:text-sm"
                  >
                    {t('pages.clients.modals.recordPayment.card')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioItem value="Other" id="method-other" />
                  <Label
                    htmlFor="method-other"
                    className="text-dark-500 cursor-pointer text-xs font-light sm:text-sm"
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

        {/* Impact Comparison Section */}
        <div className="flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.editPayment.impactComparison')}
          </span>
          <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
            <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-center sm:gap-5">
              {/* Before Column */}
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.modals.editPayment.before')}
                </span>
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.payment')}{' '}
                  <span className="font-medium">{formatCurrency(originalAmount)}</span>
                </span>
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.debt')}{' '}
                  <span className="font-medium">{formatCurrencySimple(originalDebt)}</span>
                </span>
              </div>

              {/* Arrow Icon */}
              <div className="hidden w-[26px] self-stretch sm:block">
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
              <div className="h-px w-full bg-gray-200 sm:hidden"></div>

              {/* After Column */}
              <div className="flex flex-1 flex-col items-start gap-2 p-0">
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.modals.editPayment.after')}
                </span>
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.payment')}{' '}
                  <span className="font-medium">{formatCurrency(amountValue)}</span>
                </span>
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.editPayment.debt')}{' '}
                  <span className="font-medium">{formatCurrencySimple(newDebt)}</span>
                </span>
              </div>
            </div>

            <div className="h-px w-full bg-gray-200" />

            {/* Change Summary */}
            <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
              {t('pages.clients.modals.editPayment.change')}{' '}
              <span className="font-medium">
                {formatCurrency(Math.abs(debtChange))}{' '}
                {debtChange > 0
                  ? t('pages.clients.modals.editPayment.less')
                  : t('pages.clients.modals.editPayment.more')}{' '}
                {t('pages.clients.modals.editPayment.debtLabel')}
              </span>
            </span>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col gap-3 self-stretch border-none">
        <div className="flex flex-col items-stretch gap-3 self-stretch sm:w-full sm:flex-row sm:items-center">
          <Button
            variant="cancel"
            onClick={handleClose}
            className="h-12 w-full self-stretch rounded-md p-0"
          >
            {t('pages.clients.modals.recordPayment.cancel')}
          </Button>
          <div className="flex w-full flex-col items-center gap-1">
            <Button
              variant="primary"
              leftIcon={<Icons.Success size={18} className="sm:size-5" />}
              onClick={handleSave}
              className="h-12 w-full self-stretch rounded-md sm:w-auto"
              disabled={hasValidationErrors}
            >
              {t('pages.clients.modals.editPayment.saveChanges')}
            </Button>
            <span className="text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-700 sm:text-sm">
              {t('pages.clients.modals.editPayment.requiresSupervisorApproval')}
            </span>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  )
}
