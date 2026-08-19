/**
 * Record Payment Modal
 *
 * Modal for recording a new payment for a client.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import type { DebtDetail, RestructuringAgreementSummary } from '@/features/clients/api/types'
import { useClientRestructuringAgreements } from '@/features/clients/hooks/useClients'
import { PAYMENT_TYPE_VALUES, type PaymentType } from '@/features/payments/api/types'

/**
 * RR statuses a `payment_by_rr` payment may be recorded against.
 *
 * Violated belongs here as much as Connected (KAN-1013): the whole point of a
 * catch-up payment is to bring a violated plan back, and KAN-431 lists
 * Violated -> Connected as an allowed transition. Offering the type only on
 * Connected left a violated plan with no way back — it just aged into
 * Cancelled.
 *
 * Cancelled and the terminal Completed statuses stay out. Cancelled has its own
 * reconnect mechanism (KAN-1011) and the terminal ones are settled.
 */
const RR_STATUS_CONNECTED = 1
const RR_STATUS_VIOLATED = 2
const RR_STATUSES_ELIGIBLE_FOR_RR_PAYMENT = new Set([RR_STATUS_CONNECTED, RR_STATUS_VIOLATED])
function isRrEligibleForRrPayment(ra: RestructuringAgreementSummary): boolean {
  return ra.status_id != null && RR_STATUSES_ELIGIBLE_FOR_RR_PAYMENT.has(ra.status_id)
}

/** Credit dropdown: {Credit Number} • {Counterparty Name} • {Total Debt} */
function formatDebtSelectLabel(debt: DebtDetail, closedDebtBadge?: string): string {
  let label = [
    debt.contract_number,
    debt.seller_company?.trim() || '-',
    formatMoneyUAHTwoDecimals(debt.remaining_debt_amount),
  ].join(' • ')
  if (debt.status === 'closed' && closedDebtBadge) {
    label += ` • ${closedDebtBadge}`
  }
  return label
}

/**
 * Get today's date at midnight local time.
 * Used for date-only fields to avoid timezone issues.
 */
const getTodayAtMidnight = (): Date => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export interface RecordPaymentModalProps {
  open: boolean
  onClose: () => void
  customerName: string
  currentDebt: number
  debts?: DebtDetail[]
  /** Whether user has verify_payment permission. When false, hides Verified radio and Save & Verify button. */
  canVerify?: boolean
  /**
   * Client id — needed to fetch the client's Restructuring Agreement list so
   * the new Payment Type field can auto-pre-fill `payment_by_rr` when the
   * picked debt has an open RR (KAN-507). Optional for back-compat with any
   * existing call sites that don't have a clientId on hand; when omitted,
   * the auto-prefill simply doesn't fire and the operator picks manually.
   */
  clientId?: number
  onSave: (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Online Gateway' | 'Card'
    status: 'Pending Verification' | 'Verified'
    generateReceipt: boolean
    updateBalance: boolean
    referenceNumber?: string
    last4Digits?: string
    paymentMethodDetails?: string
    debtId?: number
    /** KAN-507: required at the form layer; always set when onSave fires. */
    paymentType: PaymentType
    /** The connected RR's id — required by the backend when paymentType is
     * ``payment_by_rr``; undefined for all other payment types. */
    restructuringAgreementId?: number
  }) => void
}

