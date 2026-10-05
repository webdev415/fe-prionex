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
import {
  PAYMENT_TYPE_VALUES,
  type EasyPayMethod,
  type PaymentType,
} from '@/features/payments/api/types'
import { piiProps } from '@/lib/openreplay/pii'

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
// The EasyPay method picks which service the hosted page offers. Stored on
// payments.easypay_method; the payment method itself stays online_gateway.
const EASYPAY_METHODS: EasyPayMethod[] = ['card', 'google_pay', 'apple_pay']

// Regulatory (KYC) ceiling on a single online payment. The remaining-debt
// cap beside it applies on top of this one.
const EASYPAY_MAX_AMOUNT_UAH = 29999

const RR_STATUS_CONNECTED = 1
const RR_STATUS_VIOLATED = 2
const RR_STATUS_DRAFT = 6
// A Draft plan takes payments too (KAN-1120). Leaving it out meant the payment
// that activates the plan could not be earmarked for it: the operator picked
// another type, the RR auto-activated on the amount anyway, and the first
// installment it was meant to cover stayed unpaid because nothing linked the
// two. Activation itself is unchanged -- see rr_activation_service.
const RR_STATUSES_ELIGIBLE_FOR_RR_PAYMENT = new Set([
  RR_STATUS_CONNECTED,
  RR_STATUS_VIOLATED,
  RR_STATUS_DRAFT,
])
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
    method: 'Bank Transfer' | 'Online Gateway' | 'EasyPay'
    easypayMethod?: EasyPayMethod
    copyLinkAfterSave?: boolean
    status: 'Pending Verification' | 'Verified'
    generateReceipt: boolean
    updateBalance: boolean
    referenceNumber?: string
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
  const [paymentMethod, setPaymentMethod] = useState<
    'Bank Transfer' | 'Online Gateway' | 'EasyPay'
  >('Bank Transfer')
  // Decides which EasyPay service the hosted page offers. Card by default,
  // and meaningless unless EasyPay is the payment method.
  const [easypayMethod, setEasypayMethod] = useState<EasyPayMethod>('card')
  const [copyLinkAfterSave, setCopyLinkAfterSave] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<'Pending Verification' | 'Verified'>(
    'Pending Verification'
  )
  const [generateReceipt, setGenerateReceipt] = useState(true)
  const [updateBalance, setUpdateBalance] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)
  // Set when switching method rewrote the operator's figure, so the change is
  // visible rather than silent. Cleared the moment they type again.
  const [amountCappedNotice, setAmountCappedNotice] = useState<string | null>(null)
  const [paymentMethodDetails, setPaymentMethodDetails] = useState<string>('')

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
  // What the operator picked. The initial value only helps when the loans are
  // already there on the first render; the client card mounts this modal as
  // soon as the profile arrives, and the loans often land after it.
  const [pickedDebtId, setPickedDebtId] = useState<number | null>(
    () => selectableDebts[0]?.id ?? null
  )
  // The loan the payment is recorded against: the pick while it is still
  // selectable, otherwise the only selectable loan. With one loan there is no
  // picker to fix it by hand, and EasyPay cannot be saved without a loan.
  const selectedDebtId = selectableDebts.some((d) => d.id === pickedDebtId)
    ? pickedDebtId
    : selectableDebts.length === 1
      ? selectableDebts[0].id
      : null

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
  const debtCeiling = isClosedDebtCorrection ? Number.POSITIVE_INFINITY : currentDebt
  // EasyPay is capped by the KYC threshold as well as by what is owed, so the
  // hint and the Save guard both move when the method changes. Parameterised
  // by method because handlePaymentMethodChange runs before the re-render and
  // has to reason about the method being switched TO, not the stale one.
  const ceilingFor = (method: 'Bank Transfer' | 'Online Gateway' | 'EasyPay') =>
    method === 'EasyPay' ? Math.min(EASYPAY_MAX_AMOUNT_UAH, debtCeiling) : debtCeiling
  const maxAmount = ceilingFor(paymentMethod)
  const newDebt = currentDebt - amountValue
  const hasDebt = newDebt > 0

  // Calculate date restrictions
  const today = getTodayAtMidnight()
  today.setHours(23, 59, 59, 999) // End of today
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())

  // Handle payment method change - clear related fields
  const handlePaymentMethodChange = (value: string) => {
    const newMethod = value as 'Bank Transfer' | 'Online Gateway' | 'EasyPay'
    setPaymentMethod(newMethod)

    // Clip an amount that was valid a moment ago. Switching to EasyPay lowers
    // the ceiling to the KYC threshold without the operator touching the field,
    // so leaving the old value would fail validation for a limit that appeared
    // on its own. Typing over a limit you can already see is different -- that
    // stays an ordinary error with Save disabled.
    setAmountCappedNotice(null)

    let nextAmount = amountValue
    if (newMethod === 'EasyPay' && amountValue > EASYPAY_MAX_AMOUNT_UAH) {
      // Only the KYC ceiling justifies rewriting what the operator typed: it
      // appears on its own when the method changes. An over-debt amount is a
      // limit they could already see, and it already shows an error, so it
      // stays theirs to correct -- clipping it too would silently change a
      // figure and clear the warning explaining why it was wrong.
      //
      // debtCeiling, not maxAmount: this runs before the re-render, so
      // maxAmount is still derived from the method being switched away from.
      nextAmount = Math.min(EASYPAY_MAX_AMOUNT_UAH, debtCeiling)
      setPaymentAmount(String(nextAmount))
      setAmountCappedNotice(
        t('pages.clients.modals.recordPayment.amountCappedToEasypayLimit', {
          amount: formatMoneyUAHTwoDecimals(nextAmount),
        })
      )
    }

    // The ceiling moved with the method, in both directions. Switching away
    // from EasyPay raises it, so an error about the KYC cap no longer applies
    // -- left standing it kept both Save buttons disabled behind a limit that
    // was no longer in force, with re-editing the field the only way out.
    setAmountError(amountValidationError(nextAmount, newMethod))
  }

  // Check if there are validation errors
  const hasValidationErrors =
    !!amountError ||
    !!paymentTypeError ||
    !paymentDate ||
    amountValue < 0 ||
    amountValue < minAmount ||
    amountValue > maxAmount ||
    (selectableDebts.length > 1 && !selectedDebtId) ||
    paymentType === ''

  // Every question about an amount, answered in one place. Two definitions
  // disagreeing is what let a method switch clear "must be positive" while
  // hasValidationErrors stayed true: the message vanished and both Save
  // buttons sat disabled with nothing to explain them. handleAmountChange,
  // handleSave and handlePaymentMethodChange all come through here, so they
  // cannot drift apart again.
  const amountValidationError = (
    value: number,
    method: 'Bank Transfer' | 'Online Gateway' | 'EasyPay' = paymentMethod
  ): string | null => {
    if (value < 0) {
      return t('pages.clients.modals.recordPayment.validationPaymentMustBePositive')
    }
    if (!isClosedDebtCorrection && value > currentDebt) {
      return t('pages.clients.modals.recordPayment.validationPaymentExceedsDebt', {
        amount: formatMoneyUAHTwoDecimals(currentDebt),
      })
    }
    const ceiling = ceilingFor(method)
    if (value > ceiling) {
      return t('pages.clients.modals.recordPayment.validationPaymentExceedsEasypayLimit', {
        amount: formatMoneyUAHTwoDecimals(ceiling),
      })
    }
    return null
  }

  const handleAmountChange = (value: string) => {
    setAmountCappedNotice(null)
    setPaymentAmount(value)
    const numValue = parseFloat(value) || 0

    setAmountError(amountValidationError(numValue))
  }

  const handleSave = (status: 'Pending Verification' | 'Verified') => {
    const amountProblem = amountValidationError(amountValue)
    if (amountProblem) {
      setAmountError(amountProblem)
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
      easypayMethod: paymentMethod === 'EasyPay' ? easypayMethod : undefined,
      copyLinkAfterSave: paymentMethod === 'EasyPay' ? copyLinkAfterSave : undefined,
      paymentMethodDetails: paymentMethodDetails.trim() || undefined,
      debtId: selectedDebtId ?? undefined,
      paymentType,
      restructuringAgreementId: paymentType === 'payment_by_rr' ? eligibleRr?.id : undefined,
    })

    // Reset form
    setPaymentAmount('')
    setPaymentDate(getTodayAtMidnight())
    setPaymentMethod('Bank Transfer')
    setEasypayMethod('card')
    setCopyLinkAfterSave(true)
    setAmountCappedNotice(null)
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    setAmountError(null)
    setPaymentMethodDetails('')
    setPickedDebtId(selectableDebts[0]?.id ?? null)
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
    setEasypayMethod('card')
    setCopyLinkAfterSave(true)
    setAmountCappedNotice(null)
    setPaymentStatus('Pending Verification')
    setGenerateReceipt(true)
    setUpdateBalance(false)
    setAmountError(null)
    setPaymentMethodDetails('')
    setPickedDebtId(selectableDebts[0]?.id ?? null)
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
            <span
              className="text-foreground text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]"
              {...piiProps}
            >
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
                  {amountCappedNotice && !amountError && (
                    <div className="flex items-center gap-2 self-stretch">
                      <Icons.Warning size={20} className="text-warning-500 shrink-0" />
                      <span className="text-warning-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                        {amountCappedNotice}
                      </span>
                    </div>
                  )}
                  {!amountError && (
                    <div className="flex items-center gap-2 self-stretch">
                      <Icons.Money01 size={20} className="text-foreground" />
                      <span className="text-foreground text-sm leading-[150%] font-light tracking-[-0.28px]">
                        ({t('pages.clients.modals.recordPayment.min')}{' '}
                        {formatMoneyUAHTwoDecimals(minAmount)}
                        {Number.isFinite(maxAmount)
                          ? `, ${t('pages.clients.modals.recordPayment.max')} ${formatMoneyUAHTwoDecimals(maxAmount)}`
                          : ''}
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
                      onValueChange={(value) => setPickedDebtId(Number(value))}
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
                    <RadioItem value="EasyPay" id="method-easypay" />
                    <Label
                      htmlFor="method-easypay"
                      className="text-foreground cursor-pointer text-sm font-light"
                    >
                      {t('pages.clients.modals.recordPayment.easypay', 'EasyPay')}
                    </Label>
                  </div>
                </RadioGroup>

                {/* Only meaningful for EasyPay, so it is absent rather than
                    disabled for every other payment method. */}
                {paymentMethod === 'EasyPay' && (
                  <RadioGroup
                    value={easypayMethod}
                    onValueChange={(value) => setEasypayMethod(value as EasyPayMethod)}
                    className="mt-3 flex flex-wrap items-center gap-4 pl-6"
                  >
                    {EASYPAY_METHODS.map((method) => (
                      <div key={method} className="flex items-center gap-2">
                        <RadioItem value={method} id={`easypay-method-${method}`} />
                        <Label
                          htmlFor={`easypay-method-${method}`}
                          className="text-foreground cursor-pointer text-sm font-light"
                        >
                          {t(`pages.clients.modals.recordPayment.easypayMethods.${method}`)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
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

              {/* Saving an EasyPay payment also generates a live
                  checkout URL, which a payment-method radio does not convey.
                  Hidden entirely for every other method. */}
              {paymentMethod === 'EasyPay' && (
                <div className="flex flex-col items-start gap-3 self-stretch">
                  <div className="flex items-center gap-2 self-stretch">
                    <Icons.Link01 size={16} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.recordPayment.easypayLinkWillBeCreated')}
                    </span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 self-stretch">
                    <Checkbox
                      checked={copyLinkAfterSave}
                      onCheckedChange={(checked) => setCopyLinkAfterSave(checked === true)}
                    />
                    <span className="text-foreground text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.recordPayment.copyLinkAfterSaving')}
                    </span>
                  </label>
                </div>
              )}

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
              // Disabled, not hidden, for EasyPay: the button's absence means
              // "you lack the permission" and that must keep meaning only that.
              // Nothing is confirmed until the gateway callback arrives, so
              // there is nothing here for an operator to attest to.
              disabled={hasValidationErrors || paymentMethod === 'EasyPay'}
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
