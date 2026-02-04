/**
 * Payment Receipt PDF Generator Utilities
 *
 * Converts payment data to PDF receipt format and generates PDFs
 */

import type { Payment } from '@/features/payments/api/types'
import type { PaymentReceiptData } from '@/lib/pdfReceiptGenerator'
import { generatePaymentReceiptPDF } from '@/lib/pdfReceiptGenerator'
import {
  backendToFrontendPaymentMethod,
  backendToFrontendPaymentStatus,
} from '@/features/payments/utils'

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
  // Format payment method for display
  const paymentMethod = backendToFrontendPaymentMethod(payment.payment_method)

  // Format status for display
  const status = backendToFrontendPaymentStatus(payment.status).toUpperCase()

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
    dateIssued: payment.receipt_generated_at || payment.recorded_at || new Date().toISOString(),
    clientName: clientData?.fullName || `Client #${payment.client_id}`,
    clientId: payment.client_id.toString(),
    phone: clientData?.phone || 'N/A',
    contract: clientData?.contract || 'N/A',
    paymentDate: payment.payment_date,
    paymentMethod,
    transactionRef,
    paymentAmount: payment.amount,
    daysPastDue: clientData?.daysPastDue,
    status,
    outstandingBalanceBefore: payment.debt_before,
    paymentApplied,
    remainingBalance: payment.debt_after,
    receivedBy: payment.recorded_by_username || `User #${payment.recorded_by_user_id}`,
    verifiedBy: payment.verified_by_username,
    verifiedOn: payment.verified_at,
    companyName: companyData?.name || 'PrivatBank Debt Collection',
    companyAddress: companyData?.address || 'Kyiv, Ukraine, 01001',
    companyPhone: companyData?.phone || '+380 44 123 4567',
    companyEmail: companyData?.email || 'collections@privatbank.ua',
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
