/**
 * Reversal (Storno) Create Modal — KAN-334.
 *
 * Client-scoped modal launched from the "Reversal" button on the Client detail
 * page → Loans tab (right of "Write-off"). UI per ``Screenshot_14.png``:
 *
 *   - "Choose a payment" dropdown (verified, not-yet-reversed payments; label
 *     "DD.MM.YYYY — amount").
 *   - Five amount inputs — the NEW allocation per charge type
 *     (principal / interest / fine / penalty / commission).
 *   - Optional comment / reason.
 *   - Read-only "Total amount of reversal" footer, compared live against the
 *     selected payment amount.
 *   - Close + Save. Save is blocked until Σ(new amounts) equals the payment
 *     amount (the backend enforces the same rule authoritatively).
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { useCreateReversal } from '@/features/reversals/hooks/useReversals'
import {
  REVERSAL_CHARGE_TYPES,
  type ReversalChargeType,
  type ReversalFieldError,
} from '@/features/reversals/api/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal payment shape the modal needs for the picker + total check. */
export interface ReversalEligiblePayment {
  id: number
  /** Numeric amount (already coerced from the Decimal string). */
  amount: number
  /** Pre-formatted payment date for the dropdown label. */
  paymentDate: string
  /** True when this payment has already been reversed (disabled in the list). */
  isReversed: boolean
}

export interface ReversalCreateModalProps {
  open: boolean
  onClose: () => void
  /** Eligible (verified, credit-backed) payments for this client. */
  payments: ReversalEligiblePayment[]
  /** Optional preselect. */
  initialPaymentId?: number | null
}

type AmountMap = Record<ReversalChargeType, string>

const EMPTY_AMOUNTS: AmountMap = {
  principal: '',
  interest: '',
  fine: '',
  penalty: '',
  commission: '',
}

const CENT = 0.005

// Map backend error codes → i18n keys (top-level band).
const ERROR_CODE_I18N: Record<string, string> = {
  AMOUNTS_SUM_MISMATCH: 'pages.clients.detail.reversalModal.errors.amountsSumMismatch',
  ALREADY_REVERSED: 'pages.clients.detail.reversalModal.errors.alreadyReversed',
  PAYMENT_NOT_VERIFIED: 'pages.clients.detail.reversalModal.errors.paymentNotVerified',
  PAYMENT_NOT_FOUND: 'pages.clients.detail.reversalModal.errors.paymentNotFound',
  PAYMENT_HAS_NO_CREDIT: 'pages.clients.detail.reversalModal.errors.paymentHasNoCredit',
  REVERSAL_NOT_SNAPSHOTTED: 'pages.clients.detail.reversalModal.errors.notSnapshotted',
}