export function RecordPaymentModal({
  open,
  onClose,
  customerName,
  currentDebt,
  debts,
  canVerify = true,
  clientId,
  onSave,
}: RecordPaymentModalProps) {
  const { t } = useTranslation('common')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentDate, setPaymentDate] = useState<Date | null>(getTodayAtMidnight)
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Online Gateway' | 'Card'>(
    'Bank Transfer'
  )
  const [paymentStatus, setPaymentStatus] = useState<'Pending Verification' | 'Verified'>(
    'Pending Verification'
  )
  const [generateReceipt, setGenerateReceipt] = useState(true)
  const [updateBalance, setUpdateBalance] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [last4Digits, setLast4Digits] = useState<string>('')
  const [paymentMethodDetails, setPaymentMethodDetails] = useState<string>('')
  const [last4DigitsError, setLast4DigitsError] = useState<string | null>(null)

  // KAN-507: Payment Type controlled-vocabulary dropdown. Required at the
  // form layer; backend keeps it Optional on the wire for back-compat.
  const [paymentType, setPaymentType] = useState<PaymentType | ''>('')
  // Tracks whether the operator has touched the dropdown for this modal
  // session. Auto-prefill only writes when the field is still untouched —
  // switching debts must never silently overwrite an explicit choice.
  const [paymentTypeDirty, setPaymentTypeDirty] = useState(false)
  const [paymentTypeError, setPaymentTypeError] = useState<string | null>(null)

  // Pull the client's RR list to power the auto-prefill effect below. The
  // hook is a no-op when clientId is missing.
  const { data: restructuringAgreements } = useClientRestructuringAgreements(
    clientId ?? 0,
    Boolean(clientId)
  )

  // Debts a user can pick in this modal. Closed debts are normally hidden,
  // but users with verify_payment permission (canVerify) may select them
  // to record a technical correction / migration payment. The backend
  // mirrors this rule.
  const selectableDebts = useMemo(
    () =>
      (debts || [])
        .filter((debt) => {
          if (!debt.status || debt.status === 'active') return true
          if (canVerify && debt.status === 'closed') return true
          return false
        })
        .sort((a, b) => a.id - b.id),
    [debts, canVerify]
  )
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(
    () => selectableDebts[0]?.id ?? null
  )

  const selectedDebt = useMemo(
    () => selectableDebts.find((d) => d.id === selectedDebtId) ?? null,
    [selectableDebts, selectedDebtId]
  )
  // A closed-debt selection is a technical correction. It bypasses the
  // amount-vs-current-debt cap on both client and server — closed debts
  // by definition report zero remaining balance, otherwise the feature
  // is useless.
  const isClosedDebtCorrection = selectedDebt?.status === 'closed'
  const eligibleRr = useMemo(() => {
    if (selectedDebtId == null) return null
    const candidates = (restructuringAgreements ?? []).filter(
      (ra) => ra.debt_id === selectedDebtId && isRrEligibleForRrPayment(ra)
    )
    // A debt should carry one live plan, but the schema permits more. If it
    // ever does, the Connected one is the live plan and takes the payment —
    // matching client-service, which resolves the active RR the same way.
    return candidates.find((ra) => ra.status_id === RR_STATUS_CONNECTED) ?? candidates[0] ?? null
  }, [restructuringAgreements, selectedDebtId])
  const hasEligibleRrForDebt = eligibleRr != null

  // Dirty guard prevents this auto-prefill from clobbering an explicit
  // operator pick when the picked debt changes.
  useEffect(() => {
    if (paymentTypeDirty) return
    if (paymentType !== '') return
    if (!hasEligibleRrForDebt) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaymentType('payment_by_rr')
  }, [hasEligibleRrForDebt, paymentTypeDirty, paymentType])

  useEffect(() => {
    if (paymentType === 'payment_by_rr' && !hasEligibleRrForDebt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentType('')
      setPaymentTypeDirty(false)
      setPaymentTypeError(null)
    }
  }, [paymentType, hasEligibleRrForDebt])

  const availablePaymentTypes = useMemo<readonly PaymentType[]>(
    () =>
      hasEligibleRrForDebt
        ? PAYMENT_TYPE_VALUES
        : PAYMENT_TYPE_VALUES.filter((v) => v !== 'payment_by_rr'),
    [hasEligibleRrForDebt]
  )

  const amountValue = parseFloat(paymentAmount) || 0
  const minAmount = 0.01
  const maxAmount = isClosedDebtCorrection ? Number.POSITIVE_INFINITY : currentDebt
  const newDebt = currentDebt - amountValue
  const hasDebt = newDebt > 0

  // Calculate date restrictions
  const today = getTodayAtMidnight()
  today.setHours(23, 59, 59, 999) // End of today
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())

  // Handle payment method change - clear related fields
  const handlePaymentMethodChange = (value: string) => {
    const newMethod = value as 'Bank Transfer' | 'Online Gateway' | 'Card'
    setPaymentMethod(newMethod)

    // Clear card fields when switching away from Card
    if (newMethod !== 'Card') {
      setLast4Digits('')
      setLast4DigitsError(null)
    }

    // Re-validate if switching to Card
    if (newMethod === 'Card') {
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
    !!last4DigitsError ||
    !!paymentTypeError ||
    !paymentDate ||
    amountValue < 0 ||
    amountValue < minAmount ||
    amountValue > maxAmount ||
    (paymentMethod === 'Card' && last4Digits.length !== 4) ||
    (selectableDebts.length > 1 && !selectedDebtId) ||
    paymentType === ''

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

    // Validate: cannot exceed current debt (skipped for closed-debt corrections)
    if (!isClosedDebtCorrection && numValue > currentDebt) {
      setAmountError(
        t('pages.clients.modals.recordPayment.validationPaymentExceedsDebt', {
          amount: formatMoneyUAHTwoDecimals(currentDebt),
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

    if (!isClosedDebtCorrection && amountValue > currentDebt) {
      setAmountError(
        t('pages.clients.modals.recordPayment.validationPaymentExceedsDebt', {
          amount: formatMoneyUAHTwoDecimals(currentDebt),
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

    // KAN-507: Payment Type is required at the form layer.
    if (paymentType === '') {
      setPaymentTypeError(
        t('pages.clients.modals.recordPayment.paymentTypeRequired', 'Payment type is required')
      )
      return
    }

    onSave({
      amount: amountValue,
      date: paymentDate,
      method: paymentMethod,
      status,
      generateReceipt,
      updateBalance,
      last4Digits: paymentMethod === 'Card' ? last4Digits : undefined,
      paymentMethodDetails: paymentMethodDetails.trim() || undefined,
      debtId: selectedDebtId ?? undefined,
      paymentType,
      restructuringAgreementId: paymentType === 'payment_by_rr' ? eligibleRr?.id : undefined,
    })

    // Reset form
    setPaymentAmount('')
    setPaymentDate(getTodayAtMidnight())
    setPaymentMethod('Bank Transfer')
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    setAmountError(null)
    setLast4Digits('')
    setPaymentMethodDetails('')
    setLast4DigitsError(null)
    setSelectedDebtId(selectableDebts[0]?.id ?? null)
    setPaymentType('')
    setPaymentTypeDirty(false)
    setPaymentTypeError(null)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setPaymentAmount('')
    setPaymentDate(getTodayAtMidnight())
    setPaymentMethod('Bank Transfer')
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    setAmountError(null)
    setLast4Digits('')
    setPaymentMethodDetails('')
    setLast4DigitsError(null)
    setSelectedDebtId(selectableDebts[0]?.id ?? null)
    setPaymentType('')
    setPaymentTypeDirty(false)
    setPaymentTypeError(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="3xl">
      <ModalHeader
        icon={
          <div className="bg-primary flex items-center justify-center rounded-full p-2.5">
            <Icons.MoneyReceive01 size={20} className="text-primary-foreground" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.recordPayment.title')}
        className="pb-6"
      />

      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-250px)]">
        {/* Client Info Section */}
        <div className="mb-6 flex flex-col items-start gap-3 self-stretch sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <div className="bg-card flex items-center gap-2.5 rounded-full p-2">
              <Icons.User size={18} className="text-foreground sm:size-5" />
            </div>
            <span className="text-foreground text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
              {customerName}
            </span>
          </div>
          <span className="text-foreground text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
            {t('pages.clients.modals.recordPayment.currentDebt')}{' '}
            <span className="font-medium">{formatMoneyUAHTwoDecimals(currentDebt)}</span>
          </span>
        </div>

        {/* Two Column Layout */}
        <div className="mb-6 flex flex-col items-start gap-4 self-stretch lg:flex-row">
          {/* Left Column - Payment Information */}
          <div className="flex w-full flex-1 flex-col items-start gap-2 lg:w-auto">
            <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.recordPayment.paymentInformation')}
            </span>
            <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border p-5">
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
                      <Icons.Money01 size={20} className="text-foreground" />
                      <span className="text-foreground text-sm leading-[150%] font-light tracking-[-0.28px]">
                        ({t('pages.clients.modals.recordPayment.min')}{' '}
                        {formatMoneyUAHTwoDecimals(minAmount)}
                        {isClosedDebtCorrection
                          ? ''
                          : `, ${t('pages.clients.modals.recordPayment.max')} ${formatMoneyUAHTwoDecimals(maxAmount)}`}
                        )
                      </span>
                    </div>
                  )}
                </div>
                {selectableDebts.length > 1 && (
                  <div className="flex flex-col items-start gap-2 self-stretch">
                    <Label
                      required
                      className="text-sm leading-[150%] font-medium tracking-[-0.28px]"
                    >
                      {t('pages.clients.modals.recordPayment.contractNumber')}
                    </Label>
                    <Select
                      value={selectedDebtId ? String(selectedDebtId) : ''}
                      onValueChange={(value) => setSelectedDebtId(Number(value))}
                    >
                      <SelectTrigger className="w-full rounded-md">
                        <SelectValue
                          placeholder={t(
                            'pages.clients.modals.recordPayment.contractPlaceholder',
                            'Select contract'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableDebts.map((debt) => (
                          <SelectItem key={debt.id} value={String(debt.id)}>
                            {formatDebtSelectLabel(
                              debt,
                              t('pages.clients.modals.recordPayment.closedDebtBadge')
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isClosedDebtCorrection && (
                  <div className="bg-warning-100 flex items-start gap-2 self-stretch rounded-md border border-amber-300 p-3">
                    <Icons.Warning size={18} className="text-warning-600 mt-0.5 shrink-0" />
                    <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-amber-900">
                      {t('pages.clients.modals.recordPayment.closedDebtCorrectionHint')}
                    </span>
                  </div>
                )}
                {/* Payment Date */}
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.modals.recordPayment.paymentDate')}
                  </Label>
                  <DateSelect
                    value={paymentDate}
                    onChange={({ value }) => setPaymentDate(value)}
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
                      className="text-foreground cursor-pointer text-sm font-light"
                    >
                      {t('pages.clients.modals.recordPayment.bankTransfer')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Online Gateway" id="method-online" />
                    <Label
                      htmlFor="method-online"
                      className="text-foreground cursor-pointer text-sm font-light"
                    >
                      {t('pages.clients.modals.recordPayment.onlineGateway')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="Card" id="method-card" disabled />
                    <Label
                      htmlFor="method-card"
                      className="text-foreground cursor-not-allowed text-sm font-light opacity-50"
                    >
                      {t('pages.clients.modals.recordPayment.card')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Payment Type (KAN-507) — required dropdown with auto-prefill */}
              <div className="flex flex-col items-start gap-2 self-stretch">
                <Label required className="text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.clients.modals.recordPayment.paymentTypeLabel', 'Payment type')}
                </Label>
                <Select
                  value={paymentType === '' ? undefined : paymentType}
                  onValueChange={(v) => {
                    setPaymentType(v as PaymentType)
                    setPaymentTypeDirty(true)
                    setPaymentTypeError(null)
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      'h-[45px] w-full rounded-md',
                      paymentTypeError && 'border-error-500'
                    )}
                    aria-label={t(
                      'pages.clients.modals.recordPayment.paymentTypeLabel',
                      'Payment type'
                    )}
                  >
                    <SelectValue
                      placeholder={t(
                        'pages.clients.modals.recordPayment.paymentTypePlaceholder',
                        'Select payment type'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePaymentTypes.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`pages.training.filters.paymentTypes.${v}`, v)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {paymentTypeError && (
                  <span className="text-error-600 text-xs">{paymentTypeError}</span>
                )}
              </div>

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
            <h3 className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.recordPayment.impactPreview')}
            </h3>

            <div className="border-border bg-card/50 flex flex-1 flex-col items-start gap-6 self-stretch rounded-xl border p-4 sm:p-6">
              <div className="flex flex-col items-start gap-4 self-stretch">
                <div className="flex items-center gap-5 self-stretch">
                  <span className="text-foreground flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.recordPayment.currentTotalDebt')}
                  </span>
                  <div className="flex flex-1 items-start justify-end gap-2.5">
                    <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                      {formatMoneyUAHTwoDecimals(currentDebt)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <div className="flex flex-col items-start gap-1 self-stretch">
                    <div className="flex items-center gap-5 self-stretch">
                      <span className="text-foreground flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                        {t('pages.clients.modals.recordPayment.paymentAmountLabel')}
                      </span>
                      <div className="flex flex-1 items-center gap-2.5">
                        <span className="text-foreground flex-1 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                          - {formatMoneyUAHTwoDecimals(amountValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted h-px w-full" />
                  <div className="flex items-center gap-5 self-stretch">
                    <span className="text-foreground flex-1 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.recordPayment.newTotalDebt')}
                    </span>
                    <div className="flex flex-1 items-center gap-2.5">
                      <span className="text-foreground flex-1 text-right text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        {formatMoneyUAHTwoDecimals(Math.max(0, newDebt))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start justify-center gap-3 self-stretch">
                <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.clients.modals.recordPayment.newStatus')}
                </span>
                <div className="flex items-center gap-3 self-stretch">
                  <div className="bg-card flex items-center gap-1 rounded-[16px] px-3 py-1">
                    <div className="flex items-center justify-center gap-2.5">
                      <span
                        className={cn(
                          'inline-flex h-4 w-4 items-center justify-center rounded-full',
                          hasDebt ? 'bg-success-200' : 'bg-muted'
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            hasDebt ? 'bg-success-500' : 'bg-muted-foreground'
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          hasDebt ? 'text-success-500' : 'text-muted-foreground'
                        )}
                      >
                        {hasDebt
                          ? t('pages.clients.statuses.active')
                          : t('pages.clients.statuses.paid')}
                      </span>
                    </div>
                  </div>
                  <span className="text-foreground text-sm leading-[150%] font-light tracking-[-0.28px]">
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
              <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.recordPayment.verification')}
              </span>
              <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border p-4 sm:p-[20px_24px]">
                <div className="flex flex-col items-start gap-2 self-stretch">
                  <Label className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
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
                        className="text-foreground cursor-pointer text-sm font-light"
                      >
                        {t('pages.clients.modals.recordPayment.pendingVerification')}
                      </Label>
                    </div>
                    {canVerify && (
                      <div className="flex flex-1 flex-col items-start gap-2">
                        <div className="flex items-center gap-1">
                          <RadioItem value="Verified" id="status-verified" />
                          <Label
                            htmlFor="status-verified"
                            className="text-foreground cursor-pointer text-sm font-light"
                          >
                            {t('pages.clients.modals.recordPayment.verified')}
                          </Label>
                        </div>
                        <span className="text-foreground text-xs leading-[140%] font-light tracking-[-0.24px]">
                          {t('pages.clients.modals.recordPayment.requiresSupervisorPermission')}
                        </span>
                      </div>
                    )}
                  </RadioGroup>
                </div>

                {/* Checkboxes — only relevant when saving as Verified */}
                {paymentStatus === 'Verified' && (
                  <div className="flex flex-col items-start gap-3 self-stretch">
                    <div className="flex items-center gap-1 self-stretch">
                      <Checkbox
                        checked={generateReceipt}
                        onCheckedChange={(checked) => setGenerateReceipt(checked === true)}
                        id="generate-receipt"
                      />
                      <Label
                        htmlFor="generate-receipt"
                        className="text-foreground flex flex-1 cursor-pointer flex-col justify-center self-stretch text-sm font-light"
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
                        className="text-foreground flex flex-1 cursor-pointer flex-col justify-center self-stretch text-sm font-light"
                      >
                        {t('pages.clients.modals.recordPayment.updateDebtBalanceImmediately')}
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col items-start gap-4 self-stretch border-none">
        <div className="flex w-full flex-col items-stretch gap-3 gap-6 self-stretch sm:flex-row">
          <Button
            variant={canVerify ? 'secondary' : 'primary'}
            leftIcon={<Icons.Clock04 size={18} />}
            onClick={() => handleSave('Pending Verification')}
            className="h-12 w-full rounded-md sm:w-auto"
            disabled={hasValidationErrors}
          >
            {t('pages.clients.modals.recordPayment.saveAsPending')}
          </Button>
          {canVerify && (
            <Button
              variant="primary"
              leftIcon={<Icons.CheckmarkSquare03 size={18} />}
              onClick={() => handleSave('Verified')}
              className="h-12 w-full rounded-md sm:w-auto"
              disabled={hasValidationErrors}
            >
              {t('pages.clients.modals.recordPayment.saveAndVerify')}
            </Button>
          )}
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
