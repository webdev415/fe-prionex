/**
 * Payment Mutation Hooks
 * React Query hooks for mutating payment data
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import {
  recordPayment,
  verifyPayment,
  cancelPayment,
  editPayment,
  reassignPaymentEmployee,
  getPayment,
  exportPaymentsCSV,
} from '../api/paymentApi'
import type {
  RecordPaymentRequest,
  VerifyPaymentRequest,
  CancelPaymentRequest,
  EditPaymentRequest,
  ReassignPaymentEmployeeRequest,
  Payment,
  PaymentListParams,
} from '../api/types'
import { generateReceiptPDF } from '../utils/receiptGenerator'
import { getClientById } from '@/features/clients/api/clientApi'
import { clientKeys } from '@/features/clients/hooks/useClients'
import { getSeller } from '@/features/sellers/api/sellersApi'

/**
 * Safely extract a human-readable string from any API error.
 * Handles FastAPI 422 Pydantic arrays, plain strings, and fallback.
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object' || !('response' in error)) return fallback
  const data = (error as { response?: { data?: unknown } }).response?.data
  if (!data || typeof data !== 'object') return fallback
  const d = data as Record<string, unknown>
  // Plain string detail
  if (typeof d.detail === 'string') return d.detail
  // Pydantic 422: detail is an array of {msg, loc, ...}
  if (Array.isArray(d.detail)) {
    return (
      d.detail
        .map((e) => (e && typeof e === 'object' && 'msg' in e ? String(e.msg) : ''))
        .filter(Boolean)
        .join('; ') || fallback
    )
  }
  if (typeof d.message === 'string') return d.message
  return fallback
}

/**
 * Record a new payment
 */
export function useRecordPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: RecordPaymentRequest) => recordPayment(request),
    onSuccess: (data) => {
      // Invalidate payment-related queries
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['client-payment-history'] })
      queryClient.invalidateQueries({ queryKey: ['client-all-verified-payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(data.client_id), exact: true })
      queryClient.invalidateQueries({ queryKey: clientKeys.loans(data.client_id), exact: true })
      queryClient.invalidateQueries({
        queryKey: clientKeys.paymentsSection(data.client_id),
        exact: true,
      })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })

      toast.success('Payment recorded successfully')
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, 'Failed to record payment'))
    },
  })
}

/**
 * Verify a payment
 */
export function useVerifyPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      paymentId,
      request,
    }: {
      paymentId: string | number
      request?: VerifyPaymentRequest
    }) => verifyPayment(paymentId, request),
    onSuccess: (data) => {
      // Invalidate payment-related queries
      queryClient.invalidateQueries({ queryKey: ['payment', data.payment_number] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['client-payment-history'] })
      queryClient.invalidateQueries({ queryKey: ['client-all-verified-payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(data.client_id), exact: true })
      queryClient.invalidateQueries({ queryKey: clientKeys.loans(data.client_id), exact: true })
      queryClient.invalidateQueries({
        queryKey: clientKeys.paymentsSection(data.client_id),
        exact: true,
      })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })

      toast.success('Payment verified successfully')
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, 'Failed to verify payment'))
    },
  })
}

/**
 * Cancel a payment
 */
export function useCancelPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      paymentId,
      request,
    }: {
      paymentId: string | number
      request: CancelPaymentRequest
    }) => cancelPayment(paymentId, request),
    onSuccess: (data) => {
      // Invalidate payment-related queries
      queryClient.invalidateQueries({ queryKey: ['payment', data.payment_number] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['client-payment-history'] })
      queryClient.invalidateQueries({ queryKey: ['client-all-verified-payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(data.client_id), exact: true })
      queryClient.invalidateQueries({ queryKey: clientKeys.loans(data.client_id), exact: true })
      queryClient.invalidateQueries({
        queryKey: clientKeys.paymentsSection(data.client_id),
        exact: true,
      })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })

      toast.success('Payment cancelled successfully')
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, 'Failed to cancel payment'))
    },
  })
}

/**
 * Edit a payment
 */
export function useEditPayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ paymentId, request }: { paymentId: number; request: EditPaymentRequest }) =>
      editPayment(paymentId, request),
    onSuccess: (data) => {
      // Invalidate payment-related queries
      queryClient.invalidateQueries({ queryKey: ['payment', data.payment_number] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['client-payment-history'] })
      queryClient.invalidateQueries({ queryKey: ['client-all-verified-payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(data.client_id), exact: true })
      queryClient.invalidateQueries({ queryKey: clientKeys.loans(data.client_id), exact: true })
      queryClient.invalidateQueries({
        queryKey: clientKeys.paymentsSection(data.client_id),
        exact: true,
      })
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() })

      toast.success('Payment updated successfully')
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, 'Failed to update payment'))
    },
  })
}

/**
 * Reassign the recorded-by employee on a verified payment.
 */
export function useReassignPaymentEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      paymentId,
      request,
    }: {
      paymentId: number
      request: ReassignPaymentEmployeeRequest
    }) => reassignPaymentEmployee(paymentId, request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment', data.payment_number] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['client-payment-history'] })
      queryClient.invalidateQueries({ queryKey: ['client-all-verified-payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })

      toast.success('Employee reassigned successfully')
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, 'Failed to reassign employee'))
    },
  })
}

/**
 * Generate payment receipt using frontend PDF generator
 */