function parseAmount(raw: string): number {
  if (!raw.trim()) return 0
  const n = Number(raw.replace(',', '.').trim())
  return Number.isFinite(n) ? n : 0
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReversalCreateModal({
  open,
  onClose,
  payments,
  initialPaymentId = null,
}: ReversalCreateModalProps) {
  const { t } = useTranslation('common')

  const selectablePayments = useMemo(() => payments.filter((p) => !p.isReversed), [payments])

  const [selectedId, setSelectedId] = useState<number | null>(
    initialPaymentId ?? selectablePayments[0]?.id ?? null
  )
  const [amounts, setAmounts] = useState<AmountMap>({ ...EMPTY_AMOUNTS })
  const [comment, setComment] = useState('')
  const [topLevelError, setTopLevelError] = useState<string | null>(null)

  const reset = () => {
    setAmounts({ ...EMPTY_AMOUNTS })
    setComment('')
    setTopLevelError(null)
  }

  // Seed / clear on open-close. Allowed set-state-in-effect: derives purely
  // from open + inputs, no external system to subscribe to.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    const preferred =
      (initialPaymentId && selectablePayments.some((p) => p.id === initialPaymentId)
        ? initialPaymentId
        : null) ??
      selectablePayments[0]?.id ??
      null
    setSelectedId(preferred)
  }, [open, initialPaymentId, selectablePayments])
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedPayment = useMemo(
    () => payments.find((p) => p.id === selectedId) ?? null,
    [payments, selectedId]
  )

  const totalEntered = useMemo(
    () => REVERSAL_CHARGE_TYPES.reduce((sum, ct) => sum + parseAmount(amounts[ct]), 0),
    [amounts]
  )

  const expected = selectedPayment?.amount ?? 0
  const matches = !!selectedPayment && Math.abs(totalEntered - expected) < CENT

  const updateAmount = (ct: ReversalChargeType, value: string) => {
    setAmounts((a) => ({ ...a, [ct]: value }))
    setTopLevelError(null)
  }

  const handleValidationErrors = (errors: ReversalFieldError[]) => {
    const messages = errors.map((e) => {
      const key = ERROR_CODE_I18N[e.code]
      return key ? t(key, e as Record<string, unknown>) : (e.message ?? e.code)
    })
    if (messages.length) setTopLevelError(messages.join(' • '))
  }

  const { mutate, isPending } = useCreateReversal({
    onValidationErrors: handleValidationErrors,
  })

  const handleSave = () => {
    if (!selectedPayment) return
    if (!matches) {
      setTopLevelError(
        t('pages.clients.detail.reversalModal.errors.amountsSumMismatch', {
          requested: formatMoneyUAHTwoDecimals(totalEntered),
          expected: formatMoneyUAHTwoDecimals(expected),
        })
      )
      return
    }
    mutate(
      {
        payment_id: selectedPayment.id,
        principal: String(parseAmount(amounts.principal)),
        interest: String(parseAmount(amounts.interest)),
        fine: String(parseAmount(amounts.fine)),
        penalty: String(parseAmount(amounts.penalty)),
        commission: String(parseAmount(amounts.commission)),
        comment: comment.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.detail.reversalModal.saveSuccess'))
          onClose()
        },
      }
    )
  }

  const canSubmit = !!selectedPayment && matches && !isPending

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
            <Icons.Reload size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.detail.reversalModal.title')}
      />
      <ModalContent>
        <div className="flex flex-col gap-6">
          {/* Payment picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {t('pages.clients.detail.reversalModal.chooseAPayment')}
            </label>
            <Select
              value={selectedId ? String(selectedId) : undefined}
              onValueChange={(v) => {
                setSelectedId(Number(v))
                setTopLevelError(null)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('pages.clients.detail.reversalModal.chooseAPaymentPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {payments.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} disabled={p.isReversed}>
                    {p.paymentDate} — {formatMoneyUAHTwoDecimals(p.amount)}
                    {p.isReversed && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({t('pages.clients.detail.reversalModal.reversedTag')})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectablePayments.length === 0 && (
              <p className="text-error-500 text-sm">
                {t('pages.clients.detail.reversalModal.noEligiblePayments')}
              </p>
            )}
          </div>

          {/* Per-charge-type amount inputs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {REVERSAL_CHARGE_TYPES.map((ct) => (
              <Input
                key={ct}
                label={t(`pages.clients.detail.reversalModal.components.${ct}`)}
                placeholder={t('pages.clients.detail.reversalModal.amountPlaceholder')}
                type="text"
                inputMode="decimal"
                value={amounts[ct]}
                disabled={!selectedPayment}
                onChange={(e) => updateAmount(ct, e.target.value)}
              />
            ))}
          </div>

          {/* Comment / reason */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {t('pages.clients.detail.reversalModal.comment')}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={t('pages.clients.detail.reversalModal.commentPlaceholder')}
            />
          </div>

          {topLevelError && <p className="text-error-500 text-sm">{topLevelError}</p>}

          {/* Total amount of reversal */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="text-sm font-medium text-gray-700">
              {t('pages.clients.detail.reversalModal.totalAmount')}
            </span>
            <span
              className={
                selectedPayment && !matches
                  ? 'text-error-500 text-base font-semibold'
                  : 'text-dark-500 text-base font-semibold'
              }
            >
              {formatMoneyUAHTwoDecimals(totalEntered)}
              {selectedPayment && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  / {formatMoneyUAHTwoDecimals(expected)}
                </span>
              )}
            </span>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} disabled={isPending}>
          {t('common.close')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSubmit} isLoading={isPending}>
          {t('common.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
