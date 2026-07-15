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
import { toast } from 'sonner'

import { useRecordPayment, useVerifyPayment } from '@/features/payments'
import type { PaymentType } from '@/features/payments/api/types'
import { frontendToBackendPaymentMethod } from '@/features/payments/utils'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'

export interface RecordPaymentInput {
  amount: number
  date: Date
  method: 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
  status: 'Pending Verification' | 'Verified'
  generateReceipt: boolean
  updateBalance: boolean
  referenceNumber?: string
  last4Digits?: string
  paymentMethodDetails?: string
  debtId?: number
  paymentType: PaymentType
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

      const backendMethod = frontendToBackendPaymentMethod(data.method)

      recordPaymentMutation(
        {
          client_id: clientId,
          debt_id: data.debtId,
          amount: data.amount,
          payment_date: paymentDate,
          payment_method: backendMethod,
          payment_method_details: data.paymentMethodDetails,
          payment_type: data.paymentType,
          bank_reference:
            data.referenceNumber ||
            (data.method === 'Card' ? `****${data.last4Digits}` : undefined),
          notes: undefined,
          internal_notes: undefined,
        },
        {
          onSuccess: (payment) => {
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
    [clientId, onSuccess, recordPaymentMutation, verifyPaymentMutation]
  )

  return { handleRecordPayment, canVerifyPayment }
}