export function useGenerateReceipt() {
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  return useMutation<
    { success: boolean } | Payment,
    unknown,
    {
      paymentId: string | number
      payment?: Payment
      clientData?: {
        fullName?: string
        phone?: string
        contract?: string
        daysPastDue?: number
      }
      clientId?: number
      format?: 'pdf' | 'json'
    }
  >({
    mutationFn: async ({
      paymentId,
      payment,
      clientData,
      clientId,
      format = 'pdf' as 'pdf' | 'json',
    }: {
      paymentId: string | number
      payment?: Payment // If payment data is already available, use it
      clientData?: {
        fullName?: string
        phone?: string
        contract?: string
        daysPastDue?: number
      }
      clientId?: number // If provided, fetch client data
      format?: 'pdf' | 'json'
    }) => {
      // If payment data is provided, use it; otherwise fetch from API
      let paymentData: Payment
      if (payment) {
        paymentData = payment
      } else {
        paymentData = await getPayment(paymentId)
      }

      // Always fetch client data to get seller_id and days_past_due from debts
      // (even if clientData is provided, we need seller_id from debt)
      let finalClientData = clientData
      let sellerId: number | undefined
      if (clientId || paymentData.client_id) {
        try {
          const client = await getClientById(clientId || paymentData.client_id)

          // Extract seller_id and days_past_due from debts
          if (client.debts && client.debts.length > 0) {
            const primaryDebt = client.debts[0]
            // Get seller_id from primary debt for fetching seller information
            sellerId = primaryDebt.seller_id

            // Get days past due from debt (if available) or calculate from debt_close_date
            let daysPastDue: number | undefined
            if (primaryDebt.days_past_due !== undefined && primaryDebt.days_past_due !== null) {
              daysPastDue = primaryDebt.days_past_due
            } else if (primaryDebt.debt_close_date) {
              // Fallback: Calculate from debt_close_date
              const dueDate = new Date(primaryDebt.debt_close_date)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              dueDate.setHours(0, 0, 0, 0)
              const diffTime = today.getTime() - dueDate.getTime()
              daysPastDue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
            }

            // Update finalClientData with fetched data (merge with provided clientData if any)
            const fullName = [client.first_name, client.middle_name, client.last_name]
              .filter(Boolean)
              .join(' ')

            // Get contract number from debt (preferred) or use provided one if it's not 'N/A'
            const contractFromDebt =
              client.debts && client.debts.length > 0 ? client.debts[0].contract_number : undefined
            const contractNumber =
              contractFromDebt ||
              (finalClientData?.contract && finalClientData.contract !== 'N/A'
                ? finalClientData.contract
                : undefined) ||
              'N/A'

            finalClientData = {
              fullName: finalClientData?.fullName || fullName || `Client #${client.id}`,
              phone: finalClientData?.phone || client.phone_primary || 'N/A',
              contract: contractNumber,
              daysPastDue: finalClientData?.daysPastDue ?? daysPastDue,
            }
          } else if (!finalClientData) {
            // If no debts but no clientData provided, still create basic clientData
            const fullName = [client.first_name, client.middle_name, client.last_name]
              .filter(Boolean)
              .join(' ')

            finalClientData = {
              fullName: fullName || `Client #${client.id}`,
              phone: client.phone_primary || 'N/A',
              contract: 'N/A',
              daysPastDue: undefined,
            }
          }
        } catch {
          // Continue with provided clientData or payment data only
        }
      }

      // Fetch seller data for company information (preferred over project)
      let companyData:
        | {
            name?: string
            address?: string
            phone?: string
            email?: string
          }
        | undefined
      if (sellerId) {
        try {
          const seller = await getSeller(sellerId)
          // Use seller information for company details
          // Map backend fields (primary_contact_phone, primary_contact_email, legal_address)
          // to frontend fields (contact_phone, contact_email, address)
          companyData = {
            name: seller.seller_name || '-',
            address: seller.legal_address || seller.address || '-',
            phone: seller.primary_contact_phone || seller.contact_phone || '-',
            email: seller.primary_contact_email || seller.contact_email || '-',
          }
        } catch {
          // Fallback to project data if seller fetch fails
          if (paymentData.project_id) {
            try {
              const { getProject } = await import('@/features/projects/api/projectsApi')
              const project = await getProject(paymentData.project_id)
              companyData = {
                name: project.client_company || project.name || '-',
                address:
                  ((project.settings as Record<string, unknown>)?.address as string | undefined) ||
                  '-',
                phone:
                  ((project.settings as Record<string, unknown>)?.phone as string | undefined) ||
                  '-',
                email:
                  ((project.settings as Record<string, unknown>)?.email as string | undefined) ||
                  '-',
              }
            } catch {
              // Ignore and leave companyData undefined
            }
          }
        }
      } else if (paymentData.project_id) {
        // Fallback to project if no seller_id available
        try {
          const { getProject } = await import('@/features/projects/api/projectsApi')
          const project = await getProject(paymentData.project_id)
          companyData = {
            name: project.client_company || project.name || '-',
            address:
              ((project.settings as Record<string, unknown>)?.address as string | undefined) || '-',
            phone:
              ((project.settings as Record<string, unknown>)?.phone as string | undefined) || '-',
            email:
              ((project.settings as Record<string, unknown>)?.email as string | undefined) || '-',
          }
        } catch {
          // Ignore and leave companyData undefined
        }
      }

      // For PDF format, generate using frontend generator
      if (format === 'pdf') {
        generateReceiptPDF(paymentData, finalClientData, companyData, userTimezone)
        return { success: true }
      }

      // For JSON format, return payment data (for backward compatibility)
      return paymentData
    },
    onSuccess: (_data, variables) => {
      if (variables.format === 'pdf') {
        toast.success('Receipt downloaded successfully')
      } else {
        toast.success('Receipt generated successfully')
      }
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, 'Failed to generate receipt'))
    },
  })
}

/**
 * Export payments to CSV
 */
export function useExportPaymentsCSV() {
  return useMutation({
    mutationFn: (params: PaymentListParams = {}) => exportPaymentsCSV(params),
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Payments exported successfully')
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, 'Failed to export payments'))
    },
  })
}
