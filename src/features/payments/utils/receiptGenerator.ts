/**
 * Payment Receipt PDF Generator Utilities
 *
 * Converts payment data to PDF receipt format and generates PDFs
 */

import type { DebtDetail } from '@/features/clients/api/types'
import type { Payment } from '@/features/payments/api/types'
import type { PaymentReceiptData } from '@/lib/pdfReceiptGenerator'
import { generatePaymentReceiptPDF } from '@/lib/pdfReceiptGenerator'
import type { PaymentMethod, PaymentStatus } from '@/features/payments/api/types'

export function selectDebtForPayment(
  payment: Pick<Payment, 'debt_id' | 'debt_contract_number'>,
  debts: DebtDetail[] | undefined | null
): DebtDetail | undefined {
  if (!debts || debts.length === 0) {
    return undefined
  }

  const byId =
    payment.debt_id != null ? debts.find((debt) => debt.id === payment.debt_id) : undefined
  if (byId) {
    return byId
  }

  const byContract = payment.debt_contract_number
    ? debts.find((debt) => debt.contract_number === payment.debt_contract_number)
    : undefined
  if (byContract) {
    return byContract
  }

  return debts[0]
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  online_gateway: 'Online Gateway',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  verified: 'Verified',
  pending: 'Pending',
  cancelled: 'Cancelled',
}

/**
 * Convert Payment data to PaymentReceiptData format for PDF generation
 */
export function convertPaymentToReceiptData(
  payment: Payment,
  clientData?: {
    fullName?: string
    phone?: string
    contract?: string
    daysPastDue?: number
  },
  companyData?: {
    name?: string
    address?: string
    phone?: string
    email?: string
  },
  userTimezone?: string
): PaymentReceiptData {
  // Format payment method for display (receipts are always in English)
  const paymentMethod = paymentMethodLabels[payment.payment_method] || payment.payment_method

  // Format status for display
  const status = (paymentStatusLabels[payment.status] || payment.status).toUpperCase()

  // Calculate payment applied (total of all components)
  // Handle null/undefined values properly to avoid NaN
  // Make it negative to show it's being deducted
  const paymentApplied = -(
    (Number(payment.principal_paid) || 0) +
    (Number(payment.interest_paid) || 0) +
    (Number(payment.fees_paid) || 0) +
    (Number(payment.penalty_paid) || 0) +
    (Number(payment.fines_paid) || 0)
  )

  // Use receipt number if available, otherwise use payment number
  const receiptNumber = payment.receipt_number || payment.payment_number.replace('PAY-', 'RCP-')

  // Format transaction reference
  const transactionRef =
    payment.bank_reference ||
    payment.bank_transaction_id ||
    payment.payment_number ||
    `TRX${payment.id.toString().padStart(5, '0')}`

  return {
    receiptNumber,
    paymentId: payment.payment_number,
    // CHANGED — NEVER fall back to new Date() for dateIssued. Priority:
    //   receipt_generated_at -> payment_confirmation_date -> recorded_at -> verified_at -> payment_date
    // KAN-782: payment_date can be NULL on legacy rows; the timestamp fallbacks
    // above cover those (all legacy null-date rows carry recorded_at). Terminal
    // '—' guards the impossible all-null case and keeps the type a string.
    dateIssued:
      payment.receipt_generated_at ||
      payment.payment_confirmation_date ||
      payment.recorded_at ||
      payment.verified_at ||
      payment.payment_date ||
      '—',
    clientName: clientData?.fullName || `Client #${payment.client_id}`,
    clientId: payment.client_id.toString(),
    phone: clientData?.phone || 'N/A',
    contract: clientData?.contract || 'N/A',
    // KAN-782: the labeled "Payment Date" shows "—" for legacy null-date rows
    // rather than substituting a different timestamp.
    paymentDate: payment.payment_date ?? '—',
    paymentMethod,
    transactionRef,
    paymentAmount: Number(payment.amount) || 0,
    daysPastDue: clientData?.daysPastDue,
    status,
    outstandingBalanceBefore: Number(payment.debt_before) || 0,
    paymentApplied,
    remainingBalance: Number(payment.debt_after) || 0,
    // Receipts render the currently-assigned operator as "Last_name First_name"
    // (per User.full_name). For rows with no assignee (typically auto-imported
    // and never assigned), fall back to the verified-by user with an "(import)"
    // suffix.
    receivedBy:
      payment.assigned_user_full_name ??
      (payment.assigned_user_id !== null && payment.assigned_user_id !== undefined
        ? `User #${payment.assigned_user_id}`
        : payment.verified_by_full_name
          ? `${payment.verified_by_full_name} (import)`
          : payment.verified_by_user_id !== null && payment.verified_by_user_id !== undefined
            ? `User #${payment.verified_by_user_id} (import)`
            : '—'),
    verifiedBy: payment.verified_by_full_name ?? undefined,
    verifiedOn: payment.verified_at,
    companyName: companyData?.name || '-',
    companyAddress: companyData?.address || '-',
    companyPhone: companyData?.phone || '-',
    companyEmail: companyData?.email || '-',
    userTimezone,
  }
}

/**
 * Generate PDF receipt from payment data
 */
export function generateReceiptPDF(
  payment: Payment,
  clientData?: {
    fullName?: string
    phone?: string
    contract?: string
    daysPastDue?: number
  },
  companyData?: {
    name?: string
    address?: string
    phone?: string
    email?: string
  },
  userTimezone?: string
): void {
  const receiptData = convertPaymentToReceiptData(payment, clientData, companyData, userTimezone)
  generatePaymentReceiptPDF(receiptData)
}
