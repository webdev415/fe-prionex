/**
 * Shared payment-record flow used by both the Client Profile (Payments tab "+")
 * and the Debt Summary page ("Record Payment" button).
 *
 * Encapsulates:
 *   - the per-client record-payment mutation,
 *   - the chained "Save & verify" branch (when the operator picks "Verified"),
 *   - the canVerify permission lookup,
 *   - the date / payment-method conversions the modal expects.
 *
 * Callers pass an optional ``onSuccess`` to close their local modal once the
 * full flow finishes (record, plus the verify chain if applicable). Keeping
 * the flow in one place ensures both entry points behave identically and
 * eliminates the previous handler duplication.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useRecordPayment, useVerifyPayment } from '@/features/payments'
import type { PaymentType } from '@/features/payments/api/types'
import { frontendToBackendPaymentMethod } from '@/features/payments/utils'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'

export interface RecordPaymentInput {
  amount: number
  date: Date
  method: 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other' | 'EasyPay'
  status: 'Pending Verification' | 'Verified'
  generateReceipt: boolean
  updateBalance: boolean
  referenceNumber?: string
  last4Digits?: string
  paymentMethodDetails?: string
  debtId?: number
  paymentType: PaymentType
  restructuringAgreementId?: number
  /** Set only for EasyPay. Its presence is what makes the save
      generate a checkout link rather than record an ordinary payment. */
  easypayMethod?: 'card' | 'google_pay' | 'apple_pay'
  copyLinkAfterSave?: boolean
}

export interface UseRecordPaymentFlowOptions {
  clientId: number
  /** Called after the full flow finishes (record + optional verify). */
  onSuccess?: () => void
}

export interface UseRecordPaymentFlowResult {
  /** Wire this to the RecordPaymentModal's ``onSave`` prop. */
  handleRecordPayment: (data: RecordPaymentInput) => void
  /** Wire this to the RecordPaymentModal's ``canVerify`` prop. */
  canVerifyPayment: boolean
}

export function useRecordPaymentFlow(
  opts: UseRecordPaymentFlowOptions
): UseRecordPaymentFlowResult {
  const { clientId, onSuccess } = opts
  const { mutate: recordPaymentMutation } = useRecordPayment()
  const { mutate: verifyPaymentMutation } = useVerifyPayment()
  const { t } = useTranslation('common')
  const canVerifyPayment = useHasPermission(PERMISSIONS.CLIENTS.VERIFY_PAYMENT)

  const handleRecordPayment = useCallback(
    (data: RecordPaymentInput) => {
      if (!clientId) {
        toast.error('Client ID is required')
        return
      }
      // react-datepicker yields LOCAL time; format with local getters.
      const year = data.date.getFullYear()
      const month = data.date.getMonth() + 1
      const day = data.date.getDate()
      const paymentDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      // EasyPay is stored as an online_gateway payment carrying a tender
      // (BR1); it is not a payment method of its own on the wire. Keyed on the
      // method as well as the tender because frontendToBackendPaymentMethod
      // falls back to 'other' for anything it does not know -- an EasyPay save
      // that arrived without a tender would otherwise be filed as a manual
      // 'other' payment, with no link and nothing to say so.
      const isEasyPay = data.method === 'EasyPay' || data.easypayMethod != null
      const easypayMethod = isEasyPay ? (data.easypayMethod ?? 'card') : undefined
      const backendMethod = isEasyPay
        ? 'online_gateway'
        : frontendToBackendPaymentMethod(
            data.method as Exclude<RecordPaymentInput['method'], 'EasyPay'>
          )

      recordPaymentMutation(
        {
          client_id: clientId,
          debt_id: data.debtId,
          amount: data.amount,
          payment_date: paymentDate,
          payment_method: backendMethod,
          payment_method_details: data.paymentMethodDetails,
          payment_type: data.paymentType,
          restructuring_agreement_id: data.restructuringAgreementId,
          easypay_method: easypayMethod,
          bank_reference:
            data.referenceNumber ||
            (data.method === 'Card' ? `****${data.last4Digits}` : undefined),
          notes: undefined,
          internal_notes: undefined,
        },
        {
          onSuccess: (payment) => {
            // The link is on the save response, so there is nothing
            // more to fetch. The toast reports what actually happened rather
            // than assuming: browsers gate clipboard writes on user activation
            // and that grant expires, so a write after an awaited request can
            // be refused. Claiming success there would have the operator paste
            // whatever was on the clipboard before.
            if (data.copyLinkAfterSave && payment.easypay_link) {
              void navigator.clipboard.writeText(payment.easypay_link).then(
                () => toast.success(t('pages.clients.modals.recordPayment.linkCopied')),
                () => toast.warning(t('pages.clients.modals.recordPayment.linkCopyFailed'))
              )
            } else if (isEasyPay && !payment.easypay_link) {
              // Pending with no link: the gateway call did not return one.
              toast.error(t('pages.clients.modals.recordPayment.linkUnavailable'))
            }

            // "Save & verify": immediately verify after record succeeds.
            if (data.status === 'Verified') {
              const paymentNumber = payment.payment_number || payment.id?.toString()
              if (paymentNumber) {
                verifyPaymentMutation(
                  { paymentId: paymentNumber, request: {} },
                  {
                    onSuccess: () => onSuccess?.(),
                  }
                )
                return
              }
            }
            // "Save as pending" — queries are already invalidated by the record hook.
            onSuccess?.()
          },
        }
      )
    },
    [clientId, onSuccess, recordPaymentMutation, t, verifyPaymentMutation]
  )

  return { handleRecordPayment, canVerifyPayment }
}
