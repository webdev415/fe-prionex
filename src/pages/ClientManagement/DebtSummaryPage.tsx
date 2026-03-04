/**
 * Debt Summary Page
 *
 * Displays customer debt summary with payment progress and payment history.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { convertUTCToUserTimezone } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { RecordPaymentModal } from './components/RecordPaymentModal'
import { PaymentVerificationQueueModal } from './components/PaymentVerificationQueueModal'
import { PaymentDetailsModal } from './components/PaymentDetailsModal'
import { CancelPaymentModal } from './components/CancelPaymentModal'
import { useClient } from '@/features/clients/hooks/useClients'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { useCallStore } from '@/stores/callStore'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOriginateCall } from '@/features/calls/hooks/useCall'
import { useCallWebSocket } from '@/features/calls/hooks/useCallWebSocket'
import {
  useRecordPayment,
  useClientPaymentHistory,
  useVerifyPayment,
  useCancelPayment,
  useGenerateReceipt,
} from '@/features/payments'
import { useUser } from '@/features/users/hooks/useUser'
import {
  frontendToBackendPaymentMethod,
  backendToFrontendPaymentMethod,
  backendToFrontendPaymentStatus,
} from '@/features/payments/utils'
import { mockClientDetail } from './mockClientDetails'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'

// Types
interface Payment {
  id: number
  date: string
  amount: number
  contractNumber?: string
  method: 'Online' | 'Bank' | 'Card' | 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Other'
  status: 'Verified' | 'Pending' | 'Cancelled'
  receipt?: string
  reference?: string
  project_name?: string
}

interface DebtSummaryData {
  customerName: string
  status: 'Active' | 'Paid' | 'Partially Paid' | 'Dispute' | 'Written off' | 'Sold' | 'Legal'
  progressPercentage: number
  totalPaid: number
  totalDebt: number
  daysPastDue: number
  lastPayment: {
    amount: number
    date: string
  }
  payments: Payment[]
  totalVerified: number
  pendingVerification: number
}

/**
 * Calculate Days Past Due: (current date - last due date) days
 *
 * Finds the most recent debt_close_date (last due date) from all debts
 * and calculates the difference in days from today.
 *
 * @param debts - Array of debt objects with debt_close_date field
 * @returns Number of days past due (0 if not past due or no valid dates)
 */
const calculateDaysPastDue = (
  debts?: Array<{
    debt_close_date?: string | null
    days_past_due?: number | null
  }>
): number => {
  if (!debts || debts.length === 0) {
    return 0
  }

  // First, try to use days_past_due from debt (computed column in DB - most accurate)
  const primaryDebt = debts[0]
  if (primaryDebt.days_past_due !== undefined && primaryDebt.days_past_due !== null) {
    return Math.max(0, primaryDebt.days_past_due)
  }

  // Fallback: Calculate from debt_close_date if days_past_due is not available
  // Find all valid debt_close_date values (last due dates)
  const validDueDates = debts
    .map((debt) => {
      if (!debt.debt_close_date) return null
      const date = new Date(debt.debt_close_date)
      return isNaN(date.getTime()) ? null : date
    })
    .filter((date): date is Date => date !== null)

  if (validDueDates.length === 0) {
    // No valid due dates, return 0
    return 0
  }

  // Get the most recent due date (last due date)
  const lastDueDate = new Date(Math.max(...validDueDates.map((d) => d.getTime())))
  const today = new Date()

  // Normalize both dates to start of day for accurate day calculation
  today.setHours(0, 0, 0, 0)
  lastDueDate.setHours(0, 0, 0, 0)

  // Calculate: (current date - last due date) days
  const diffTime = today.getTime() - lastDueDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Return 0 if not past due (negative or zero days)
  return Math.max(0, diffDays)
}

// Helper function to format date as MM/DD/YYYY (kept for potential future use)
// Note: currently not used because we use payment utils' formatPaymentDate.
// const formatDate = (date: Date): string => {
//   const month = String(date.getMonth() + 1).padStart(2, '0')
//   const day = String(date.getDate()).padStart(2, '0')
//   const year = date.getFullYear()
//   return `${month}/${day}/${year}`
// }

// Previously there was a large mock `getMockDebtSummary` helper here.
// It has been removed now that the page uses real backend data.

