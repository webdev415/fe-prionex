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
  getPayment,
  exportPaymentsCSV,
} from '../api/paymentApi'
import type {
  RecordPaymentRequest,
  VerifyPaymentRequest,
  CancelPaymentRequest,
  EditPaymentRequest,
  Payment,
  PaymentListParams,
} from '../api/types'
import { generateReceiptPDF } from '../utils/receiptGenerator'
import { getClientById } from '@/features/clients/api/clientApi'
import { getSeller } from '@/features/sellers/api/sellersApi'

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
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })

      toast.success('Payment recorded successfully')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.detail ||
            (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.message ||
            'Failed to record payment'
          : 'Failed to record payment'
      toast.error(message)
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
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })

      toast.success('Payment verified successfully')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.detail ||
            (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.message ||
            'Failed to verify payment'
          : 'Failed to verify payment'
      toast.error(message)
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
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })

      toast.success('Payment cancelled successfully')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.detail ||
            (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.message ||
            'Failed to cancel payment'
          : 'Failed to cancel payment'
      toast.error(message)
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
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] })
      // Invalidate client queries to update debt
      queryClient.invalidateQueries({ queryKey: ['client', data.client_id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })

      toast.success('Payment updated successfully')
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.detail ||
            (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.message ||
            'Failed to update payment'
          : 'Failed to update payment'
      toast.error(message)
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
              phone:
                finalClientData?.phone || client.phone_primary || client.phone_secondary || 'N/A',
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
              phone: client.phone_primary || client.phone_secondary || 'N/A',
              contract: 'N/A',
              daysPastDue: undefined,
            }
          }
        } catch (error) {
          console.warn('Failed to fetch client data for receipt:', error)
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
          console.log('Fetching seller data for receipt, sellerId:', sellerId)
          const seller = await getSeller(sellerId)
          console.log('Fetched seller data:', seller)
          // Use seller information for company details
          // Map backend fields (primary_contact_phone, primary_contact_email, legal_address)
          // to frontend fields (contact_phone, contact_email, address)
          companyData = {
            name: seller.seller_name || 'PrivatBank Debt Collection',
            address: seller.legal_address || seller.address || 'Kyiv, Ukraine, 01001',
            phone: seller.primary_contact_phone || seller.contact_phone || '+380 44 123 4567',
            email:
              seller.primary_contact_email || seller.contact_email || 'collections@privatbank.ua',
          }
          console.log('Using seller company data:', companyData)
        } catch (error) {
          console.warn('Failed to fetch seller data for receipt:', error)
          // Fallback to project data if seller fetch fails
          if (paymentData.project_id) {
            try {
              const { getProject } = await import('@/features/projects/api/projectsApi')
              const project = await getProject(paymentData.project_id)
              companyData = {
                name: project.client_company || project.name || 'PrivatBank Debt Collection',
                address:
                  ((project.settings as Record<string, unknown>)?.address as string | undefined) ||
                  'Kyiv, Ukraine, 01001',
                phone:
                  ((project.settings as Record<string, unknown>)?.phone as string | undefined) ||
                  '+380 44 123 4567',
                email:
                  ((project.settings as Record<string, unknown>)?.email as string | undefined) ||
                  'collections@privatbank.ua',
              }
            } catch (projectError) {
              console.warn('Failed to fetch project data for receipt:', projectError)
            }
          }
        }
      } else {
        console.warn('No sellerId found, sellerId:', sellerId, 'paymentData:', paymentData)
        // Fallback to project if no seller_id available
        if (paymentData.project_id) {
          try {
            const { getProject } = await import('@/features/projects/api/projectsApi')
            const project = await getProject(paymentData.project_id)
            companyData = {
              name: project.client_company || project.name || 'PrivatBank Debt Collection',
              address:
                ((project.settings as Record<string, unknown>)?.address as string | undefined) ||
                'Kyiv, Ukraine, 01001',
              phone:
                ((project.settings as Record<string, unknown>)?.phone as string | undefined) ||
                '+380 44 123 4567',
              email:
                ((project.settings as Record<string, unknown>)?.email as string | undefined) ||
                'collections@privatbank.ua',
            }
          } catch (error) {
            console.warn('Failed to fetch project data for receipt:', error)
          }
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
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.detail ||
            (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.message ||
            'Failed to generate receipt'
          : 'Failed to generate receipt'
      toast.error(message)
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
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.detail ||
            (error as { response?: { data?: { detail?: string; message?: string } } }).response
              ?.data?.message ||
            'Failed to export payments'
          : 'Failed to export payments'
      toast.error(message)
    },
  })
}
