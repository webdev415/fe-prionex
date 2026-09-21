/**
 * Debt Summary Page
 *
 * Displays customer debt summary with payment progress and payment history.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  convertUTCToUserTimezone,
  formatClientFullName,
  formatIsoDate,
  formatMoneyUAHTwoDecimals,
} from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { useTrackEvent } from '@/features/operatorAnalytics'
import { useModalOpenTracking } from './hooks/useClientCardInteractionTracking'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  canOfferEasyPayLink,
  copyToClipboard,
  easypayLinkAction,
} from '@/features/payments/utils/easypayLink'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { RecordPaymentModal } from './components/RecordPaymentModal'
import { PaymentVerificationQueueModal } from './components/PaymentVerificationQueueModal'
import { PaymentDetailsModal } from './components/PaymentDetailsModal'
import { CancelPaymentModal } from './components/CancelPaymentModal'
import { ReassignPaymentEmployeeModal } from './components/ReassignPaymentEmployeeModal'
import { useClient } from '@/features/clients/hooks/useClients'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { useCallStore } from '@/stores/callStore'
import { useCallingWindow } from '@/features/calls/hooks/useCallingWindow'
import { CallingWindowTooltip } from '@/features/calls/components/CallingWindowTooltip'
import { useCallOrigination } from '@/features/calls/hooks/useCallOrigination'
import {
  useClientPaymentHistory,
  useClientAllVerifiedPayments,
  useVerifyPayment,
  useCancelPayment,
  useGenerateReceipt,
  useReassignPaymentAssignedUser,
  buildPurchaseDateMap,
  buildVerifiedPaymentsByContract,
} from '@/features/payments'
import { useRecordPaymentFlow } from '@/features/payments/hooks/useRecordPaymentFlow'
import { PaymentMethodCell } from '@/features/payments/components/PaymentMethodCell'
import { VerifiedPaymentsByContract } from './components/VerifiedPaymentsByContract'
import { useUser } from '@/features/users/hooks/useUser'
import type {
  PaymentMethod as BackendPaymentMethod,
  PaymentStatus as BackendPaymentStatus,
} from '@/features/payments/api/types'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'

// Types
interface Payment {
  id: number
  date: string
  amount: number
  contractNumber?: string
  method: BackendPaymentMethod
  /** EasyPay rows only: which service the payer picked on the portal. */
  easypayMethod?: string | null
  /** EasyPay rows only: the checkout URL, absent if the gateway call failed. */
  easypayLink?: string | null
  status: BackendPaymentStatus
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
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)
  const { id } = useParams<{ id: string }>()
  // Hoisted so hooks below (useRecordPaymentFlow) can pass it. Same value as
  // before, just declared earlier; downstream usages are unchanged.
  const clientId = id ? Number(id) : 0
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

  // Payment mutations (must be declared before any conditional returns).
  // ``handleRecordPayment`` is provided by the shared useRecordPaymentFlow hook
  // (same hook used by the Client Profile "+" entry point) so both modal mounts
  // run the identical record-then-verify flow.
  const { handleRecordPayment } = useRecordPaymentFlow({
    clientId,
    onSuccess: () => setIsRecordPaymentModalOpen(false),
  })
  const { mutate: verifyPaymentMutation } = useVerifyPayment()
  const { mutate: cancelPaymentMutation } = useCancelPayment()
  const { mutate: generateReceiptMutation } = useGenerateReceipt()
  const { mutate: reassignEmployeeMutation, isPending: isReassigning } =
    useReassignPaymentAssignedUser()
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false)

  // The payment modals this page owns. Audit only hears about the ones that
  // succeed -- a form opened and abandoned leaves no trace at all, and the
  // details view leaves none either, though it is where an operator reads a
  // client's whole debt breakdown. That gap is what this closes. Same event
  // type the client card emits, so the activity feed renders them identically.
  // No edit modal here: this page never gained one.
  //
  // ``record_payment`` uses the same key the client card emits. The modal is
  // mounted on both, so keying them apart would split one action into two
  // names in the feed for no reason an operator could see.
  const trackEvent = useTrackEvent()
  const paymentModalFlags = useMemo(
    () => ({
      payment_details: isPaymentDetailsModalOpen,
      record_payment: isRecordPaymentModalOpen,
      cancel_payment: isCancelModalOpen,
      reassign_payment: isReassignModalOpen,
      verify_payment: isVerificationModalOpen,
    }),
    [
      isPaymentDetailsModalOpen,
      isRecordPaymentModalOpen,
      isCancelModalOpen,
      isReassignModalOpen,
      isVerificationModalOpen,
    ]
  )

  // Same baseline-then-transition rule as the client card, from the same
  // tested hook rather than a hand-kept copy of it.
  useModalOpenTracking(id, paymentModalFlags, trackEvent)

  // Call functionality state
  const { isCallActive, setOpenCallModal } = useCallStore()
  const {
    user,
    isCallModalOpen,
    setIsCallModalOpen,
    currentCallId,
    activeCallType,
    callError,
    isOriginatingCall,
    isCallCooldown,
    cooldownSecondsRemaining,
    isTelephonyUnavailable,
    handleOriginateCall,
    handleClearCallError,
    handleCloseCallModal,
    handleCallEnd,
  } = useCallOrigination()
  const callingWindow = useCallingWindow(id ? Number(id) : null)

  // Fetch client data from API (same as ClientDetailPage). ``clientId`` is
  // hoisted above (right after useParams) so earlier hooks can use it.
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

  const { data: allVerifiedPayments = [] } = useClientAllVerifiedPayments(clientId, !!clientId)

  const purchaseDateMap = useMemo(() => buildPurchaseDateMap(apiClient?.debts), [apiClient?.debts])

  const verifiedByContract = useMemo(
    () =>
      apiClient
        ? buildVerifiedPaymentsByContract(apiClient.debts, allVerifiedPayments, purchaseDateMap)
        : [],
    [apiClient, allVerifiedPayments, purchaseDateMap]
  )

  const totalVerifiedFullHistory = useMemo(
    () => verifiedByContract.reduce((sum, row) => sum + row.totalVerified, 0),
    [verifiedByContract]
  )

  // Load user details for payment details modal audit trail
  const selectedPaymentData =
    paymentHistoryData && selectedPayment
      ? paymentHistoryData.payments.find((p) => p.id === selectedPayment.id)
      : null

  const cancelledByUserId = selectedPaymentData?.reversed_by_user_id ?? null

  const { data: cancelledByUser } = useUser(cancelledByUserId)

  const client = useMemo(() => {
    if (!apiClient) return null

    const fullName = formatClientFullName(apiClient)

    return {
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
        tin: apiClient.tax_id,
        dateOfBirth: apiClient.date_of_birth || '',
      },
      addresses: {
        registrationAddress: apiClient.address || '',
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

    // Build a lookup from debt contract_number -> purchase_date to filter
    // primary creditor payments (payment_date < purchase_date) from system payments
    const purchaseDateMap = new Map<string, string>()
    ;(apiClient.debts ?? []).forEach((d) => {
      if (d.contract_number && d.purchase_date) {
        purchaseDateMap.set(d.contract_number, d.purchase_date)
      }
    })

    // Map backend payments, filtering out primary creditor payments
    const payments: Payment[] = (paymentHistoryData?.payments || [])
      .filter((p) => {
        // If payment is linked to a debt, only include if payment_date >= purchase_date
        const contractNum = p.debt_contract_number
        if (contractNum) {
          const purchaseDate = purchaseDateMap.get(contractNum)
          if (purchaseDate && p.payment_date && p.payment_date < purchaseDate) {
            return false // primary creditor payment - exclude
          }
        }
        return true
      })
      .map((p) => ({
        id: p.id,
        date: p.recorded_at ?? '',
        amount: Number(p.amount),
        contractNumber: p.debt_contract_number || undefined,
        method: p.payment_method,
        easypayMethod: p.easypay_method,
        easypayLink: p.easypay_link,
        status: p.status,
        receipt: p.receipt_url ? 'PDF' : undefined,
        reference: p.bank_reference || p.payment_number,
      }))

    // Total paid: sum total_paid_amount from debts (already filtered by purchase_date on backend)
    const totalPaid = (apiClient.debts ?? []).reduce(
      (sum, d) => sum + Number(d.total_paid_amount ?? 0),
      0
    )

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

    // Last payment: most recently recorded system payment (excludes primary creditor payments)
    // Uses the same date field logic as the payment table rows for consistency.
    let lastPaymentAmount = 0
    let lastPaymentDate = ''
    if (paymentHistoryData) {
      const verifiedBackendPayments = paymentHistoryData.payments.filter((p) => {
        if (p.status !== 'verified') return false
        // Exclude primary creditor payments
        const contractNum = p.debt_contract_number
        if (contractNum) {
          const purchaseDate = purchaseDateMap.get(contractNum)
          if (purchaseDate && p.payment_date && p.payment_date < purchaseDate) return false
        }
        return true
      })
      if (verifiedBackendPayments.length > 0) {
        // Resolve the display date for each payment (same logic as table row mapping)
        const withDate = verifiedBackendPayments.map((p) => ({
          p,
          // KAN-782: payment_date can be null on legacy rows; verified rows always
          // carry verified_at/recorded_at, so '' is only a type-safety terminal.
          displayDate:
            p.status === 'verified' && p.verified_at
              ? p.verified_at
              : p.recorded_at || p.payment_date || '',
        }))
        // Sort by displayDate descending (most recent first)
        withDate.sort((a, b) => b.displayDate.localeCompare(a.displayDate))
        const mostRecent = withDate[0]
        lastPaymentAmount = Number(mostRecent.p.amount) || 0
        lastPaymentDate = mostRecent.displayDate
      }
    }

    const pendingPayments = payments.filter((p) => p.status === 'pending')
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
      pendingVerification,
    }

    // Use setTimeout to avoid calling setState synchronously within effect
    setTimeout(() => {
      setDebtSummary(data)
    }, 0)
  }, [customerName, paymentHistoryData, apiClient])

  // Helper function to normalize payment method for modals that expect frontend format
  const normalizePaymentMethod = useCallback(
    (method: Payment['method']): 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other' => {
      if (method === 'bank_transfer') return 'Bank Transfer'
      if (method === 'card') return 'Card'
      if (method === 'online_gateway') return 'Online Gateway'
      if (method === 'cash') return 'Cash'
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
        return payment.status === 'pending' && isPaymentLessThan7DaysOld(payment.date)
      })
      .map(convertPaymentToPendingPayment)
  }, [debtSummary, isPaymentLessThan7DaysOld, convertPaymentToPendingPayment])

  // Handlers
  const handleVerifyPayment = (paymentId: string) => {
    // Find payment by ID
    const payment = debtSummary?.payments.find((p) => p.id.toString() === paymentId)
    if (!payment) {
      toast.error(t('errors.paymentNotFound', 'Payment not found'))
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

  // Same two decisions as the Payment History table: offer the link only while
  // it can still be paid, and report a missing one rather than copying an empty
  // string. A pending EasyPay row does not guarantee a stored link.
  const handleCopyEasyPayLink = (payment: Payment) => {
    const action = easypayLinkAction(payment)
    if (action.kind === 'unavailable') {
      toast.error(t('pages.clients.paymentHistory.easypayLink.unavailable'))
      return
    }
    void copyToClipboard(action.url).then((copied) =>
      copied
        ? toast.success(t('pages.clients.paymentHistory.easypayLink.copied'))
        : toast.error(t('pages.clients.paymentHistory.easypayLink.copyFailed'))
    )
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
    }
  }

  // Recently processed payments (verified/cancelled) for the queue modal
  const processedPaymentsForVerification = useMemo(
    () =>
      debtSummary
        ? debtSummary.payments
            .filter((p) => p.status === 'verified' || p.status === 'cancelled')
            .slice(0, 10)
            .map((p) => ({
              id: p.id.toString(),
              paymentId: `PMT-${p.id}`,
              status: (p.status === 'verified' ? 'Verified' : 'Cancelled') as
                | 'Verified'
                | 'Cancelled',
              amount: p.amount,
              action: p.status === 'verified' ? 'Verified by You' : 'Cancelled by You',
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
        {/* Header — matches loaded row: back + title | record payment */}
        <div className="flex flex-row items-center justify-between gap-3 self-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="bg-muted-foreground/25 h-10 w-10 shrink-0 animate-pulse rounded-full" />
            <div className="bg-muted-foreground/25 h-7 max-w-md min-w-0 flex-1 animate-pulse rounded sm:h-8" />
          </div>
          <div className="bg-muted-foreground/25 h-10 w-36 shrink-0 animate-pulse rounded-full sm:w-44" />
        </div>

        {/* Main content — xl row, left 35%, right flex-1 + min-w-0 (same as loaded) */}
        <div className="flex flex-col items-start gap-5 self-stretch xl:flex-row">
          <div className="flex w-full flex-col items-start gap-5 self-stretch xl:w-[35%]">
            {/* Client card — no min-height (matches loaded debt summary card) */}
            <div className="border-border flex flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border p-4 sm:p-6">
              <div className="flex flex-col items-center justify-center gap-4 self-stretch">
                <div className="flex items-center justify-center gap-2 sm:gap-4">
                  <div className="bg-card/80 flex items-center gap-2.5 rounded-full p-2">
                    <div className="bg-muted-foreground/25 h-5 w-5 animate-pulse rounded-full sm:h-6 sm:w-6" />
                  </div>
                  <div className="bg-muted-foreground/25 h-5 w-36 animate-pulse rounded sm:h-6 sm:w-48" />
                </div>
                <div className="bg-muted-foreground/25 h-6 w-28 animate-pulse rounded-full sm:h-7 sm:w-32" />
              </div>

              <div className="mb-6 flex justify-center">
                <div className="relative flex h-[120px] w-[120px] items-center justify-center sm:h-[150px] sm:w-[150px]">
                  <div className="bg-muted-foreground/25 h-[120px] w-[120px] animate-pulse rounded-full sm:h-[150px] sm:w-[150px]" />
                  <div className="bg-border absolute h-10 w-10 animate-pulse rounded-full sm:h-12 sm:w-12" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-5 self-stretch">
                <div className="bg-muted-foreground/25 h-5 w-40 animate-pulse rounded sm:h-6 sm:w-48" />
              </div>

              {/* View payment history / generate plan — pill shapes like LinkButtons */}
              <div className="flex w-full flex-col items-center gap-3 self-stretch">
                <div className="bg-muted-foreground/25 h-10 w-full max-w-[280px] animate-pulse rounded-full" />
                <div className="bg-muted-foreground/25 h-10 w-full max-w-[280px] animate-pulse rounded-full" />
              </div>

              <div className="flex w-full flex-col items-start gap-3 sm:flex-row">
                <div className="bg-muted-foreground/25 h-10 w-full flex-1 animate-pulse rounded-full sm:w-auto sm:flex-1" />
                <div className="bg-muted-foreground/25 h-10 w-full flex-1 animate-pulse rounded-full sm:w-auto sm:flex-1" />
              </div>
            </div>

            {/* Last payment — p-4 like loaded */}
            <div className="border-border bg-card/50 flex flex-col items-start gap-1 self-stretch rounded-xl border p-4">
              <div className="flex flex-row items-start justify-between gap-2 self-stretch">
                <div className="flex items-center gap-3">
                  <div className="bg-muted-foreground/25 h-4 w-4 shrink-0 animate-pulse rounded sm:h-[18px] sm:w-[18px]" />
                  <div className="bg-muted-foreground/25 h-3 w-24 animate-pulse rounded sm:h-4 sm:w-28" />
                </div>
                <div className="bg-muted-foreground/25 h-3 w-12 animate-pulse rounded sm:h-4 sm:w-14" />
              </div>
              <div className="flex flex-row items-center justify-between gap-2 self-stretch">
                <div className="bg-muted-foreground/25 h-5 w-28 animate-pulse rounded sm:h-6 sm:w-32" />
                <div className="bg-muted-foreground/25 h-4 w-24 animate-pulse rounded sm:h-5 sm:w-28" />
              </div>
            </div>

            {/* Total debt — icon row + gradient accent strip */}
            <div className="border-border bg-card/50 relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border px-0 pt-4 pb-6 sm:pt-5">
              <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 sm:px-6">
                <div className="flex items-center gap-2">
                  <div className="bg-muted-foreground/25 h-4 w-4 shrink-0 animate-pulse rounded sm:h-[18px] sm:w-[18px]" />
                  <div className="bg-muted-foreground/25 h-3 w-20 animate-pulse rounded sm:h-4 sm:w-24" />
                </div>
                <div className="bg-muted-foreground/25 h-3 w-24 animate-pulse rounded sm:h-4 sm:w-28" />
              </div>
              <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 sm:px-6 sm:py-0">
                <div className="bg-muted-foreground/25 h-5 w-28 animate-pulse rounded sm:h-6 sm:w-32" />
                <div className="bg-muted-foreground/25 h-4 w-10 animate-pulse rounded sm:h-5 sm:w-12" />
              </div>
              <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r opacity-60" />
            </div>
          </div>

          {/* Right: payment history panel */}
          <div className="bg-card/50 flex min-h-[740px] w-full min-w-0 flex-1 flex-col items-center gap-6 self-stretch rounded-xl p-4 sm:p-6">
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="bg-muted-foreground/25 h-4 w-48 animate-pulse rounded sm:h-5 sm:w-56" />

              <div className="border-border bg-border w-full overflow-hidden rounded-xl border shadow-sm">
                <div className="data-table-scroll mx-0 w-full overflow-x-auto px-0">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-card">
                        <th className="border-border h-[49px] border-r px-3 text-left sm:px-6">
                          <div className="bg-muted-foreground/25 h-3 w-16 animate-pulse rounded sm:h-4 sm:w-20" />
                        </th>
                        <th className="border-border h-[49px] border-r px-3 text-left sm:px-6">
                          <div className="bg-muted-foreground/25 h-3 w-20 animate-pulse rounded sm:h-4 sm:w-24" />
                        </th>
                        <th className="border-border h-[49px] border-r px-3 text-left sm:px-6">
                          <div className="bg-muted-foreground/25 h-3 w-24 animate-pulse rounded sm:h-4 sm:w-28" />
                        </th>
                        <th className="border-border h-[49px] border-r px-3 text-right sm:px-6">
                          <div className="bg-muted-foreground/25 ml-auto h-3 w-14 animate-pulse rounded sm:h-4 sm:w-16" />
                        </th>
                        <th className="border-border h-[49px] border-r px-3 text-left sm:px-6">
                          <div className="bg-muted-foreground/25 h-3 w-14 animate-pulse rounded sm:h-4 sm:w-16" />
                        </th>
                        <th className="border-border h-[49px] border-r px-3 text-left sm:px-6">
                          <div className="bg-muted-foreground/25 h-3 w-16 animate-pulse rounded sm:h-4 sm:w-20" />
                        </th>
                        <th className="border-border h-[49px] border-r px-3 text-left sm:px-6">
                          <div className="bg-muted-foreground/25 h-3 w-14 animate-pulse rounded sm:h-4 sm:w-16" />
                        </th>
                        <th className="border-border h-[49px] border-r px-3 text-center sm:px-6">
                          <div className="bg-muted-foreground/25 mx-auto h-3 w-14 animate-pulse rounded sm:h-4 sm:w-16" />
                        </th>
                        <th className="h-[49px] px-3 text-center sm:px-6">
                          <div className="bg-muted-foreground/25 mx-auto h-3 w-14 animate-pulse rounded sm:h-4 sm:w-16" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 10 }).map((_, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-muted' : 'bg-card'}>
                          <td className="border-border h-[49px] border-r px-3 sm:px-6">
                            <div className="bg-muted-foreground/25 h-3 w-16 animate-pulse rounded sm:h-4 sm:w-20" />
                          </td>
                          <td className="border-border h-[49px] border-r px-3 sm:px-6">
                            <div className="flex flex-col gap-0.5">
                              <div className="bg-muted-foreground/25 h-2.5 w-16 animate-pulse rounded sm:h-3 sm:w-20" />
                              <div className="bg-muted-foreground/25 h-2 w-12 animate-pulse rounded sm:h-2.5 sm:w-14" />
                            </div>
                          </td>
                          <td className="border-border h-[49px] border-r px-3 sm:px-6">
                            <div className="bg-muted-foreground/25 h-3 w-16 animate-pulse rounded sm:h-4 sm:w-20" />
                          </td>
                          <td className="border-border h-[49px] border-r px-3 text-right sm:px-6">
                            <div className="bg-muted-foreground/25 ml-auto h-3 w-16 animate-pulse rounded sm:h-4 sm:w-20" />
                          </td>
                          <td className="border-border h-[49px] border-r px-3 sm:px-6">
                            <div className="bg-muted-foreground/25 h-3 w-12 animate-pulse rounded sm:h-4 sm:w-16" />
                          </td>
                          <td className="border-border h-[49px] border-r px-3 sm:px-6">
                            <div className="bg-muted-foreground/25 h-3 w-20 animate-pulse rounded sm:h-4 sm:w-24" />
                          </td>
                          <td className="border-border h-[49px] border-r px-3 sm:px-6">
                            <div className="flex items-center gap-2">
                              <div className="bg-muted-foreground/25 h-3 w-3 shrink-0 animate-pulse rounded-full" />
                              <div className="bg-muted-foreground/25 h-3 w-14 animate-pulse rounded sm:h-4 sm:w-16" />
                            </div>
                          </td>
                          <td className="border-border h-[49px] border-r px-3 text-center sm:px-6">
                            <div className="bg-muted-foreground/25 mx-auto h-5 w-12 animate-pulse rounded sm:h-6 sm:w-14" />
                          </td>
                          <td className="h-[49px] px-3 text-center sm:px-6">
                            <div className="mx-auto flex justify-center gap-1">
                              <div className="bg-muted-foreground/25 h-5 w-9 animate-pulse rounded sm:h-6 sm:w-10" />
                              <div className="bg-muted-foreground/25 hidden h-5 w-9 animate-pulse rounded sm:flex sm:h-6 sm:w-10" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-border flex w-full items-center justify-center gap-[1px] self-stretch rounded-none border-x">
                  <div className="bg-muted flex min-h-[49px] flex-1 items-center justify-center gap-1 p-2 px-4">
                    <div className="bg-muted-foreground/25 h-4 w-28 animate-pulse rounded sm:h-5 sm:w-32" />
                  </div>
                </div>

                <div className="border-border bg-card flex w-full flex-col items-stretch sm:flex-row sm:items-center sm:justify-between">
                  <div className="border-border flex w-full flex-1 flex-col items-start gap-1 border-r-0 border-b px-4 py-3 sm:flex-row sm:items-center sm:border-r sm:border-b-0 sm:px-6 sm:py-4">
                    <div className="bg-muted-foreground/25 h-3 w-28 animate-pulse rounded sm:h-4 sm:w-32" />
                    <div className="bg-muted-foreground/25 h-3 w-20 animate-pulse rounded sm:h-4 sm:w-24" />
                  </div>
                  <div className="flex flex-1 flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
                    <div className="bg-muted-foreground/25 h-3 w-36 animate-pulse rounded sm:h-4 sm:w-40" />
                    <div className="bg-muted-foreground/25 h-3 w-20 animate-pulse rounded sm:h-4 sm:w-24" />
                  </div>
                </div>
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
        <p className="text-foreground font-medium">
          {t('pages.clients.debtSummary.failedToLoadClient')}
        </p>
        <p className="text-muted-foreground text-sm">
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

  const getStatusDot = (status: Payment['status']) => {
    const statusColors = {
      verified: 'bg-success-500',
      pending: 'bg-muted-foreground',
      cancelled: 'bg-error-500',
    }
    const borderStatusColors = {
      verified: 'bg-success-200',
      pending: 'bg-muted',
      cancelled: 'bg-error-200',
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
          <span className="text-foreground flex-1 text-xl leading-tight font-light tracking-[-0.48px] sm:text-2xl">
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
            <Icons.Add size={20} className="text-foreground" />
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
          <div className="border-border flex flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border p-4 sm:p-6">
            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <div className="bg-card flex items-center gap-2.5 rounded-full p-2">
                  <Icons.User size={20} className="text-foreground sm:size-[24px]" />
                </div>
                <span className="text-foreground text-base leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
                  {debtSummary.customerName}
                </span>
              </div>
              <div className="bg-card flex items-center gap-1 rounded-full px-3 py-1">
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
                    {t(`debtSummaryStatuses.${debtSummary.status}`, debtSummary.status)}
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
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-muted-foreground/25 transition-all duration-300"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={2 * Math.PI * 45 * (1 - debtSummary.progressPercentage / 100)}
                    strokeLinecap="round"
                    className="text-primary-700 transition-all duration-500 ease-in-out"
                  />
                </svg>
                <span className="text-foreground absolute text-[28px] leading-[126%] font-medium tracking-[-0.72px] sm:text-[36px]">
                  {Math.round(debtSummary.progressPercentage)}%
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-5 self-stretch">
              <span className="text-foreground text-center text-base leading-[132%] font-light tracking-[-0.4px] sm:text-xl">
                {t('pages.clients.debtSummary.totalPaid')}{' '}
                <span className="font-medium">
                  {formatMoneyUAHTwoDecimals(debtSummary.totalPaid)}
                </span>
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
                <CallingWindowTooltip
                  message={callingWindow.allowed ? null : callingWindow.message}
                  className="w-full sm:w-auto sm:flex-1"
                >
                  <Button
                    variant="primary"
                    leftIcon={<Icons.Headset size={18} />}
                    className="w-full rounded-full sm:w-auto sm:flex-1"
                    // Gated on the calling window like the client-card button:
                    // every entry point has to agree, or one of them opens a
                    // dialog that cannot dial.
                    disabled={
                      !user?.is_agent || !user?.asterisk_extension || !callingWindow.allowed
                    }
                    onClick={() => {
                      const phoneNumber = client?.phones?.[0]?.number
                      if (!phoneNumber) {
                        toast.error(t('errors.clientHasNoPhone', 'Client has no phone number'))
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
                </CallingWindowTooltip>
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
          <div className="border-border bg-card/50 flex flex-col items-start gap-1 self-stretch rounded-xl border p-4">
            <div className="flex flex-row items-start justify-between gap-2 self-stretch">
              <div className="flex items-center gap-3">
                <Icons.Money01 size={16} className="text-foreground sm:size-[18px]" />
                <span className="text-foreground text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.debtSummary.lastPayment')}
                </span>
              </div>
              <span className="text-foreground text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                {t('pages.clients.debtSummary.date')}
              </span>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch">
              <span className="text-foreground text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                {formatMoneyUAHTwoDecimals(debtSummary.lastPayment.amount)}
              </span>
              <span className="text-foreground text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                {convertUTCToUserTimezone(debtSummary.lastPayment.date, userTimezone)}
              </span>
            </div>
          </div>

          {/* Total Debt Card */}
          <div className="border-border bg-card/50 relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border px-0 pt-4 pb-6 sm:pt-5">
            <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Icons.Wallet01 size={16} className="text-foreground sm:size-[18px]" />
                <span className="text-foreground text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.debtSummary.totalDebt')}
                </span>
              </div>
              <span className="text-foreground text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                {t('pages.clients.debtSummary.daysPastDue')}
              </span>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 sm:px-6 sm:py-0">
              <span className="text-foreground text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                {formatMoneyUAHTwoDecimals(debtSummary.totalDebt)}
              </span>
              <span className="text-foreground text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                {debtSummary.daysPastDue}
              </span>
            </div>
            <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
          </div>
        </div>

        {/* Right Panel - Payment History */}
        <div className="bg-card/50 flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl p-4 sm:p-6">
          <div className="flex flex-col items-start gap-3 self-stretch">
            <span className="text-foreground text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
              {t('pages.clients.debtSummary.paymentHistory')}
              {debtSummary.payments.length > 0 && (
                <>
                  {' '}
                  <span className="font-light">
                    (
                    {showAllPayments
                      ? t('pages.clients.debtSummary.all')
                      : t('pages.clients.debtSummary.last10')}
                    )
                  </span>
                </>
              )}
            </span>

            {/* Custom Table */}
            <div className="border-border bg-border w-full overflow-hidden rounded-xl border shadow-sm">
              <div className="data-table-scroll mx-0 w-full overflow-x-auto px-0">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-card">
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.paymentDate')}
                      </th>
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.date')}
                      </th>
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.paymentConfirmationDate')}
                      </th>
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-right text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.amount')}
                      </th>
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-left text-xs font-medium sm:px-6">
                        {t(
                          'pages.clients.paymentHistory.tableHeaders.contractNumber',
                          'Contract #'
                        )}
                      </th>
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.method')}
                      </th>
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.status')}
                      </th>
                      <th className="text-foreground border-border h-[49px] border-r px-3 text-center text-xs font-medium sm:px-6">
                        {t('pages.clients.debtSummary.tableHeaders.receipt')}
                      </th>
                      <th className="text-foreground h-[49px] px-3 text-center text-xs font-medium sm:px-6">
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
                            colSpan={9}
                            className="text-foreground h-[49px] px-6 text-center text-xs font-medium"
                          >
                            {t('pages.clients.debtSummary.noPaymentHistory')}
                          </td>
                        </tr>
                      ) : (
                        displayedPayments.map((payment, index) => (
                          <tr
                            key={payment.id}
                            className={`transition-colors ${
                              index % 2 === 0 ? 'bg-muted' : 'bg-card'
                            }`}
                          >
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-xs font-medium whitespace-nowrap sm:px-6">
                              {formatIsoDate(
                                paymentHistoryData?.payments.find((p) => p.id === payment.id)
                                  ?.payment_date
                              )}
                            </td>
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-xs font-medium whitespace-nowrap sm:px-6">
                              {(() => {
                                const formatted = convertUTCToUserTimezone(
                                  payment.date,
                                  userTimezone
                                )
                                const spaceIdx = formatted.indexOf(' ')
                                const datePart =
                                  spaceIdx >= 0 ? formatted.slice(0, spaceIdx) : formatted
                                const timePart = spaceIdx >= 0 ? formatted.slice(spaceIdx + 1) : ''
                                return (
                                  <div className="flex flex-col leading-tight">
                                    <span>{datePart}</span>
                                    {timePart && (
                                      <span className="text-foreground">{timePart}</span>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-xs font-medium whitespace-nowrap sm:px-6">
                              {formatIsoDate(
                                paymentHistoryData?.payments.find((p) => p.id === payment.id)
                                  ?.payment_confirmation_date
                              )}
                            </td>
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-right text-xs font-medium whitespace-nowrap sm:px-6">
                              {formatMoneyUAHTwoDecimals(payment.amount)}
                            </td>
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-xs font-medium sm:px-6">
                              {payment.contractNumber || '-'}
                            </td>
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-xs font-medium sm:px-6">
                              <PaymentMethodCell
                                baseLabel={t(
                                  `pages.clients.detail.paymentMethods.${payment.method}`,
                                  { defaultValue: payment.method }
                                )}
                                easypayMethod={payment.easypayMethod}
                                t={t}
                              />
                            </td>
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-xs font-medium sm:px-6">
                              <div className="flex items-center gap-2">
                                {getStatusDot(payment.status)}
                                <span
                                  className={cn(
                                    payment.status === 'verified'
                                      ? 'text-success-500'
                                      : payment.status === 'pending'
                                        ? 'text-muted-foreground'
                                        : 'text-error-500'
                                  )}
                                >
                                  {t(`pages.clients.detail.paymentStatuses.${payment.status}`, {
                                    defaultValue: payment.status,
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="text-foreground border-border h-[49px] border-r px-3 text-center text-xs font-medium sm:px-6">
                              {payment.status === 'verified' && (
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
                                      toast.error(t('errors.paymentNotFound', 'Payment not found'))
                                    }
                                  }}
                                  className="text-xs"
                                >
                                  <span>{t('pages.clients.paymentHistory.actions.pdf')}</span>
                                </LinkButton>
                              )}
                            </td>
                            <td className="text-foreground h-[49px] px-3 text-center text-xs font-medium sm:px-6">
                              <div className="flex items-center justify-center gap-1 sm:gap-2">
                                {payment.status === 'pending' &&
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
                                {canOfferEasyPayLink(payment) && (
                                  <LinkButton
                                    variant="regular-secondary"
                                    size="xs"
                                    leftIcon={<Icons.Link01 size={14} />}
                                    onClick={() => handleCopyEasyPayLink(payment)}
                                    className="text-xs"
                                  >
                                    <span>{t('pages.clients.paymentHistory.actions.link')}</span>
                                  </LinkButton>
                                )}
                                {(payment.status === 'pending' ||
                                  payment.status === 'verified') && (
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
                                {(payment.status === 'verified' ||
                                  payment.status === 'cancelled' ||
                                  (payment.status === 'pending' &&
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

              {/* View All / Show Less when there are payments */}
              {debtSummary.payments.length > 0 && (
                <div className="border-border flex w-full items-center justify-center gap-[1px] self-stretch rounded-none border-x">
                  <div className="bg-muted flex min-h-[49px] flex-1 items-center justify-center gap-1 p-2 px-4">
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
              )}

              {/* Summary Row - Part of table structure */}
              <div className="border-border bg-card flex w-full flex-col items-stretch sm:flex-row sm:items-center sm:justify-between">
                <div className="border-border flex w-full flex-1 flex-col items-start gap-1 border-r-0 border-b px-4 py-3 sm:flex-row sm:items-center sm:border-r sm:border-b-0 sm:px-6 sm:py-4">
                  <span className="text-foreground line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.debtSummary.summary.totalVerified')}
                  </span>
                  <span className="text-foreground line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {formatMoneyUAHTwoDecimals(totalVerifiedFullHistory)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col items-start gap-1 px-4 py-3 sm:flex-row sm:items-center sm:px-6 sm:py-4">
                  <span className="text-foreground line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {t('pages.clients.debtSummary.summary.pendingVerification')}
                  </span>
                  <span className="text-foreground line-clamp-1 flex-1 overflow-hidden text-left text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {formatMoneyUAHTwoDecimals(debtSummary.pendingVerification)}
                  </span>
                </div>
              </div>

              <VerifiedPaymentsByContract contracts={verifiedByContract} />
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
          clientId={clientId}
        />
      )}

      {/* Call Dialog Modal */}
      <CallDialogModal
        open={isCallModalOpen}
        onClose={handleCloseCallModal}
        clientId={client?.id}
        clientName={client?.fullName || ''}
        phoneNumber={client?.phones?.[0]?.number || ''}
        callId={currentCallId}
        initialCallType={activeCallType}
        initialState="initial"
        error={callError}
        isLoading={isOriginatingCall}
        isCallCooldown={isCallCooldown}
        cooldownSecondsRemaining={cooldownSecondsRemaining}
        telephonyUnavailable={isTelephonyUnavailable}
        onCallStart={(callType: CallType, dialPhone: string) => {
          if (!dialPhone?.trim()) return
          return handleOriginateCall(
            dialPhone,
            client?.fullName || '',
            client?.id?.toString() || '',
            callType
          )
        }}
        onCallEnd={(_duration: number, _status: CallStatus) => {
          handleCallEnd()
        }}
        onRetry={handleClearCallError}
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
            status: (selectedPayment.status === 'verified'
              ? 'Verified'
              : selectedPayment.status === 'pending'
                ? 'Pending'
                : 'Cancelled') as 'Verified' | 'Pending' | 'Cancelled',
            amount:
              Number(
                paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)?.amount
              ) || selectedPayment.amount,
            // Use verified_at for verified payments, recorded_at for others
            paymentDate: (() => {
              const bp = paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)
              if (!bp) return selectedPayment.date
              return bp.status === 'verified' && bp.verified_at
                ? bp.verified_at
                : // KAN-782: payment_date can be null on legacy rows → "—"
                  (bp.recorded_at ?? bp.payment_date ?? '—')
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
            createdBy: selectedPaymentData?.assigned_user_full_name || 'Unknown',
            createdAt: selectedPaymentData?.recorded_at || 'Unknown',
            verifiedBy: selectedPaymentData?.verified_by_full_name || undefined,
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
          }}
          onDownloadReceipt={() => {
            if (!paymentHistoryData) return
            const backendPayment = paymentHistoryData.payments.find(
              (p) => p.id === selectedPayment.id
            )
            if (!backendPayment) {
              toast.error(t('errors.paymentNotFound', 'Payment not found'))
              return
            }
            // Prepare client data if available
            const clientData = apiClient
              ? {
                  fullName: formatClientFullName(apiClient),
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
          onReassignEmployee={
            canVerifyPayment && selectedPaymentData?.status === 'verified'
              ? () => setIsReassignModalOpen(true)
              : undefined
          }
        />
      )}

      {/* Reassign Employee Modal */}
      {selectedPayment && selectedPaymentData && (
        <ReassignPaymentEmployeeModal
          open={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          currentEmployeeName={selectedPaymentData.assigned_user_full_name || 'Unknown'}
          currentUserId={selectedPaymentData.assigned_user_id ?? null}
          isSubmitting={isReassigning}
          onConfirm={(newUserId) => {
            reassignEmployeeMutation(
              {
                paymentId: selectedPaymentData.id,
                request: { assigned_user_id: newUserId },
              },
              { onSuccess: () => setIsReassignModalOpen(false) }
            )
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
              status: (selectedPayment.status === 'verified'
                ? 'Verified'
                : selectedPayment.status === 'pending'
                  ? 'Pending'
                  : 'Cancelled') as 'Verified' | 'Pending' | 'Cancelled',
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
                toast.error(t('errors.paymentNotFound', 'Payment not found'))
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