export function DebtSummaryPage() {
  const { t, i18n } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [debtSummary, setDebtSummary] = useState<DebtSummaryData | null>(null)
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const canVerifyPayment = useHasPermission(PERMISSIONS.CLIENTS.VERIFY_PAYMENT)

  // Payment mutations (must be declared before any conditional returns)
  const { mutate: recordPaymentMutation } = useRecordPayment()
  const { mutate: verifyPaymentMutation } = useVerifyPayment()
  const { mutate: cancelPaymentMutation } = useCancelPayment()
  const { mutate: generateReceiptMutation } = useGenerateReceipt()

  // Call functionality state
  const { isCallActive, setOpenCallModal } = useCallStore()
  const { user } = useAuth()
  const { mutate: originateCall, isPending: isOriginatingCall } = useOriginateCall()
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)

  // Enable WebSocket for real-time call updates
  useCallWebSocket(user?.asterisk_extension || null)

  // Clear call error when modal opens
  const handleClearCallError = () => {
    setCallError(null)
  }

  // Handle call origination
  const handleOriginateCall = (phoneNumber: string, clientName: string, clientId: string) => {
    if (!user?.asterisk_extension) {
      setCallError('Your account is not configured for calling. Please contact administrator.')
      return
    }

    // Clear any previous error
    setCallError(null)

    originateCall(
      {
        agent_extension: user.asterisk_extension,
        customer_number: phoneNumber,
        caller_id_name: 'CRM Call',
        campaign_id: user.active_project_id ?? undefined,
        metadata: {
          client_id: clientId,
          client_name: clientName,
        },
      },
      {
        onSuccess: (data) => {
          setCurrentCallId(data.call_id)
        },
        onError: (err: unknown) => {
          let message: string | undefined
          if (err && typeof err === 'object' && 'response' in err) {
            const response = (
              err as { response?: { data?: { message?: string; detail?: unknown } } }
            ).response
            const data = response?.data
            if (data?.message) {
              message = data.message
            } else if (data?.detail) {
              if (typeof data.detail === 'string') {
                message = data.detail
              } else if (typeof data.detail === 'object' && data.detail !== null) {
                message = (data.detail as { message?: string }).message
              }
            }
          }
          setCallError(message || 'Failed to initiate call. Please try again.')
        },
      }
    )
  }

  // Fetch client data from API (same as ClientDetailPage)
  const clientId = id ? Number(id) : 0
  const {
    data: apiClient,
    isLoading: isLoadingClient,
    isError: isClientError,
    error: clientError,
  } = useClient(clientId, !!clientId)

  // Fetch payment history for this client
  const { data: paymentHistoryData, refetch: refetchPayments } = useClientPaymentHistory(
    {
      client_id: clientId,
      page: 1,
      limit: 50,
    },
    { enabled: !!clientId }
  )

  // Load user details for payment details modal audit trail
  const selectedPaymentData =
    paymentHistoryData && selectedPayment
      ? paymentHistoryData.payments.find((p) => p.id === selectedPayment.id)
      : null

  const createdByUserId = selectedPaymentData?.recorded_by_user_id ?? null
  const verifiedByUserId = selectedPaymentData?.verified_by_user_id ?? null
  const cancelledByUserId = selectedPaymentData?.reversed_by_user_id ?? null

  const { data: createdByUser } = useUser(createdByUserId)
  const { data: verifiedByUser } = useUser(verifiedByUserId)
  const { data: cancelledByUser } = useUser(cancelledByUserId)

  // Use mock data as fallback for missing fields until backend is fully integrated (same as ClientDetailPage)
  const client = useMemo(() => {
    if (!apiClient) return mockClientDetail

    const fullName = [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
      .filter(Boolean)
      .join(' ')

    // Map API client to expected shape, using mock data for fields not yet in API (same as ClientDetailPage)
    return {
      ...mockClientDetail, // Fallback for fields not yet in backend
      id: apiClient.id,
      fullName,
      taxIdNumber: apiClient.tax_id,
      phoneNumber: apiClient.phone_primary || '-',
      tags: [], // TODO: Add tags support in backend
      score: apiClient.priority_score,
      priority:
        apiClient.manual_priority ||
        (apiClient.priority_score >= 75
          ? 'Critical'
          : apiClient.priority_score >= 50
            ? 'High'
            : apiClient.priority_score >= 25
              ? 'Medium'
              : 'Low'),
      phones: apiClient.phone_primary
        ? [{ number: apiClient.phone_primary, type: 'mobile' as const }]
        : [],
      personalDetails: {
        ...mockClientDetail.personalDetails,
        tin: apiClient.tax_id,
        dateOfBirth: apiClient.date_of_birth || mockClientDetail.personalDetails.dateOfBirth,
      },
      addresses: {
        ...mockClientDetail.addresses,
        registrationAddress: apiClient.address || mockClientDetail.addresses.registrationAddress,
      },
    }
  }, [apiClient])

  // Get customer name from client object
  const customerName = client?.fullName || 'Unknown Client'

  // Helper function to check if payment date is less than 7 days old
  const isPaymentLessThan7DaysOld = useCallback((paymentDate: string): boolean => {
    try {
      // Payment date can be either datetime string (ISO format) or date string (MM/DD/YYYY)
      // Handle both formats
      let paymentDateObj: Date

      if (paymentDate.includes('T') || paymentDate.includes('-')) {
        // ISO datetime format: "2026-01-29T05:31:36" or "2026-01-29T05:31:36Z"
        // Add Z if not present to ensure UTC parsing
        let dateStr = paymentDate
        if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
          dateStr = dateStr + 'Z'
        }
        paymentDateObj = new Date(dateStr)
      } else {
        // Legacy MM/DD/YYYY format
        const [month, day, year] = paymentDate.split('/')
        paymentDateObj = new Date(Number(year), Number(month) - 1, Number(day))
      }

      // Check if date is valid
      if (isNaN(paymentDateObj.getTime())) {
        return false
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      paymentDateObj.setHours(0, 0, 0, 0)

      // Calculate difference in days
      const diffTime = today.getTime() - paymentDateObj.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      // Return true if payment is less than 7 days old
      return diffDays < 7 && diffDays >= 0
    } catch (error) {
      console.error('Error parsing payment date:', paymentDate, error)
      return false
    }
  }, [])

  // Load debt summary data from real payment history + client data
  useEffect(() => {
    if (!customerName || !apiClient) return

    // Map backend payments (may be empty) to frontend payments
    const payments: Payment[] = (paymentHistoryData?.payments || []).map((p) => ({
      id: p.id,
      // Use appropriate datetime based on status:
      // - verified: verified_at (when verified)
      // - cancelled: reversed_at (when cancelled)
      // - pending: recorded_at (when recorded)
      date:
        p.status === 'verified' && p.verified_at
          ? p.verified_at
          : p.status === 'cancelled' && p.reversed_at
            ? p.reversed_at
            : p.recorded_at,
      amount: Number(p.amount),
      contractNumber: p.debt_contract_number || undefined,
      method: backendToFrontendPaymentMethod(p.payment_method),
      status: backendToFrontendPaymentStatus(p.status),
      receipt: p.receipt_url ? 'PDF' : undefined,
      reference: p.bank_reference || p.payment_number,
    }))

    // Total paid: use backend's total_amount_paid (includes ALL verified payments, not just current page)
    const totalPaid = Number(paymentHistoryData?.total_amount_paid ?? 0)

    // Current debt: ALWAYS use apiClient.total_debt as primary source (it's the source of truth)
    // Only use paymentHistoryData.current_debt if apiClient is not available
    // This ensures progress calculation matches the displayed "Total Debt" value
    let currentDebt = 0
    if (apiClient?.total_debt !== undefined && apiClient.total_debt !== null) {
      currentDebt = Number(apiClient.total_debt)
    } else if (
      paymentHistoryData?.current_debt !== undefined &&
      paymentHistoryData.current_debt !== null
    ) {
      currentDebt = Number(paymentHistoryData.current_debt)
    }

    // Progress = 100 * TotalPaid / (TotalPaid + TotalDebt)
    const initialTotal = currentDebt + totalPaid
    const rawProgress = initialTotal > 0 ? (totalPaid / initialTotal) * 100 : 0
    const progressPercentage = Math.max(0, Math.min(100, rawProgress))

    // Last payment: most recently recorded payment from payment history
    // Uses the same date field logic as the payment table rows for consistency.
    let lastPaymentAmount = 0
    let lastPaymentDate = ''
    if (paymentHistoryData) {
      const verifiedBackendPayments = paymentHistoryData.payments.filter(
        (p) => p.status === 'verified'
      )
      if (verifiedBackendPayments.length > 0) {
        // Resolve the display date for each payment (same logic as table row mapping)
        const withDate = verifiedBackendPayments.map((p) => ({
          p,
          displayDate:
            p.status === 'verified' && p.verified_at
              ? p.verified_at
              : p.recorded_at || p.payment_date,
        }))
        // Sort by displayDate descending (most recent first)
        withDate.sort((a, b) => b.displayDate.localeCompare(a.displayDate))
        const mostRecent = withDate[0]
        lastPaymentAmount = Number(mostRecent.p.amount) || 0
        lastPaymentDate = mostRecent.displayDate
      }
    }

    const verifiedPayments = payments.filter((p) => p.status === 'Verified')
    const pendingPayments = payments.filter((p) => p.status === 'Pending')
    const totalVerified = verifiedPayments.reduce((sum, p) => sum + p.amount, 0)
    const pendingVerification = pendingPayments.reduce((sum, p) => sum + p.amount, 0)

    // Use real debts from client if available to compute days past due
    const debts = apiClient?.debts
    const daysPastDue = calculateDaysPastDue(debts)

    // Determine status based on current debt
    let status: DebtSummaryData['status'] = 'Active'
    if (currentDebt === 0) {
      status = 'Paid'
    }

    const data: DebtSummaryData = {
      customerName,
      status,
      progressPercentage,
      totalPaid,
      totalDebt: currentDebt,
      daysPastDue,
      lastPayment: {
        amount: lastPaymentAmount,
        date: lastPaymentDate,
      },
      payments,
      totalVerified,
      pendingVerification,
    }

    // Use setTimeout to avoid calling setState synchronously within effect
    setTimeout(() => {
      setDebtSummary(data)
    }, 0)
  }, [customerName, paymentHistoryData, apiClient])

  // Helper function to normalize payment method
  const normalizePaymentMethod = useCallback(
    (method: Payment['method']): 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other' => {
      // Handle both old and new method values
      if (method === 'Bank' || method === 'Bank Transfer') return 'Bank Transfer'
      if (method === 'Card') return 'Card'
      if (method === 'Online' || method === 'Online Gateway') return 'Online Gateway'
      if (method === 'Cash') return 'Cash'
      return 'Other'
    },
    []
  )

  // Resolve a human-friendly project name for a payment or client.
  // Prefer the payment-level `project_name` (returned by PaymentResponse),
  // fall back to client-level `apiClient.project_name` if present, then to Unknown.
  const resolveProjectName = useCallback(
    (paymentId?: number) => {
      try {
        const fromPayment = paymentHistoryData?.payments.find((p) => p.id === paymentId)
        if (fromPayment?.project_name) return fromPayment.project_name
      } catch {
        // ignore
      }
      if (apiClient?.project_id) return `Project ${apiClient.project_id}`
      return 'Unknown Project'
    },
    [paymentHistoryData, apiClient]
  )

  // Convert Payment to PendingPayment format
  const convertPaymentToPendingPayment = useCallback(
    (payment: Payment): import('./components/PaymentVerificationQueueModal').PendingPayment => {
      const paymentDate = new Date(payment.date)
      const now = new Date()
      const diffMs = now.getTime() - paymentDate.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)

      let submittedAt = ''
      if (diffDays > 0) {
        submittedAt = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
      } else if (diffHours > 0) {
        submittedAt = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
      } else {
        submittedAt = 'Just now'
      }

      const currentDebt = debtSummary?.totalDebt || 0
      const newDebt = Math.max(0, currentDebt - payment.amount)

      return {
        id: payment.id.toString(),
        paymentId: `PMT-${payment.id}`,
        submittedAt,
        client: customerName,
        project: resolveProjectName(payment.id),
        amount: payment.amount,
        method: normalizePaymentMethod(payment.method),
        date: payment.date,
        reference: `TRX${payment.id.toString().padStart(5, '0')}`,
        currentDebt,
        newDebt,
      }
    },
    [customerName, debtSummary, normalizePaymentMethod, resolveProjectName]
  )

  // Filter pending payments that are less than 7 days old
  const pendingPaymentsForVerification = useMemo(() => {
    if (!debtSummary) return []

    return debtSummary.payments
      .filter((payment) => {
        return payment.status === 'Pending' && isPaymentLessThan7DaysOld(payment.date)
      })
      .map(convertPaymentToPendingPayment)
  }, [debtSummary, isPaymentLessThan7DaysOld, convertPaymentToPendingPayment])

  // Handlers
  const handleVerifyPayment = (paymentId: string) => {
    // Find payment by ID
    const payment = debtSummary?.payments.find((p) => p.id.toString() === paymentId)
    if (!payment) {
      toast.error('Payment not found')
      return
    }

    // Use payment_number from backend if available, otherwise use ID
    const backendPayment = paymentHistoryData?.payments.find((p) => p.id.toString() === paymentId)
    const paymentNumber = backendPayment?.payment_number || paymentId

    verifyPaymentMutation(
      {
        paymentId: paymentNumber,
        request: {},
      },
      {
        onSuccess: () => {
          setIsVerificationModalOpen(false)
          setSelectedPaymentId(null)
          refetchPayments()
        },
      }
    )
  }

  const handleCancelPaymentFromQueue = (
    paymentId: string,
    _payment: import('./components/PaymentVerificationQueueModal').PendingPayment
  ) => {
    // Close PaymentVerificationQueueModal
    setIsVerificationModalOpen(false)
    setSelectedPaymentId(null)

    // Find the payment in debtSummary and set it as selectedPayment
    if (debtSummary) {
      const paymentToCancel = debtSummary.payments.find((p) => p.id.toString() === paymentId)
      if (paymentToCancel) {
        setSelectedPayment(paymentToCancel)
        setIsCancelModalOpen(true)
      }
    }
  }

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment)
    setIsPaymentDetailsModalOpen(true)
  }

  const handleCancelPayment = () => {
    if (selectedPayment) {
      // Close PaymentDetailsModal and open CancelPaymentModal
      setIsPaymentDetailsModalOpen(false)
      // Use setTimeout to ensure state updates happen in sequence
      setTimeout(() => {
        setIsCancelModalOpen(true)
      }, 0)
    }
  }

  const handleEditPayment = () => {
    if (selectedPayment) {
      setIsPaymentDetailsModalOpen(false)
      // TODO: Add EditPaymentModal support for DebtSummaryPage if needed
      console.log('Edit payment', selectedPayment.id)
    }
  }

  // Recently processed payments (verified/cancelled) for the queue modal
  const processedPaymentsForVerification = useMemo(
    () =>
      debtSummary
        ? debtSummary.payments
            .filter((p) => p.status === 'Verified' || p.status === 'Cancelled')
            .slice(0, 10)
            .map((p) => ({
              id: p.id.toString(),
              paymentId: `PMT-${p.id}`,
              status: p.status as 'Verified' | 'Cancelled',
              amount: p.amount,
              action: p.status === 'Verified' ? 'Verified by You' : 'Cancelled by You',
              // For now, just show the payment date; PaymentVerificationQueueModal formats it as-is
              time: p.date,
            }))
        : [],
    [debtSummary]
  )

  // Show loading state while fetching client or debt summary
  if (isLoadingClient || !debtSummary) {
    return (
      <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-3 self-stretch sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200 sm:h-8 sm:w-40" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 sm:h-12 sm:w-40" />
        </div>

        {/* Main Content Skeleton */}
        <div className="flex flex-col items-start gap-5 self-stretch xl:flex-row">
          {/* Left Panel Skeleton */}
          <div className="flex w-full flex-col items-start gap-5 self-stretch xl:w-[35%]">
            {/* Client Info Card Skeleton */}
            <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-4 sm:p-6">
              {/* Client Name Skeleton */}
              <div className="flex flex-col items-center justify-center gap-4 self-stretch">
                <div className="flex items-center justify-center gap-2 sm:gap-4">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 sm:h-10 sm:w-10" />
                  <div className="h-5 w-36 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-48" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200 sm:h-8 sm:w-24" />
              </div>

              {/* Progress Circle Skeleton */}
              <div className="mb-6 flex justify-center">
                <div className="relative flex h-[120px] w-[120px] items-center justify-center sm:h-[150px] sm:w-[150px]">
                  <div className="h-[120px] w-[120px] animate-pulse rounded-full bg-gray-200 sm:h-[150px] sm:w-[150px]" />
                  <div className="absolute h-10 w-10 animate-pulse rounded-full bg-gray-300 sm:h-12 sm:w-12" />
                </div>
              </div>

              {/* Total Paid Skeleton */}
              <div className="flex flex-col items-center gap-5 self-stretch">
                <div className="h-5 w-28 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-32" />
                <div className="h-9 w-full animate-pulse rounded bg-gray-200 sm:h-10" />
                <div className="h-9 w-full animate-pulse rounded bg-gray-200 sm:h-10" />
              </div>

              {/* Action Buttons Skeleton */}
              <div className="flex w-full flex-col items-start gap-3 sm:flex-row">
                <div className="h-10 w-full flex-1 animate-pulse rounded-full bg-gray-200 sm:w-auto" />
                <div className="h-10 w-full flex-1 animate-pulse rounded-full bg-gray-200 sm:w-auto" />
              </div>
            </div>

            {/* Last Payment Card Skeleton */}
            <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white/100 bg-white/50 p-4 px-0 sm:p-5">
              <div className="flex flex-col items-start gap-2 self-stretch px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                <div className="h-3 w-14 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
              </div>
              <div className="flex flex-col items-start gap-2 self-stretch px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
                <div className="h-5 w-28 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-32" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-24" />
              </div>
            </div>

            {/* Total Debt Card Skeleton */}
            <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
              <div className="flex flex-col items-start gap-2 self-stretch px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-32" />
              </div>
              <div className="flex flex-col items-start gap-2 self-stretch px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
                <div className="h-5 w-28 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-32" />
                <div className="h-4 w-36 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-40" />
              </div>
            </div>
          </div>

          {/* Right Panel Skeleton - Payment History Table */}
          <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-4 sm:p-6">
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="h-4 w-40 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-48" />

              {/* Table Skeleton */}
              <div className="w-full overflow-x-auto overflow-y-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th className="h-[49px] border-r border-[#EBECE8] px-3 text-left sm:px-6">
                        <div className="h-3 w-12 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-3 text-right sm:px-6">
                        <div className="ml-auto h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-3 text-left sm:px-6">
                        <div className="h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-3 text-left sm:px-6">
                        <div className="h-3 w-12 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-3 text-center sm:px-6">
                        <div className="mx-auto h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
                      </th>
                      <th className="h-[49px] px-3 text-center sm:px-6">
                        <div className="mx-auto h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}
                      >
                        <td className="h-[49px] border-r border-[#EBECE8] px-3 sm:px-6">
                          <div className="h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-3 text-right sm:px-6">
                          <div className="ml-auto h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-3 sm:px-6">
                          <div className="h-3 w-12 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-3 sm:px-6">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 animate-pulse rounded-full bg-gray-200" />
                            <div className="hidden h-4 w-16 animate-pulse rounded bg-gray-200 sm:block sm:w-20" />
                          </div>
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-3 text-center sm:px-6">
                          <div className="mx-auto h-5 w-10 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-12" />
                        </td>
                        <td className="h-[49px] px-3 text-center sm:px-6">
                          <div className="mx-auto h-5 w-20 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-24" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {/* View All Link Skeleton */}
                    <tr>
                      <td
                        colSpan={6}
                        className="border-x border-[#EBECE8] bg-[linear-gradient(0deg,#f2f3f0,#f2f3f0),#ffffff] p-0"
                      >
                        <div className="flex min-h-[49px] items-center justify-center gap-1 p-2 px-4">
                          <div className="h-4 w-28 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-32" />
                        </div>
                      </td>
                    </tr>
                    {/* Summary Row Skeleton */}
                    <tr className="bg-white">
                      <td
                        colSpan={3}
                        className="flex flex-col items-start gap-1 border-r border-[#EBECE8] px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4"
                      >
                        <div className="h-3 w-28 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-32" />
                        <div className="h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                      </td>
                      <td
                        colSpan={3}
                        className="flex flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4"
                      >
                        <div className="h-3 w-36 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-40" />
                        <div className="h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state if client fetch failed
  if (isClientError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Icons.Warning className="text-error-500 h-8 w-8" strokeWidth={2} />
        <p className="font-medium text-gray-900">
          {t('pages.clients.debtSummary.failedToLoadClient')}
        </p>
        <p className="text-sm text-gray-600">
          {clientError?.message || t('pages.clients.debtSummary.errorOccurred')}
        </p>
        <Button
          variant="outline"
          onClick={() => navigate(`/dashboard/clients/${id}`)}
          className="mt-4"
        >
          {t('pages.clients.debtSummary.backToClient')}
        </Button>
      </div>
    )
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '₴ 0'
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    // Format with spaces as thousands separator, no decimals (e.g., "₴ 10 080")
    return `₴ ${num
      .toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/,/g, ' ')}`
  }

  const getStatusDot = (status: Payment['status']) => {
    const statusColors = {
      Verified: 'bg-success-500',
      Pending: 'bg-gray-500',
      Cancelled: 'bg-error-500',
    }
    const borderStatusColors = {
      Verified: 'bg-success-200',
      Pending: 'bg-gray-200',
      Cancelled: 'bg-error-200',
    }
    return (
      <span
        className={cn(
          'flex h-3 w-3 items-center justify-center rounded-full',
          borderStatusColors[status]
        )}
      >
        {' '}
        <span className={cn('h-1.5 w-1.5 rounded-full', statusColors[status])} />
      </span>
    )
  }

  // Remove the paymentColumns array - we'll build the table directly

  const handleRecordPayment = (data: {
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
  }) => {
    const clientId = id ? Number(id) : 0
    if (!clientId) {
      toast.error('Client ID is required')
      return
    }

    // Convert frontend format to backend format
    // CRITICAL FIX: react-datepicker creates dates at midnight UTC
    // When user selects Jan 26, it creates "2026-01-26T00:00:00Z"
    // In GMT-0600, this appears as "Jan 25 2026 18:00:00" (6 PM previous day)
    // We MUST use UTC methods to extract the date the user actually selected
    // Extract UTC components (what user actually selected)
    const year = data.date.getUTCFullYear()
    const month = data.date.getUTCMonth() + 1 // 0-11 -> 1-12
    const day = data.date.getUTCDate()

    // Format as YYYY-MM-DD string
    const paymentDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // Debug: Log what we're sending
    console.log('📅 Sending payment date to backend (FIXED):', {
      originalDate: data.date,
      originalDateString: data.date.toString(),
      originalISO: data.date.toISOString(),
      utcYear: data.date.getUTCFullYear(),
      utcMonth: data.date.getUTCMonth(),
      utcDay: data.date.getUTCDate(),
      localYear: data.date.getFullYear(),
      localMonth: data.date.getMonth(),
      localDay: data.date.getDate(),
      year,
      month,
      day,
      paymentDateString: paymentDate,
    })

    const backendMethod = frontendToBackendPaymentMethod(data.method)

    recordPaymentMutation(
      {
        client_id: clientId,
        debt_id: data.debtId,
        amount: data.amount,
        payment_date: paymentDate,
        payment_method: backendMethod,
        payment_method_details: data.paymentMethodDetails,
        bank_reference:
          data.referenceNumber || (data.method === 'Card' ? `****${data.last4Digits}` : undefined),
        notes: undefined, // Can be added later if needed
        internal_notes: undefined, // Can be added later if needed
      },
      {
        onSuccess: (payment) => {
          // If user chose "Save & verify", immediately verify the payment
          if (data.status === 'Verified') {
            const paymentNumber = payment.payment_number || payment.id?.toString()
            if (paymentNumber) {
              verifyPaymentMutation(
                {
                  paymentId: paymentNumber,
                  request: {},
                },
                {
                  onSuccess: () => {
                    setIsRecordPaymentModalOpen(false)
                  },
                }
              )
              return
            }
          }

          // "Save as pending" – just close modal; queries are already invalidated by hook
          setIsRecordPaymentModalOpen(false)
        },
      }
    )
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
      {/* Header */}
      <div className="flex flex-row items-center justify-between gap-3 self-stretch">
        <div className="flex items-center gap-2">
          <LinkButton
            variant="regular-secondary"
            onClick={() => navigate(`/dashboard/clients/${id}`)}
          >
            <Icons.ArrowLeft02 size={24} />
          </LinkButton>
          <span className="text-dark-500 flex-1 text-xl leading-tight font-light tracking-[-0.48px] sm:text-2xl">
            {t('pages.clients.debtSummary.title')}
          </span>
        </div>
        <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT_DEBT}>
          {/* Mobile: Icon-only button */}
          <Button
            variant="primary"
            size="icon-md"
            onClick={() => setIsRecordPaymentModalOpen(true)}
            className="rounded-full sm:hidden"
          >
            <Icons.Add size={20} className="text-dark-500" />
          </Button>
          {/* Desktop: Full button with text */}
          <DoubleButton
            icon={<Icons.Add size={24} />}
            iconPosition="left"
            onClick={() => setIsRecordPaymentModalOpen(true)}
            className="hidden sm:flex"
          >
            {t('pages.clients.debtSummary.recordPayment')}
          </DoubleButton>
        </PermissionGuard>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-start gap-5 self-stretch xl:flex-row">
        {/* Left Panel - Customer Info and Summary */}
        <div className="flex w-full flex-col items-start gap-5 xl:w-[35%]">
          <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-4 sm:p-6">
            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                  <Icons.User size={20} className="text-dark-500 sm:size-[24px]" />
                </div>
                <span className="text-dark-500 text-base leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
                  {debtSummary.customerName}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1">
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full',
                      debtSummary.status === 'Active' ||
                        debtSummary.status === 'Paid' ||
                        debtSummary.status === 'Partially Paid' ||
                        debtSummary.status === 'Dispute' ||
                        debtSummary.status === 'Legal'
                        ? 'bg-success-200'
                        : 'bg-error-200'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        debtSummary.status === 'Active' ||
                          debtSummary.status === 'Paid' ||
                          debtSummary.status === 'Partially Paid' ||
                          debtSummary.status === 'Dispute' ||
                          debtSummary.status === 'Legal'
                          ? 'bg-success-500'
                          : 'bg-error-500'
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'text-sm leading-[150%] font-medium tracking-[-0.28px]',
                      debtSummary.status === 'Active' ||
                        debtSummary.status === 'Paid' ||
                        debtSummary.status === 'Partially Paid' ||
                        debtSummary.status === 'Dispute' ||
                        debtSummary.status === 'Legal'
                        ? 'text-success-500'
                        : 'text-error-500'
                    )}
                  >
                    {debtSummary.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Circle */}
            <div className="mb-6 flex justify-center">
              <div className="relative flex h-[120px] w-[120px] items-center justify-center sm:h-[150px] sm:w-[150px]">
                <svg
                  className="h-[120px] w-[120px] -rotate-90 transform sm:h-[150px] sm:w-[150px]"
                  viewBox="0 0 100 100"
                >
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#FFF"
                    strokeWidth="10"
                    className="transition-all duration-300"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#A0F229"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={2 * Math.PI * 45 * (1 - debtSummary.progressPercentage / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-in-out"
                  />
                </svg>
                <span className="text-secondary-800 absolute text-[28px] leading-[126%] font-medium tracking-[-0.72px] sm:text-[36px]">
                  {Math.round(debtSummary.progressPercentage)}%
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-5 self-stretch">
              <span className="text-dark-500 text-center text-base leading-[132%] font-light tracking-[-0.4px] sm:text-xl">
                {t('pages.clients.debtSummary.totalPaid')}{' '}
                <span className="font-medium">{formatCurrency(debtSummary.totalPaid)}</span>
              </span>
              <LinkButton
                variant="regular-secondary"
                leftIcon={<Icons.MoneyReceive01 size={20} className="sm:size-[24px]" />}
                onClick={() =>
                  navigate(
                    `/dashboard/clients/${id}/payment-history?status=All&method=All&start_date=&end_date=`
                  )
                }
                className="w-auto flex-1"
              >
                {t('pages.clients.debtSummary.viewPaymentHistory')}
              </LinkButton>

              <LinkButton
                variant="regular-secondary"
                leftIcon={<Icons.PieChart08 size={20} className="sm:size-[24px]" />}
                onClick={() => {
                  // TODO: Handle generate payment plan
                  console.log('Generate payment plan')
                }}
                className="w-auto flex-1"
                disabled
              >
                {t('pages.clients.debtSummary.generatePaymentPlan')}
              </LinkButton>
            </div>

            {/* Action Buttons */}
            <div className="flex w-full flex-col items-start gap-3 sm:flex-row">
              <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
                <Button
                  variant="primary"
                  leftIcon={<Icons.Headset size={18} />}
                  className="w-full rounded-full sm:w-auto sm:flex-1"
                  disabled={!user?.is_agent || !user?.asterisk_extension}
                  onClick={() => {
                    const phoneNumber = client.phones?.[0]?.number
                    if (!phoneNumber) {
                      toast.error('Client has no phone number')
                      return
                    }

                    if (isCallActive()) {
                      toast.warning(
                        t('pages.clients.modals.callDialog.callInProgress') ||
                          'Another call or recording is already in progress. Please finish or close it first.'
                      )
                      return
                    }

                    // Open modal in 'initial' state to let user select call type
                    setOpenCallModal('call-dialog')
                    setIsCallModalOpen(true)
                  }}
                >
                  {t('pages.clients.debtSummary.call')}
                </Button>
              </PermissionGuard>
              <Button
                variant="secondary"
                leftIcon={<Icons.PencilEdit02 size={18} />}
                className="w-full rounded-full sm:w-auto sm:flex-1"
                onClick={() => {
                  // Navigate to client detail page for editing
                  if (id) {
                    navigate(`/dashboard/clients/${id}`)
                  }
                }}
              >
                {t('pages.clients.debtSummary.edit')}
              </Button>
            </div>
          </div>

          {/* Last Payment Card */}
          <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white/100 bg-white/50 p-4">
            <div className="flex flex-row items-start justify-between gap-2 self-stretch">
              <div className="flex items-center gap-3">
                <Icons.Money01 size={16} className="text-gray-700 sm:size-[18px]" />
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.debtSummary.lastPayment')}
                </span>
              </div>
              <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                {t('pages.clients.debtSummary.date')}
              </span>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch">
              <span className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                {formatCurrency(debtSummary.lastPayment.amount)}
              </span>
              <span className="text-dark-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                {convertUTCToUserTimezone(debtSummary.lastPayment.date, userTimezone)}
              </span>
            </div>
          </div>

          {/* Total Debt Card */}
          <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
            <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Icons.Wallet01 size={16} className="text-gray-700 sm:size-[18px]" />
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.debtSummary.totalDebt')}
                </span>
              </div>
              <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                {t('pages.clients.debtSummary.daysPastDue')}
              </span>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 sm:px-6 sm:py-0">
              <span className="text-dark-500 text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                {formatCurrency(debtSummary.totalDebt)}
              </span>
              <span className="text-dark-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                {debtSummary.daysPastDue}
              </span>
            </div>
            <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
          </div>
        </div>

        {/* Right Panel - Payment History */}
        <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-4 sm:p-6">
          <div className="flex flex-col items-start gap-3 self-stretch">
            <span className="text-dark-500 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
              {t('pages.clients.debtSummary.paymentHistory')}{' '}
              <span className="font-light">
                (
                {showAllPayments
                  ? t('pages.clients.debtSummary.all')
                  : t('pages.clients.debtSummary.last10')}
                )
              </span>
            </span>

            {/* Custom Table */}
            <div className="w-full overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
              <div className="data-table-scroll mx-0 w-full overflow-x-auto px-0">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.date')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-right text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.amount')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                        {t(
                          'pages.clients.paymentHistory.tableHeaders.contractNumber',
                          'Contract #'
                        )}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.method')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.status')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-center text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.receipt')}
                      </th>
                      <th className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const displayedPayments = showAllPayments
                        ? debtSummary.payments
                        : debtSummary.payments.slice(0, 10)

                      return displayedPayments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium"
                          >
                            {t('pages.clients.debtSummary.noPaymentHistory')}
                          </td>
                        </tr>
                      ) : (
                        displayedPayments.map((payment, index) => (
                          <tr
                            key={payment.id}
                            className={`transition-colors ${
                              index % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'
                            }`}
                          >
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {convertUTCToUserTimezone(payment.date, userTimezone)}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-right text-xs font-medium sm:px-6">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {payment.contractNumber || '-'}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {(() => {
                                const normalizedMethod = normalizePaymentMethod(payment.method)
                                const methodTranslations: Record<
                                  'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other',
                                  string
                                > = {
                                  'Bank Transfer': t(
                                    'pages.clients.modals.recordPayment.bankTransfer'
                                  ),
                                  'Online Gateway': t(
                                    'pages.clients.modals.recordPayment.onlineGateway'
                                  ),
                                  Cash: t('pages.clients.modals.recordPayment.cash'),
                                  Card: t('pages.clients.modals.recordPayment.card'),
                                  Other: t('pages.clients.modals.recordPayment.other'),
                                }
                                return methodTranslations[normalizedMethod] || normalizedMethod
                              })()}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              <div className="flex items-center gap-2">
                                {getStatusDot(payment.status)}
                                <span
                                  className={cn(
                                    payment.status === 'Verified'
                                      ? 'text-success-500'
                                      : payment.status === 'Pending'
                                        ? 'text-gray-500'
                                        : 'text-error-500'
                                  )}
                                >
                                  {t(
                                    `pages.clients.debtSummary.paymentStatus.${payment.status.toLowerCase()}`
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-center text-xs font-medium sm:px-6">
                              {payment.status === 'Verified' && (
                                <LinkButton
                                  variant="regular-secondary"
                                  size="xs"
                                  leftIcon={<Icons.FileDownload size={14} />}
                                  onClick={() => {
                                    const backendPayment = paymentHistoryData?.payments.find(
                                      (p) => p.id === payment.id
                                    )
                                    if (backendPayment) {
                                      // Prepare client data if available
                                      const clientData = apiClient
                                        ? {
                                            fullName: [
                                              apiClient.first_name,
                                              apiClient.middle_name,
                                              apiClient.last_name,
                                            ]
                                              .filter(Boolean)
                                              .join(' '),
                                            phone: apiClient.phone_primary || 'N/A',
                                            contract:
                                              (apiClient.debts &&
                                                apiClient.debts.length > 0 &&
                                                apiClient.debts[0].contract_number) ||
                                              'N/A',
                                          }
                                        : undefined

                                      generateReceiptMutation({
                                        paymentId: backendPayment.id,
                                        payment: backendPayment, // Pass payment data directly
                                        clientData, // Pass client data if available
                                        clientId: apiClient?.id, // Also pass clientId as fallback
                                        format: 'pdf',
                                      })
                                    } else {
                                      toast.error('Payment not found')
                                    }
                                  }}
                                  className="text-xs"
                                >
                                  <span>{t('pages.clients.paymentHistory.actions.pdf')}</span>
                                </LinkButton>
                              )}
                            </td>
                            <td className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
                              <div className="flex items-center justify-center gap-1 sm:gap-2">
                                {payment.status === 'Pending' &&
                                  isPaymentLessThan7DaysOld(payment.date) && (
                                    <PermissionGuard
                                      permission={PERMISSIONS.CLIENTS.VERIFY_PAYMENT}
                                    >
                                      <LinkButton
                                        variant="regular-secondary"
                                        size="xs"
                                        leftIcon={<Icons.Success size={14} />}
                                        onClick={() => {
                                          setSelectedPaymentId(payment.id)
                                          setIsVerificationModalOpen(true)
                                        }}
                                        className="text-xs"
                                      >
                                        <span>{t('pages.clients.debtSummary.actions.verify')}</span>
                                      </LinkButton>
                                    </PermissionGuard>
                                  )}
                                {(payment.status === 'Pending' ||
                                  payment.status === 'Verified') && (
                                  <PermissionGuard permission={PERMISSIONS.CLIENTS.VERIFY_PAYMENT}>
                                    <LinkButton
                                      variant="regular-secondary"
                                      size="xs"
                                      leftIcon={<Icons.Close size={14} />}
                                      onClick={() => {
                                        setSelectedPayment(payment)
                                        setIsCancelModalOpen(true)
                                      }}
                                      className="text-xs"
                                    >
                                      <span>{t('pages.clients.debtSummary.actions.cancel')}</span>
                                    </LinkButton>
                                  </PermissionGuard>
                                )}
                                {(payment.status === 'Verified' ||
                                  payment.status === 'Cancelled' ||
                                  (payment.status === 'Pending' &&
                                    !isPaymentLessThan7DaysOld(payment.date))) && (
                                  <LinkButton
                                    variant="regular-secondary"
                                    size="xs"
                                    leftIcon={<Icons.View size={14} />}
                                    onClick={() => handleViewDetails(payment)}
                                    className="text-xs"
                                  >
                                    <span>
                                      {t('pages.clients.debtSummary.actions.viewDetails')}
                                    </span>
                                  </LinkButton>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )
                    })()}
                  </tbody>
                </table>
              </div>

              {/* View All Link - Part of table structure */}
              <div className="flex w-full items-center justify-center gap-[1px] self-stretch rounded-none border-x border-[#EBECE8]">
                <div className="flex min-h-[49px] flex-1 items-center justify-center gap-1 bg-[linear-gradient(0deg,#f2f3f0,#f2f3f0),#ffffff] p-2 px-4">
                  <LinkButton
                    variant="regular-secondary"
                    leftIcon={<Icons.Reload size={16} />}
                    onClick={() => {
                      setShowAllPayments(!showAllPayments)
                    }}
                  >
                    {showAllPayments
                      ? t('pages.clients.debtSummary.showLess')
                      : `${t('pages.clients.debtSummary.viewAll')} (${debtSummary.payments.length})`}
                  </LinkButton>
                </div>
              </div>

              {/* Summary Row - Part of table structure */}
              <div className="flex w-full flex-col items-stretch border-[#EBECE8] bg-white sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-1 flex-col items-start gap-1 border-r-0 border-b border-[#EBECE8] px-4 py-3 sm:flex-row sm:items-center sm:border-r sm:border-b-0 sm:px-6 sm:py-4">
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.debtSummary.summary.totalVerified')}
                  </span>
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {formatCurrency(debtSummary.totalVerified)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.debtSummary.summary.pendingVerification')}
                  </span>
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {formatCurrency(debtSummary.pendingVerification)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {debtSummary && (
        <RecordPaymentModal
          open={isRecordPaymentModalOpen}
          onClose={() => setIsRecordPaymentModalOpen(false)}
          customerName={debtSummary.customerName}
          currentDebt={debtSummary.totalDebt}
          debts={apiClient?.debts}
          onSave={handleRecordPayment}
          canVerify={canVerifyPayment}
        />
      )}

      {/* Call Dialog Modal */}
      <CallDialogModal
        open={isCallModalOpen}
        onClose={() => {
          setOpenCallModal(null)
          setIsCallModalOpen(false)
          setCurrentCallId(null)
          handleClearCallError()
        }}
        clientName={client?.fullName || ''}
        phoneNumber={client?.phones?.[0]?.number || ''}
        callId={currentCallId}
        initialState="initial"
        error={callError}
        isLoading={isOriginatingCall}
        onCallStart={(_callType: CallType) => {
          const phoneNumber = client?.phones?.[0]?.number
          if (!phoneNumber) {
            setCallError('Client has no phone number')
            return
          }

          handleOriginateCall(phoneNumber, client?.fullName || '', client?.id?.toString() || '')
        }}
        onCallEnd={(duration: number, status: CallStatus) => {
          console.log('Call ended:', { duration, status })
          setOpenCallModal(null)
          setCurrentCallId(null)
        }}
        onRetry={() => {
          handleClearCallError()
        }}
      />

      {/* Payment Verification Queue Modal */}
      <PaymentVerificationQueueModal
        open={isVerificationModalOpen}
        onClose={() => {
          setIsVerificationModalOpen(false)
          setSelectedPaymentId(null)
        }}
        pendingPayments={pendingPaymentsForVerification}
        processedPayments={processedPaymentsForVerification}
        onVerify={handleVerifyPayment}
        onCancel={handleCancelPaymentFromQueue}
        onRefresh={() => {
          refetchPayments()
        }}
        initialExpandedPaymentId={selectedPaymentId?.toString() || null}
      />

      {/* Payment Details Modal */}
      {selectedPayment && debtSummary && (
        <PaymentDetailsModal
          open={isPaymentDetailsModalOpen}
          onClose={() => {
            setIsPaymentDetailsModalOpen(false)
            setSelectedPayment(null)
          }}
          payment={{
            // Prefer backend payment data for accurate debt impact & audit trail
            ...(paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id) || {}),
            paymentId:
              paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)
                ?.payment_number || `PMT-${selectedPayment.id}`,
            status: selectedPayment.status,
            amount:
              Number(
                paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)?.amount
              ) || selectedPayment.amount,
            // Use verified_at for verified payments, recorded_at for others
            paymentDate: (() => {
              const bp = paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)
              if (!bp) return selectedPayment.date
              return bp.status === 'verified' && bp.verified_at ? bp.verified_at : bp.recorded_at
            })(),
            method: normalizePaymentMethod(selectedPayment.method),
            reference:
              paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)
                ?.bank_reference ||
              paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)
                ?.payment_number ||
              `TRX${selectedPayment.id.toString().padStart(5, '0')}`,
            clientId: id || '',
            clientName: customerName,
            phone: client?.phones?.[0]?.number || '',
            project: resolveProjectName(selectedPayment?.id),
            // Use backend snapshot for Debt Impact when available
            currentDebt:
              Number(
                paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)?.debt_before
              ) || debtSummary.totalDebt,
            newDebt:
              Number(
                paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)?.debt_after
              ) || Math.max(0, debtSummary.totalDebt - selectedPayment.amount),
            // Audit trail — resolved via useUser hooks
            createdBy: createdByUser?.username || 'Unknown',
            createdAt: selectedPaymentData?.recorded_at || 'Unknown',
            verifiedBy: verifiedByUser?.username || undefined,
            verifiedAt: selectedPaymentData?.verified_at || undefined,
            cancelledBy:
              cancelledByUser?.username ||
              (selectedPaymentData?.reversed_by_user_id ? 'Unknown' : undefined),
            cancelledAt:
              paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)?.reversed_at ||
              undefined,
            cancellationReason:
              paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)
                ?.reversal_reason || undefined,
          }}
          onCancelPayment={handleCancelPayment}
          onEditPayment={handleEditPayment}
          onViewClientProfile={() => {
            if (id) {
              setIsPaymentDetailsModalOpen(false)
              navigate(`/dashboard/clients/${id}`)
            }
          }}
          onPrintReceipt={() => {
            // TODO: Handle print receipt
            console.log('Print receipt', selectedPayment.id)
          }}
          onDownloadReceipt={() => {
            if (!paymentHistoryData) return
            const backendPayment = paymentHistoryData.payments.find(
              (p) => p.id === selectedPayment.id
            )
            if (!backendPayment) {
              toast.error('Payment not found')
              return
            }
            // Prepare client data if available
            const clientData = apiClient
              ? {
                  fullName: [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
                    .filter(Boolean)
                    .join(' '),
                  phone: apiClient.phone_primary || 'N/A',
                  contract:
                    (apiClient.debts &&
                      apiClient.debts.length > 0 &&
                      apiClient.debts[0].contract_number) ||
                    'N/A',
                }
              : undefined

            generateReceiptMutation({
              paymentId: backendPayment.id,
              payment: backendPayment, // Pass payment data directly
              clientData, // Pass client data if available
              clientId: apiClient?.id, // Also pass clientId as fallback
              format: 'pdf',
            })
          }}
        />
      )}

      {/* Cancel Payment Modal */}
      <PermissionGuard permission={PERMISSIONS.CLIENTS.VERIFY_PAYMENT}>
        {selectedPayment && debtSummary && isCancelModalOpen && (
          <CancelPaymentModal
            open={isCancelModalOpen}
            onClose={() => {
              setIsCancelModalOpen(false)
              setSelectedPayment(null)
            }}
            payment={{
              paymentId: `PMT-${selectedPayment.id}`,
              client: customerName,
              amount: selectedPayment.amount,
              paymentDate: selectedPayment.date,
              method: normalizePaymentMethod(selectedPayment.method),
              reference:
                selectedPayment.reference || `TRX${selectedPayment.id.toString().padStart(5, '0')}`,
              status: selectedPayment.status as 'Verified' | 'Pending' | 'Cancelled',
              createdBy: 'Operator Sidorov',
              createdAt: '2025-12-10 09:15:32',
              currentDebt: debtSummary.totalDebt,
            }}
            onConfirm={(data) => {
              if (!selectedPayment) return

              const backendPayment = paymentHistoryData?.payments.find(
                (p) => p.id === selectedPayment.id
              )
              if (!backendPayment) {
                toast.error('Payment not found')
                return
              }

              cancelPaymentMutation(
                {
                  paymentId: backendPayment.id.toString(),
                  request: {
                    cancellation_reason: data.reason,
                  },
                },
                {
                  onSuccess: () => {
                    setIsCancelModalOpen(false)
                    setSelectedPayment(null)
                    refetchPayments()
                  },
                }
              )
            }}
          />
        )}
      </PermissionGuard>
    </div>
  )
}
