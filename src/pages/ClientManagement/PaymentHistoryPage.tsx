/**
 * Payment History Page
 *
 * Displays full payment history for a client with filtering and pagination.
 */

import { useState, useEffect, useMemo, useRef, useCallback, useTransition } from 'react'
import { useTranslation } from 'react-i18next'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { convertUTCToUserTimezone, formatIsoDate } from '@/lib/formatters'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { useAuthStore } from '@/stores/authStore'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useURLState, useAutoPersistedState, useHasPermission } from '@/hooks'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'
import { PaymentVerificationQueueModal } from './components/PaymentVerificationQueueModal'
import {
  ExportPaymentsCSVModal,
  type ExportPaymentsCSVModalProps,
} from './components/ExportPaymentsCSVModal'
import { PaymentDetailsModal } from './components/PaymentDetailsModal'
import { CancelPaymentModal } from './components/CancelPaymentModal'
import { EditPaymentModal } from './components/EditPaymentModal'
import { ReassignPaymentEmployeeModal } from './components/ReassignPaymentEmployeeModal'
import { useClient } from '@/features/clients/hooks/useClients'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { useCallStore } from '@/stores/callStore'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { useCallOrigination } from '@/features/calls/hooks/useCallOrigination'
import {
  useClientPaymentHistory,
  useVerifyPayment,
  useCancelPayment,
  useEditPayment,
  useReassignPaymentEmployee,
  useExportPaymentsCSV,
  usePayment,
  useGenerateReceipt,
} from '@/features/payments'
import { useUser } from '@/features/users/hooks/useUser'
import {
  isPaymentLessThan7DaysOld,
  frontendToBackendPaymentMethod,
  frontendToBackendPaymentStatus,
} from '@/features/payments/utils'
import type {
  Payment as BackendPayment,
  PaymentMethod as BackendPaymentMethod,
  PaymentStatus as BackendPaymentStatus,
} from '@/features/payments/api/types'

// Types
interface Payment {
  id: number
  date: string
  amount: number
  contractNumber?: string
  method: BackendPaymentMethod
  status: BackendPaymentStatus
  receipt?: string
  reference?: string
  project_name?: string
}

/** Thead pulse row — identical for full-page load and in-table refetch skeleton */
function PaymentHistoryTableHeadSkeletonRow() {
  return (
    <tr className="bg-white">
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
        <div className="flex items-center gap-1">
          <div className="h-3 w-12 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
          <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded bg-gray-200 opacity-50" />
        </div>
      </th>
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-28" />
      </th>
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
        <div className="h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
      </th>
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-right text-xs font-medium sm:px-6">
        <div className="ml-auto flex items-center justify-end gap-1">
          <div className="h-3 w-12 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-14" />
          <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded bg-gray-200 opacity-50" />
        </div>
      </th>
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
        <div className="flex items-center gap-1">
          <div className="h-3 w-14 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
          <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded bg-gray-200 opacity-50" />
        </div>
      </th>
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
        <div className="flex items-center gap-1">
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
          <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded bg-gray-200 opacity-50" />
        </div>
      </th>
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
        <div className="flex items-center gap-1">
          <div className="h-3 w-14 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
          <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded bg-gray-200 opacity-50" />
        </div>
      </th>
      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
        <div className="flex items-center gap-1">
          <div className="h-3 w-12 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-14" />
          <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded bg-gray-200 opacity-50" />
        </div>
      </th>
      <th className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
        <div className="mx-auto h-3 w-14 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-16" />
      </th>
    </tr>
  )
}

/** Tbody rows — same cell frame as loaded payment rows; bars fill cell width like full-page skeleton */
function PaymentHistoryTableBodySkeletonRows() {
  const bar = (align: 'left' | 'right', narrow = false) => {
    const width = narrow
      ? 'w-[72%] max-w-[4.5rem]'
      : align === 'right'
        ? 'w-[70%] max-w-[5rem]'
        : 'w-[88%] max-w-[11rem]'
    const alignCls = align === 'right' ? 'ml-auto' : 'mr-auto'
    return (
      <div
        className={cn(
          'block h-3 min-w-[3rem] animate-pulse rounded bg-gray-200 sm:h-4',
          width,
          alignCls
        )}
      />
    )
  }

  return (
    <>
      {Array.from({ length: 10 }).map((_, rowIndex) => (
        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
            {bar('left')}
          </td>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
            {bar('left', true)}
          </td>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
            {bar('left', true)}
          </td>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-right text-xs font-medium sm:px-6">
            {bar('right', true)}
          </td>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
            {bar('left')}
          </td>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
            {bar('left')}
          </td>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
            {bar('left', true)}
          </td>
          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
            <div className="flex w-full min-w-0 items-center gap-2">
              <div className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="h-3 max-w-[6rem] min-w-0 flex-1 animate-pulse rounded bg-gray-200 sm:h-4 sm:max-w-[7rem]" />
            </div>
          </td>
          <td className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
            <div className="mx-auto flex w-full max-w-[7rem] items-center justify-center gap-1 sm:max-w-[9rem] sm:gap-2">
              <div className="h-5 w-10 shrink-0 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-11" />
              <div className="hidden h-5 w-10 shrink-0 animate-pulse rounded bg-gray-200 sm:block sm:h-6 sm:w-11" />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

export function PaymentHistoryPage() {
  const { t, i18n } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // URL state for pagination
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [pageSize, setPageSize] = useURLState<number>('pageSize', 10)

  // URL state for filters
  const [statusFilterUrl, setStatusFilterUrl] = useURLState<string>('status', 'All')
  const [methodFilterUrl, setMethodFilterUrl] = useURLState<string>('method', 'All')
  const [startDateUrl, setStartDateUrl] = useURLState<string>('start_date', '')
  const [endDateUrl, setEndDateUrl] = useURLState<string>('end_date', '')

  // Add persistence for state
  useAutoPersistedState(
    'payment-history-state',
    {
      currentPage,
      pageSize,
      statusFilterUrl,
      methodFilterUrl,
      startDateUrl,
      endDateUrl,
    },
    {
      currentPage: setCurrentPage,
      pageSize: setPageSize,
      statusFilterUrl: setStatusFilterUrl,
      methodFilterUrl: setMethodFilterUrl,
      startDateUrl: setStartDateUrl,
      endDateUrl: setEndDateUrl,
    }
  )

  // Convert URL state to component state
  const statusFilter = statusFilterUrl
  const methodFilter = methodFilterUrl
  const startDate = useMemo(() => (startDateUrl ? new Date(startDateUrl) : null), [startDateUrl])
  const endDate = useMemo(() => (endDateUrl ? new Date(endDateUrl) : null), [endDateUrl])

  // Create setters that update URL state
  const setStatusFilter = (value: string) => setStatusFilterUrl(value)
  const setMethodFilter = (value: string) => setMethodFilterUrl(value)
  const setStartDate = useCallback(
    (value: Date | null) =>
      setStartDateUrl(value ? getDateStringInTimezone(value, userTimezone) : ''),
    [setStartDateUrl, userTimezone]
  )
  const setEndDate = useCallback(
    (value: Date | null) =>
      setEndDateUrl(value ? getDateStringInTimezone(value, userTimezone) : ''),
    [setEndDateUrl, userTimezone]
  )

  // Note: paymentHistory is computed from API data using useMemo (see line 299)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [openDropdownPaymentId, setOpenDropdownPaymentId] = useState<number | null>(null)
  const dateRangeInitialized = useRef(false)
  const dateFiltersCleared = useRef(false)

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null)
  const [isSortPending, startSortTransition] = useTransition()

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

  // Fetch client data from API (same as DebtSummaryPage)
  const clientId = id ? Number(id) : 0
  const {
    data: apiClient,
    isLoading: isLoadingClient,
    isError: isClientError,
    error: clientError,
  } = useClient(clientId, !!clientId)

  // Fetch payment history from API
  const {
    data: paymentHistoryData,
    isLoading: isLoadingPayments,
    isFetching: isFetchingPayments,
    isError: isPaymentError,
    error: paymentError,
    refetch: refetchPayments,
  } = useClientPaymentHistory(
    {
      client_id: clientId,
      page: currentPage,
      limit: pageSize,
      status: statusFilter !== 'All' ? (statusFilter as BackendPaymentStatus) : undefined,
      payment_method: methodFilter !== 'All' ? (methodFilter as BackendPaymentMethod) : undefined,
      from_date: startDate ? getDateStringInTimezone(startDate, userTimezone) : undefined,
      to_date: endDate ? getDateStringInTimezone(endDate, userTimezone) : undefined,
      date_field: 'recorded_at',
      tz: userTimezone,
    },
    { enabled: !!clientId, keepPreviousDataBetweenFetches: true }
  )

  // Get client name and create client object for call functionality
  const client = useMemo(() => {
    if (!apiClient) return null

    const fullName = [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
      .filter(Boolean)
      .join(' ')

    return {
      id: apiClient.id,
      fullName: fullName,
      phones: apiClient.phone_primary
        ? [{ number: apiClient.phone_primary, type: 'mobile' as const }]
        : [],
    }
  }, [apiClient])

  // Get client name from API or fallback to mock
  const customerName = useMemo(() => {
    return client?.fullName || 'Unknown Client'
  }, [client])

  // Convert backend payment to frontend format
  const convertBackendPayment = useCallback((backendPayment: BackendPayment): Payment => {
    return {
      id: backendPayment.id,
      // Always use recorded_at — see requirements CHANGE 11.0.
      // Rows with NULL recorded_at (auto-created verified) yield an empty string;
      // downstream sort pushes them to the end, filter excludes them.
      date: backendPayment.recorded_at ?? '',
      amount: Number(backendPayment.amount),
      contractNumber: backendPayment.debt_contract_number || undefined,
      method: backendPayment.payment_method,
      status: backendPayment.status,
      receipt: backendPayment.receipt_url,
      reference: backendPayment.bank_reference || backendPayment.payment_number,
    }
  }, [])

  // Convert payment history data to frontend format
  const paymentHistory = useMemo(() => {
    if (!paymentHistoryData || !apiClient) return null

    const fullName = [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
      .filter(Boolean)
      .join(' ')

    const frontendPayments = paymentHistoryData.payments.map(convertBackendPayment)

    // Calculate statistics
    const verifiedPayments = frontendPayments.filter((p) => p.status === 'verified')
    const pendingPayments = frontendPayments.filter((p) => p.status === 'pending')

    const totalPaymentsAmount = frontendPayments.reduce((sum, p) => sum + p.amount, 0)
    const verifiedPaymentsAmount = verifiedPayments.reduce((sum, p) => sum + p.amount, 0)
    const pendingPaymentsAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0)

    // Total paid and progress:
    // - Total paid: use backend's total_amount_paid (includes ALL verified payments, not just current page)
    //   This value should NOT be affected by date filters - it's the total for all verified payments
    // - Current debt: ALWAYS use apiClient.total_debt as primary source (it's the source of truth)
    //   Only use paymentHistoryData.current_debt if apiClient is not available
    // - Progress = 100 * TotalPaid / (TotalPaid + CurrentDebt)
    let currentDebt = 0
    if (apiClient?.total_debt !== undefined && apiClient.total_debt !== null) {
      currentDebt = Number(apiClient.total_debt)
    } else if (
      paymentHistoryData?.current_debt !== undefined &&
      paymentHistoryData.current_debt !== null
    ) {
      currentDebt = Number(paymentHistoryData.current_debt)
    }

    // Use total_amount_paid from backend (all verified payments, regardless of filters)
    // This should always be present and correct
    const totalPaid = Number(paymentHistoryData?.total_amount_paid ?? 0)

    const initialTotal = currentDebt + totalPaid
    const rawProgress = initialTotal > 0 ? (totalPaid / initialTotal) * 100 : 0
    const progressPercentage = Math.max(0, Math.min(100, rawProgress))

    // Determine client status based on debt
    let clientStatus:
      | 'Active'
      | 'Paid'
      | 'Partially Paid'
      | 'Dispute'
      | 'Written off'
      | 'Sold'
      | 'Legal' = 'Active'
    if (currentDebt === 0) {
      clientStatus = 'Paid'
    } else if (initialTotal > 0 && currentDebt < initialTotal) {
      clientStatus = 'Partially Paid'
    }

    return {
      customerName: fullName || 'Unknown Client',
      status: clientStatus,
      progressPercentage,
      totalPaid,
      totalDebt: currentDebt,
      totalPayments: paymentHistoryData.total_payments,
      totalPaymentsAmount,
      verifiedPayments: verifiedPayments.length,
      verifiedPaymentsAmount,
      pendingPayments: pendingPayments.length,
      pendingPaymentsAmount,
      payments: frontendPayments,
    }
  }, [paymentHistoryData, apiClient, convertBackendPayment])

  // Payment mutations
  const { mutate: verifyPaymentMutation } = useVerifyPayment()
  const { mutate: cancelPaymentMutation } = useCancelPayment()
  const { mutate: editPaymentMutation } = useEditPayment()
  const { mutate: exportPaymentsMutation } = useExportPaymentsCSV()
  const { mutate: generateReceiptMutation } = useGenerateReceipt()
  const { mutate: reassignEmployeeMutation, isPending: isReassigning } =
    useReassignPaymentEmployee()

  const canReassignEmployee = useHasPermission(PERMISSIONS.CLIENTS.VERIFY_PAYMENT)
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false)

  // Fetch payment details when selectedPayment changes
  const backendPayment = paymentHistoryData?.payments.find((p) => p.id === selectedPayment?.id)
  const paymentNumber = backendPayment?.payment_number || selectedPayment?.id.toString()
  const { data: paymentDetails } = usePayment(
    paymentNumber || null,
    !!selectedPayment && !!paymentNumber
  )

  // Load user details for "Cancelled by" using reversed_by_user_id
  const cancelledByUserId = paymentDetails?.reversed_by_user_id ?? null
  const { data: cancelledByUser } = useUser(cancelledByUserId)

  // Helper function to check if payment date is less than 7 days old
  // Use utility function from payments feature
  const checkPaymentLessThan7DaysOld = useCallback((paymentDate: string): boolean => {
    // Convert MM/DD/YYYY to ISO date for utility function
    try {
      const [month, day, year] = paymentDate.split('/')
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      return isPaymentLessThan7DaysOld(isoDate)
    } catch {
      return false
    }
  }, [])

  // Resolve a human-friendly project name for a payment
  const resolveProjectName = useCallback(
    (paymentId?: number) => {
      try {
        const fromPayment = paymentHistoryData?.payments.find((p) => p.id === paymentId)
        if (fromPayment?.project_name) return fromPayment.project_name
      } catch {
        // ignore
      }
      return 'Unknown Project'
    },
    [paymentHistoryData]
  )

  // Convert Payment to PendingPayment format
  const convertPaymentToPendingPayment = useCallback(
    (payment: Payment): import('./components/PaymentVerificationQueueModal').PendingPayment => {
      // Calculate time ago (simple implementation)
      const paymentDateObj = new Date(payment.date)
      const now = new Date()
      const diffMs = now.getTime() - paymentDateObj.getTime()
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

      // Use backend debt_before / debt_after when available for accurate debt impact
      const backendPayment = paymentHistoryData?.payments.find((p) => p.id === payment.id)
      const currentDebt = backendPayment
        ? Number(backendPayment.debt_before) || 0
        : paymentHistory?.totalDebt || 0
      const newDebt = backendPayment
        ? Number(backendPayment.debt_after) || 0
        : Math.max(0, currentDebt - payment.amount)

      return {
        id: payment.id.toString(),
        paymentId: `PMT-${payment.id}`,
        submittedAt,
        client: customerName,
        project: resolveProjectName(payment.id),
        amount: payment.amount,
        method: payment.method,
        date: payment.date,
        reference: payment.reference || `TRX${payment.id.toString().padStart(5, '0')}`,
        currentDebt,
        newDebt,
      }
    },
    [customerName, paymentHistory, paymentHistoryData, resolveProjectName]
  )

  // Filter pending payments that are less than 7 days old
  const pendingPaymentsForVerification = useMemo(() => {
    if (!paymentHistory) return []

    return paymentHistory.payments
      .filter((payment) => {
        return payment.status === 'pending' && checkPaymentLessThan7DaysOld(payment.date)
      })
      .map(convertPaymentToPendingPayment)
  }, [paymentHistory, checkPaymentLessThan7DaysOld, convertPaymentToPendingPayment])

  const handleVerifyPayment = (paymentId: string) => {
    // Find payment by ID
    const payment = paymentHistory?.payments.find((p) => p.id.toString() === paymentId)
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

    // Find the payment in paymentHistory and set it as selectedPayment
    if (paymentHistory) {
      const paymentToCancel = paymentHistory.payments.find((p) => p.id.toString() === paymentId)
      if (paymentToCancel) {
        setSelectedPayment(paymentToCancel)
        setIsCancelModalOpen(true)
      }
    }
  }

  const handleSaveEditPayment = (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Online Gateway' | 'Card'
    referenceNumber?: string
    last4Digits?: string
    paymentMethodDetails?: string
  }) => {
    if (!selectedPayment) return

    const backendPayment = paymentHistoryData?.payments.find((p) => p.id === selectedPayment.id)
    if (!backendPayment) {
      toast.error('Payment not found')
      return
    }

    editPaymentMutation(
      {
        paymentId: backendPayment.id,
        request: {
          amount: data.amount,
          payment_method: frontendToBackendPaymentMethod(data.method),
          payment_method_details: data.paymentMethodDetails,
          bank_reference:
            data.referenceNumber ||
            (data.method === 'Card' ? `****${data.last4Digits}` : undefined),
        },
      },
      {
        onSuccess: () => {
          setIsEditModalOpen(false)
          setSelectedPayment(null)
          refetchPayments()
        },
      }
    )
  }

  const handleExport = (data: {
    startDate: Date | null
    endDate: Date | null
    statuses: string[]
    method: string
    project: string
    columns: string[]
  }) => {
    exportPaymentsMutation({
      client_id: clientId,
      from_date: data.startDate ? getDateStringInTimezone(data.startDate, userTimezone) : undefined,
      to_date: data.endDate ? getDateStringInTimezone(data.endDate, userTimezone) : undefined,
      status:
        data.statuses.length === 1 && data.statuses[0] !== 'All'
          ? frontendToBackendPaymentStatus(data.statuses[0] as 'Verified' | 'Pending' | 'Cancelled')
          : undefined,
      payment_method:
        data.method !== 'All'
          ? frontendToBackendPaymentMethod(
              data.method as 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
            )
          : undefined,
    })
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
      setIsCancelModalOpen(true)
    }
  }

  const handleEditPayment = () => {
    if (selectedPayment) {
      // Close PaymentDetailsModal and open EditPaymentModal
      setIsPaymentDetailsModalOpen(false)
      // Use setTimeout to ensure state updates happen in sequence
      setIsEditModalOpen(true)
    }
  }

  const handleViewClientProfile = () => {
    if (selectedPayment && id) {
      setIsPaymentDetailsModalOpen(false)
      navigate(`/dashboard/clients/${id}`)
    }
  }

  // Clear restrictive date filters immediately if they cause no results
  useEffect(() => {
    if (
      paymentHistoryData &&
      paymentHistoryData.total_payments > 0 &&
      paymentHistoryData.payments.length === 0 &&
      (startDate || endDate)
    ) {
      // Date filter is too restrictive - clear it immediately to show all payments
      setStartDate(null)
      setEndDate(null)
      dateRangeInitialized.current = false
      dateFiltersCleared.current = true
    }
  }, [paymentHistoryData, setStartDate, setEndDate, startDate, endDate])

  // Clear date filters on initial load if they're set to a single day (likely wrong/restrictive)
  useEffect(() => {
    // Only run once on mount - clear single-day filters that are likely wrong
    // This prevents restrictive date filters from hiding all payments
    if (!dateFiltersCleared.current && startDateUrl && endDateUrl && startDateUrl === endDateUrl) {
      // Single day filter on initial load - clear it immediately to show all payments
      setStartDateUrl('')
      setEndDateUrl('')
      dateFiltersCleared.current = true
    }
  }, [startDateUrl, endDateUrl, setStartDateUrl, setEndDateUrl])

  // Initialize date range from payment history data (only after we have payments)
  useEffect(() => {
    // Only initialize if we have payments and haven't initialized yet
    if (
      paymentHistoryData &&
      paymentHistoryData.payments.length > 0 &&
      !dateRangeInitialized.current
    ) {
      const dates = paymentHistoryData.payments
        .map((payment) => {
          const dateStr = payment.payment_date
          if (!dateStr) return null
          const [year, month, day] = dateStr.split('-').map(Number)
          if (isNaN(year) || isNaN(month) || isNaN(day)) return null
          return new Date(year, month - 1, day)
        })
        .filter((d): d is Date => d !== null)

      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

        // Only set date range if it covers multiple days or if it's the actual payment date range
        // Don't set if it's a single day (that would be too restrictive)
        if (minDate.getTime() !== maxDate.getTime() || dates.length === 1) {
          setStartDate(minDate)
          setEndDate(maxDate)
          dateRangeInitialized.current = true
        }
      }
    }
  }, [paymentHistoryData, setStartDate, setEndDate])

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '₴ 0'
    const locale = intlLocaleForUiLanguage(i18n.language)
    return `₴ ${num
      .toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/,/g, ' ')}`
  }

  const getStatusDot = (status: Payment['status']) => {
    const statusColors = {
      verified: 'bg-success-500',
      pending: 'bg-gray-500',
      cancelled: 'bg-error-500',
    }
    const borderStatusColors = {
      verified: 'bg-success-200',
      pending: 'bg-gray-200',
      cancelled: 'bg-error-200',
    }
    return (
      <span
        className={cn(
          'flex h-3 w-3 items-center justify-center rounded-full',
          borderStatusColors[status]
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', statusColors[status])} />
      </span>
    )
  }

  // Handle sort (transition shows table-only skeleton while client-side sort applies)
  const handleSort = (key: string) => {
    startSortTransition(() => {
      setSortConfig((prev) => {
        const newOrder: 'asc' | 'desc' = prev?.key === key && prev.order === 'asc' ? 'desc' : 'asc'
        return { key, order: newOrder }
      })
    })
  }

  // Get sort icon for column header
  const getSortIcon = (columnKey: string) => {
    const isActive = sortConfig?.key === columnKey

    if (!isActive) {
      return (
        <span className="ml-1 opacity-40">
          <Icons.Sorting01Icon size={14} className="text-gray-500" strokeWidth={1.5} />
        </span>
      )
    }

    return sortConfig.order === 'asc' ? (
      <span className="ml-1 inline-block rotate-180">
        <Icons.Sorting01Icon size={14} className="text-information-400" strokeWidth={2} />
      </span>
    ) : (
      <span className="ml-1">
        <Icons.Sorting01Icon size={14} className="text-information-400" strokeWidth={2} />
      </span>
    )
  }

  // Filter and sort payments
  const filteredPayments = useMemo(() => {
    if (!paymentHistory) return []

    let result = paymentHistory.payments.filter((payment) => {
      if (statusFilter !== 'All' && payment.status !== statusFilter) return false
      if (methodFilter !== 'All') {
        // Payment method is already in frontend format, compare directly
        if (payment.method !== methodFilter) return false
      }

      // Date range filtering (defense-in-depth — backend CHANGE 13 already filters server-side)
      if (startDate || endDate) {
        if (!payment.date) return false // Exclude NULL recorded_at rows
        const paymentDate = new Date(payment.date) // ISO timestamp — safe to use Date()
        if (isNaN(paymentDate.getTime())) return false

        if (startDate) {
          const fromDate = new Date(startDate)
          fromDate.setHours(0, 0, 0, 0)
          if (paymentDate < fromDate) return false
        }

        if (endDate) {
          const toDate = new Date(endDate)
          toDate.setHours(23, 59, 59, 999) // Include the entire end date
          if (paymentDate > toDate) return false
        }
      }

      return true
    })

    // Apply sorting
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aValue: string | number
        let bValue: string | number

        switch (sortConfig.key) {
          case 'date': {
            // Empty date (auto-created verified with NULL recorded_at) always sorts last.
            const aEmpty = !a.date
            const bEmpty = !b.date
            if (aEmpty && bEmpty) return 0
            if (aEmpty) return 1
            if (bEmpty) return -1
            // recorded_at is a full ISO timestamp — Date.parse preserves chronological order.
            aValue = Date.parse(a.date)
            bValue = Date.parse(b.date)
            break
          }
          case 'amount':
            aValue = a.amount
            bValue = b.amount
            break
          case 'method':
            aValue = a.method.toLowerCase()
            bValue = b.method.toLowerCase()
            break
          case 'status':
            aValue = a.status.toLowerCase()
            bValue = b.status.toLowerCase()
            break
          case 'reference':
            aValue = (a.reference || '').toLowerCase()
            bValue = (b.reference || '').toLowerCase()
            break
          case 'contract':
            aValue = (a.contractNumber || '').toLowerCase()
            bValue = (b.contractNumber || '').toLowerCase()
            break
          default:
            return 0
        }

        if (aValue < bValue) {
          return sortConfig.order === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.order === 'asc' ? 1 : -1
        }
        return 0
      })
    }

    return result
  }, [paymentHistory, statusFilter, methodFilter, startDate, endDate, sortConfig])

  // Paginate payments
  const totalPages = Math.ceil(filteredPayments.length / pageSize)
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredPayments.slice(start, end)
  }, [filteredPayments, currentPage, pageSize])

  const paymentHistorySubtitle = useMemo(() => {
    if (!paymentHistory || filteredPayments.length === 0) {
      return null
    }

    const total = filteredPayments.length
    const start = (currentPage - 1) * pageSize + 1
    const end = Math.min(currentPage * pageSize, total)

    if (currentPage === 1 && pageSize === 10 && total >= 10) {
      return t('pages.clients.paymentHistory.subtitle.last10')
    }

    if (start === end) {
      return t('pages.clients.paymentHistory.subtitle.single', { index: start, total })
    }
    return t('pages.clients.paymentHistory.subtitle.range', { start, end, total })
  }, [paymentHistory, filteredPayments, currentPage, pageSize, t])

  /** Same thead + tbody skeleton as full-page load (filters stay interactive). */
  const showPaymentTableBodySkeleton = Boolean(
    paymentHistory && (isFetchingPayments || isSortPending)
  )

  const showFullPageLoadingSkeleton =
    isLoadingClient ||
    !apiClient ||
    (!paymentHistoryData && !isPaymentError && (isLoadingPayments || isFetchingPayments))

  if (isClientError || isPaymentError) {
    const errorMessage =
      clientError?.message || paymentError?.message || t('pages.clients.debtSummary.errorOccurred')
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Icons.Warning className="text-error-500 h-8 w-8" strokeWidth={2} />
        <p className="font-medium text-gray-900">
          {isClientError
            ? t('pages.clients.debtSummary.failedToLoadClient')
            : t('pages.clients.paymentHistory.failedToLoadPayments')}
        </p>
        <p className="text-sm text-gray-600">{errorMessage}</p>
        <Button
          variant="outline"
          onClick={() => navigate(`/dashboard/clients/${id}/debt-summary`)}
          className="mt-4"
        >
          {t('pages.clients.debtSummary.backToClient')}
        </Button>
      </div>
    )
  }

  if (showFullPageLoadingSkeleton || !paymentHistory) {
    return (
      <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
        {/* Header — matches loaded: xl row, back + title | export */}
        <div className="flex flex-col gap-3 self-stretch xl:h-12 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 sm:self-stretch">
            <div className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-12 sm:w-28" />
            <div className="h-6 min-w-0 flex-1 animate-pulse rounded bg-gray-200 sm:h-8" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-full bg-gray-200 sm:h-12 xl:w-40 xl:shrink-0" />
        </div>

        <div className="flex flex-col items-start gap-5 self-stretch xl:flex-row">
          <div className="flex w-full flex-col items-start gap-5 self-stretch xl:w-[35%]">
            <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-4 sm:p-6">
              <div className="flex flex-col items-center justify-center gap-4 self-stretch">
                <div className="flex items-center justify-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2.5 rounded-full bg-white/80 p-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 sm:h-6 sm:w-6" />
                  </div>
                  <div className="h-5 w-36 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-48" />
                </div>
                <div className="h-6 w-28 animate-pulse rounded-full bg-gray-200 sm:h-7 sm:w-32" />
              </div>

              <div className="mb-6 flex justify-center">
                <div className="relative flex h-[120px] w-[120px] items-center justify-center sm:h-[150px] sm:w-[150px]">
                  <div className="h-[120px] w-[120px] animate-pulse rounded-full bg-gray-200 sm:h-[150px] sm:w-[150px]" />
                  <div className="absolute h-10 w-10 animate-pulse rounded-full bg-gray-300 sm:h-12 sm:w-12" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-5 self-stretch">
                <div className="h-5 w-40 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-48" />
              </div>

              <div className="flex w-full flex-col items-start gap-3">
                <div className="h-10 w-full animate-pulse rounded-full bg-gray-200" />
                <div className="h-10 w-full animate-pulse rounded-full bg-gray-200" />
              </div>
            </div>

            {/* Total payments — gradient strip like loaded */}
            <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
              <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-gray-200 sm:h-[18px] sm:w-[18px]" />
                  <div className="h-3 w-28 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-32" />
                </div>
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-32" />
              </div>
              <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 px-6">
                <div className="h-5 w-24 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-28" />
                <div className="h-4 w-8 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-10" />
              </div>
              <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r opacity-60" />
            </div>

            {/* Verified */}
            <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
              <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-gray-200 sm:h-[18px] sm:w-[18px]" />
                  <div className="h-3 w-24 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-28" />
                </div>
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-32" />
              </div>
              <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 px-6">
                <div className="h-5 w-24 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-28" />
                <div className="h-4 w-8 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-10" />
              </div>
            </div>

            {/* Pending */}
            <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
              <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-gray-200 sm:h-[18px] sm:w-[18px]" />
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                </div>
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-32" />
              </div>
              <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 px-6">
                <div className="h-5 w-24 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-28" />
                <div className="h-4 w-8 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-10" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[740px] w-full min-w-0 flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-4 sm:p-6">
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="h-4 w-48 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-56" />

              <div className="flex flex-col items-start self-stretch">
                <div className="flex flex-col items-start gap-3 self-stretch rounded-t-xl border border-b-0 border-[#EBECE8] bg-white p-3 sm:flex-row sm:gap-5 sm:p-4">
                  <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 self-stretch sm:w-auto">
                    <div className="h-3 w-12 animate-pulse rounded bg-gray-200" />
                    <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                  </div>
                  <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 self-stretch sm:w-auto">
                    <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                    <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                  </div>
                  <div className="flex flex-col items-start justify-center gap-1 self-stretch sm:min-w-0 sm:flex-1">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="flex items-center gap-3 self-stretch">
                      <div className="h-[45px] min-w-0 flex-1 animate-pulse rounded-md bg-gray-200" />
                      <div className="h-3 w-2 shrink-0 animate-pulse rounded bg-gray-200" />
                      <div className="h-[45px] min-w-0 flex-1 animate-pulse rounded-md bg-gray-200" />
                    </div>
                  </div>
                </div>

                <div className="data-table-scroll w-full overflow-x-auto overflow-y-hidden rounded-xl rounded-t-none border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <PaymentHistoryTableHeadSkeletonRow />
                    </thead>
                    <tbody>
                      <PaymentHistoryTableBodySkeletonRows />
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex w-full justify-end">
                <div className="flex w-full flex-wrap items-center justify-between gap-2 py-4 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <div className="hidden h-3 w-28 animate-pulse rounded bg-gray-200 md:block" />
                    <div className="h-8 w-12 animate-pulse rounded-md bg-gray-200 sm:h-9 sm:w-14" />
                  </div>
                  <div className="flex max-w-full items-center gap-1 overflow-hidden sm:gap-2">
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-10 sm:w-10" />
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-10 sm:w-10" />
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-10 sm:w-10" />
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-10 sm:w-10" />
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-200 sm:h-10 sm:w-10" />
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="hidden h-3 w-10 animate-pulse rounded bg-gray-200 md:block" />
                    <div className="h-3 w-5 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-4 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-5 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
      {/* Header */}
      <div className="flex flex-col gap-3 self-stretch xl:h-12 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-2 sm:gap-4 sm:self-stretch">
          <Button
            variant="white-secondary"
            leftIcon={<Icons.ArrowLeft02 size={18} className="sm:size-5" />}
            onClick={() => navigate(`/dashboard/clients/${id}/debt-summary`)}
            className="h-10 rounded-full sm:h-12"
          >
            <span className="hidden sm:inline">
              {t('pages.clients.paymentHistory.backToClient')}
            </span>
            <span className="sm:hidden">Back</span>
          </Button>
          <span className="text-dark-500 text-center text-lg leading-tight font-light tracking-[-0.48px] sm:text-2xl">
            {t('pages.clients.paymentHistory.title')}:{' '}
            <span className="font-medium">{paymentHistory.customerName}</span>
          </span>
        </div>
        <PermissionGuard permission={PERMISSIONS.DATA.EXPORT}>
          <Button
            variant="primary"
            leftIcon={<Icons.Csv02 size={18} className="sm:size-5" />}
            onClick={() => setIsExportModalOpen(true)}
            className="h-10 w-full rounded-full sm:h-12 sm:w-auto"
          >
            {t('pages.clients.paymentHistory.exportCSV')}
          </Button>
        </PermissionGuard>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-start gap-5 self-stretch xl:flex-row">
        {/* Left Column - Client Summary */}
        <div className="flex w-full flex-col items-start gap-5 xl:w-[35%]">
          {/* Client Information Card */}
          <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-4 sm:p-6">
            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                  <Icons.User size={20} className="text-dark-500 sm:size-[24px]" />
                </div>
                <span className="text-dark-500 text-base leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
                  {paymentHistory.customerName}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1">
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full',
                      paymentHistory.status === 'Active' ||
                        paymentHistory.status === 'Paid' ||
                        paymentHistory.status === 'Partially Paid' ||
                        paymentHistory.status === 'Dispute' ||
                        paymentHistory.status === 'Legal'
                        ? 'bg-success-200'
                        : 'bg-error-200'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        paymentHistory.status === 'Active' ||
                          paymentHistory.status === 'Paid' ||
                          paymentHistory.status === 'Partially Paid' ||
                          paymentHistory.status === 'Dispute' ||
                          paymentHistory.status === 'Legal'
                          ? 'bg-success-500'
                          : 'bg-error-500'
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'text-sm leading-[150%] font-medium tracking-[-0.28px]',
                      paymentHistory.status === 'Active' ||
                        paymentHistory.status === 'Paid' ||
                        paymentHistory.status === 'Partially Paid' ||
                        paymentHistory.status === 'Dispute' ||
                        paymentHistory.status === 'Legal'
                        ? 'text-success-500'
                        : 'text-error-500'
                    )}
                  >
                    {paymentHistory.status}
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
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#FFF"
                    strokeWidth="10"
                    className="transition-all duration-300"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#A0F229"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={
                      2 * Math.PI * 45 * (1 - paymentHistory.progressPercentage / 100)
                    }
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-in-out"
                  />
                </svg>
                <span className="text-secondary-800 absolute text-[28px] leading-[126%] font-medium tracking-[-0.72px] sm:text-[36px]">
                  {Math.round(paymentHistory.progressPercentage)}%
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-5 self-stretch">
              <span className="text-dark-500 text-center text-base leading-[132%] font-light tracking-[-0.4px] sm:text-xl">
                {t('pages.clients.paymentHistory.totalPaid')}{' '}
                <span className="font-medium">{formatCurrency(paymentHistory.totalPaid)}</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex w-full flex-col items-start gap-3 sm:flex-row">
              <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
                <Button
                  variant="primary"
                  leftIcon={<Icons.Headset size={18} className="sm:size-5" />}
                  className="w-full rounded-full"
                  disabled={!user?.is_agent || !user?.asterisk_extension}
                  onClick={() => {
                    const phoneNumber = client?.phones?.[0]?.number
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
                  {t('pages.clients.paymentHistory.call')}
                </Button>
              </PermissionGuard>
              <Button
                variant="secondary"
                leftIcon={<Icons.PencilEdit02 size={18} className="sm:size-5" />}
                className="w-full rounded-full"
                onClick={() => {
                  // Navigate to client detail page for editing
                  if (id) {
                    navigate(`/dashboard/clients/${id}`)
                  }
                }}
              >
                {t('pages.clients.paymentHistory.edit')}
              </Button>
            </div>
          </div>

          {/* Total Payments */}
          <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
            <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
              <div className="flex items-center gap-2">
                <Icons.Wallet01 size={16} className="text-gray-700 sm:size-[18px]" />
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.paymentHistory.totalPayments')}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.paymentHistory.numberOfPayments')}
                </span>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 px-6">
              <span className="text-dark-500 text-center text-base leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
                {formatCurrency(paymentHistory.totalPaymentsAmount)}
              </span>
              <span className="text-dark-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                {paymentHistory.totalPayments}
              </span>
            </div>
            <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
          </div>

          {/* Verified Payments */}
          <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
            <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
              <div className="flex items-center gap-2">
                <Icons.AddInvoice size={16} className="text-gray-700 sm:size-[18px]" />
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.paymentHistory.verified')}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.paymentHistory.numberOfPayments')}
                </span>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 px-6">
              <span className="text-dark-500 text-center text-base leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
                {formatCurrency(paymentHistory.verifiedPaymentsAmount)}
              </span>
              <span className="text-dark-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                {paymentHistory.verifiedPayments}
              </span>
            </div>
          </div>

          {/* Pending Payments */}
          <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5">
            <div className="flex flex-row items-start justify-between gap-2 self-stretch px-4 px-6">
              <div className="flex items-center gap-2">
                <Icons.Invoice01 size={16} className="text-gray-700 sm:size-[18px]" />
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.paymentHistory.pending')}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-700 sm:text-sm">
                  {t('pages.clients.paymentHistory.numberOfPayments')}
                </span>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch px-4 px-6">
              <span className="text-dark-500 text-center text-base leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
                {formatCurrency(paymentHistory.pendingPaymentsAmount)}
              </span>
              <span className="text-dark-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                {paymentHistory.pendingPayments}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column - Payment History Table */}
        <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-4 sm:p-6">
          <div className="flex flex-col items-start gap-3 self-stretch">
            <span className="text-dark-500 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
              {t('pages.clients.paymentHistory.title')}
              {paymentHistorySubtitle && (
                <>
                  {' '}
                  <span className="font-light">({paymentHistorySubtitle})</span>
                </>
              )}
            </span>
            <div className="flex flex-col items-start self-stretch">
              {/* Filters */}
              <div className="flex flex-col items-start gap-3 self-stretch rounded-t-xl border border-b-0 border-[#EBECE8] bg-white p-3 sm:flex-row sm:gap-5 sm:p-4">
                <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 self-stretch">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.clients.paymentHistory.filters.status')}
                  </span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-[45px] w-full rounded-md border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">
                        {t('pages.clients.paymentHistory.filters.all')}
                      </SelectItem>
                      <SelectItem value="verified">
                        {t('pages.clients.paymentHistory.verified')}
                      </SelectItem>
                      <SelectItem value="pending">
                        {t('pages.clients.paymentHistory.pending')}
                      </SelectItem>
                      <SelectItem value="cancelled">
                        {t('pages.clients.detail.paymentStatuses.cancelled', {
                          defaultValue: 'cancelled',
                        })}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 self-stretch">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.clients.paymentHistory.filters.method')}
                  </span>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="h-[45px] rounded-md border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">
                        {t('pages.clients.paymentHistory.filters.all')}
                      </SelectItem>
                      <SelectItem value="bank_transfer">
                        {t('pages.clients.detail.paymentMethods.bank_transfer', {
                          defaultValue: 'Bank Transfer',
                        })}
                      </SelectItem>
                      <SelectItem value="online_gateway">
                        {t('pages.clients.detail.paymentMethods.online_gateway', {
                          defaultValue: 'Online Gateway',
                        })}
                      </SelectItem>
                      <SelectItem value="card" disabled>
                        {t('pages.clients.detail.paymentMethods.card', { defaultValue: 'Card' })}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col items-start justify-center gap-1 self-stretch">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.clients.paymentHistory.filters.dateRange')}
                  </span>
                  <div className="flex items-center gap-3 self-stretch">
                    <DateSelect
                      value={startDate}
                      onChange={({ value }) => setStartDate(value)}
                      placeholder={t('pages.clients.paymentHistory.filters.startDate')}
                      className="flex-1"
                    />
                    <span className="text-dark-500 text-xs sm:text-base">-</span>
                    <DateSelect
                      value={endDate}
                      onChange={({ value }) => setEndDate(value)}
                      placeholder={t('pages.clients.paymentHistory.filters.endDate')}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Table */}
              <div
                className={cn(
                  'data-table-scroll w-full overflow-x-auto overflow-y-hidden rounded-xl rounded-t-none border border-[#EBECE8] bg-[#EBECE8] shadow-sm',
                  showPaymentTableBodySkeleton && 'relative min-h-[490px]'
                )}
              >
                <table className="min-w-full border-collapse">
                  <thead>
                    {showPaymentTableBodySkeleton ? (
                      <PaymentHistoryTableHeadSkeletonRow />
                    ) : (
                      <tr className="bg-white">
                        <th
                          className="text-dark-500 h-[49px] cursor-pointer border-r border-[#EBECE8] px-3 text-left text-xs font-medium transition-colors select-none hover:bg-gray-50 sm:px-6"
                          onClick={() => handleSort('date')}
                        >
                          <span className="inline-flex items-center gap-1">
                            {t('pages.clients.paymentHistory.tableHeaders.date')}
                            {getSortIcon('date')}
                          </span>
                        </th>
                        <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                          {t('pages.clients.paymentHistory.tableHeaders.paymentConfirmationDate')}
                        </th>
                        <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                          {t('pages.clients.paymentHistory.tableHeaders.cancelledDate')}
                        </th>
                        <th
                          className="text-dark-500 h-[49px] cursor-pointer border-r border-[#EBECE8] px-3 text-right text-xs font-medium transition-colors select-none hover:bg-gray-50 sm:px-6"
                          onClick={() => handleSort('amount')}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            {t('pages.clients.paymentHistory.tableHeaders.amount')}
                            {getSortIcon('amount')}
                          </span>
                        </th>
                        <th
                          className="text-dark-500 h-[49px] cursor-pointer border-r border-[#EBECE8] px-3 text-left text-xs font-medium transition-colors select-none hover:bg-gray-50 sm:px-6"
                          onClick={() => handleSort('method')}
                        >
                          <span className="inline-flex items-center gap-1">
                            {t('pages.clients.paymentHistory.tableHeaders.method')}
                            {getSortIcon('method')}
                          </span>
                        </th>
                        <th
                          className="text-dark-500 h-[49px] cursor-pointer border-r border-[#EBECE8] px-3 text-left text-xs font-medium transition-colors select-none hover:bg-gray-50 sm:px-6"
                          onClick={() => handleSort('reference')}
                        >
                          <span className="inline-flex items-center gap-1">
                            {t('pages.clients.paymentHistory.tableHeaders.reference')}
                            {getSortIcon('reference')}
                          </span>
                        </th>
                        <th
                          className="text-dark-500 h-[49px] cursor-pointer border-r border-[#EBECE8] px-3 text-left text-xs font-medium transition-colors select-none hover:bg-gray-50 sm:px-6"
                          onClick={() => handleSort('contract')}
                        >
                          <span className="inline-flex items-center gap-1">
                            {t('pages.clients.paymentHistory.tableHeaders.contractNumber')}
                            {getSortIcon('contract')}
                          </span>
                        </th>
                        <th
                          className="text-dark-500 h-[49px] cursor-pointer border-r border-[#EBECE8] px-3 text-left text-xs font-medium transition-colors select-none hover:bg-gray-50 sm:px-6"
                          onClick={() => handleSort('status')}
                        >
                          <span className="inline-flex items-center gap-1">
                            {t('pages.clients.paymentHistory.tableHeaders.status')}
                            {getSortIcon('status')}
                          </span>
                        </th>
                        <th className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
                          {t('pages.clients.paymentHistory.tableHeaders.actions')}
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {showPaymentTableBodySkeleton ? (
                      <PaymentHistoryTableBodySkeletonRows />
                    ) : paginatedPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium"
                        >
                          {t('pages.clients.paymentHistory.noPaymentHistory')}
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((payment, index) => {
                        // Always get backend payment to use the same date source as the modal
                        const backendPayment = paymentHistoryData?.payments.find(
                          (p) => p.id === payment.id || p.payment_number === payment.reference
                        )

                        // "Payment Added Date" — always recorded_at (CHANGE 11.1)
                        const paymentAddedDate = backendPayment?.recorded_at ?? null

                        return (
                          <tr
                            key={payment.id}
                            className={`transition-colors ${
                              index % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'
                            }`}
                          >
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {paymentAddedDate
                                ? convertUTCToUserTimezone(paymentAddedDate, userTimezone)
                                : '—'}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {formatIsoDate(backendPayment?.payment_confirmation_date)}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {backendPayment?.status === 'cancelled' && backendPayment?.reversed_at
                                ? convertUTCToUserTimezone(backendPayment.reversed_at, userTimezone)
                                : '—'}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-right text-xs font-medium sm:px-6">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {t(`pages.clients.detail.paymentMethods.${payment.method}`, {
                                defaultValue: payment.method,
                              })}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {payment.reference || '-'}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              {payment.contractNumber || '-'}
                            </td>
                            <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                              <div className="flex items-center gap-2">
                                {getStatusDot(payment.status)}
                                <span
                                  className={cn(
                                    payment.status === 'verified'
                                      ? 'text-success-500'
                                      : payment.status === 'pending'
                                        ? 'text-gray-500'
                                        : 'text-error-500'
                                  )}
                                >
                                  {t(`pages.clients.detail.paymentStatuses.${payment.status}`, {
                                    defaultValue: payment.status,
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
                              <div className="flex items-center justify-center gap-2 sm:gap-4">
                                {/* Desktop: Individual buttons */}
                                <div className="hidden items-center gap-4 lg:flex">
                                  {payment.status === 'verified' && (
                                    <LinkButton
                                      variant="regular-black"
                                      size="xs"
                                      leftIcon={
                                        <Icons.FileDownload
                                          size={16}
                                          color="#05040D"
                                          strokeWidth={1.5}
                                        />
                                      }
                                      onClick={() => {
                                        const backendPayment = paymentHistoryData?.payments.find(
                                          (p) => p.id === payment.id
                                        )
                                        if (backendPayment) {
                                          generateReceiptMutation({
                                            paymentId: backendPayment.id,
                                            payment: backendPayment,
                                            clientId: clientId,
                                            format: 'pdf',
                                          })
                                        } else {
                                          toast.error('Payment not found')
                                        }
                                      }}
                                    >
                                      {t('pages.clients.paymentHistory.actions.pdf')}
                                    </LinkButton>
                                  )}
                                  {payment.status === 'pending' &&
                                    checkPaymentLessThan7DaysOld(payment.date) && (
                                      <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT_DEBT}>
                                        <LinkButton
                                          variant="regular-black"
                                          size="xs"
                                          leftIcon={
                                            <Icons.Success
                                              size={16}
                                              color="#05040D"
                                              strokeWidth={1.5}
                                            />
                                          }
                                          onClick={() => {
                                            setSelectedPaymentId(payment.id)
                                            setIsVerificationModalOpen(true)
                                          }}
                                        >
                                          {t('pages.clients.paymentHistory.actions.verify')}
                                        </LinkButton>
                                      </PermissionGuard>
                                    )}
                                  <LinkButton
                                    variant="regular-black"
                                    size="xs"
                                    leftIcon={
                                      <Icons.View size={16} color="#05040D" strokeWidth={1.5} />
                                    }
                                    onClick={() => handleViewDetails(payment)}
                                  >
                                    {t('pages.clients.paymentHistory.actions.view')}
                                  </LinkButton>
                                </div>

                                {/* Mobile/Tablet: Dropdown button group */}
                                <div className="lg:hidden">
                                  <DropdownMenu
                                    modal={false}
                                    open={openDropdownPaymentId === payment.id}
                                    onOpenChange={(open) =>
                                      setOpenDropdownPaymentId(open ? payment.id : null)
                                    }
                                  >
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                                        aria-label={t(
                                          'pages.clients.paymentHistory.tableHeaders.actions'
                                        )}
                                      >
                                        <Icons.FilterVertical size={16} strokeWidth={1.5} />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white">
                                      {payment.status === 'verified' && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            const backendPayment =
                                              paymentHistoryData?.payments.find(
                                                (p) => p.id === payment.id
                                              )
                                            if (backendPayment) {
                                              generateReceiptMutation({
                                                paymentId: backendPayment.id,
                                                payment: backendPayment,
                                                clientId: clientId,
                                                format: 'pdf',
                                              })
                                            } else {
                                              toast.error('Payment not found')
                                            }
                                            setOpenDropdownPaymentId(null)
                                          }}
                                          className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                                        >
                                          <Icons.FileDownload size={16} strokeWidth={1.5} />
                                          <span>
                                            {t('pages.clients.paymentHistory.actions.pdf')}
                                          </span>
                                        </DropdownMenuItem>
                                      )}
                                      {payment.status === 'pending' &&
                                        checkPaymentLessThan7DaysOld(payment.date) && (
                                          <PermissionGuard
                                            permission={PERMISSIONS.CLIENTS.EDIT_DEBT}
                                          >
                                            <DropdownMenuItem
                                              onClick={() => {
                                                setSelectedPaymentId(payment.id)
                                                setIsVerificationModalOpen(true)
                                                setOpenDropdownPaymentId(null)
                                              }}
                                              className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                                            >
                                              <Icons.Success size={16} strokeWidth={1.5} />
                                              <span>
                                                {t('pages.clients.paymentHistory.actions.verify')}
                                              </span>
                                            </DropdownMenuItem>
                                          </PermissionGuard>
                                        )}
                                      <DropdownMenuItem
                                        onClick={() => {
                                          handleViewDetails(payment)
                                          setOpenDropdownPaymentId(null)
                                        }}
                                        className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                                      >
                                        <Icons.View size={16} strokeWidth={1.5} />
                                        <span>
                                          {t('pages.clients.paymentHistory.actions.view')}
                                        </span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
              <div
                className={cn(
                  'flex w-full justify-end',
                  showPaymentTableBodySkeleton && 'pointer-events-none opacity-50'
                )}
              >
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize)
                    setCurrentPage(1)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Verification Queue Modal */}
      <PaymentVerificationQueueModal
        open={isVerificationModalOpen}
        onClose={() => {
          setIsVerificationModalOpen(false)
          setSelectedPaymentId(null)
        }}
        pendingPayments={pendingPaymentsForVerification}
        processedPayments={[]}
        onVerify={handleVerifyPayment}
        onCancel={handleCancelPaymentFromQueue}
        onRefresh={() => {
          refetchPayments()
        }}
        initialExpandedPaymentId={selectedPaymentId?.toString() || null}
      />

      {/* Export CSV Modal */}
      <ExportPaymentsCSVModal
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        totalPayments={paymentHistory?.totalPayments || 0}
        totalAmount={paymentHistory?.totalPaymentsAmount || 0}
        {...({
          verifiedPayments: paymentHistory?.verifiedPayments || 0,
          verifiedAmount: paymentHistory?.verifiedPaymentsAmount || 0,
          pendingPayments: paymentHistory?.pendingPayments || 0,
          pendingAmount: paymentHistory?.pendingPaymentsAmount || 0,
        } as Partial<ExportPaymentsCSVModalProps>)}
      />

      {/* Payment Details Modal */}
      {selectedPayment && paymentHistory && (
        <PaymentDetailsModal
          open={isPaymentDetailsModalOpen}
          onClose={() => {
            setIsPaymentDetailsModalOpen(false)
            setSelectedPayment(null)
          }}
          payment={{
            paymentId: paymentDetails?.payment_number || `PMT-${selectedPayment.id}`,
            status: (() => {
              const rawStatus = paymentDetails ? paymentDetails.status : selectedPayment.status
              return (
                rawStatus === 'verified'
                  ? 'Verified'
                  : rawStatus === 'pending'
                    ? 'Pending'
                    : 'Cancelled'
              ) as 'Verified' | 'Pending' | 'Cancelled'
            })(),
            amount: paymentDetails ? Number(paymentDetails.amount) : selectedPayment.amount,
            // Use verified_at for verified payments, recorded_at for others
            paymentDate: paymentDetails
              ? paymentDetails.status === 'verified' && paymentDetails.verified_at
                ? paymentDetails.verified_at
                : (paymentDetails.recorded_at ?? paymentDetails.payment_date)
              : selectedPayment.date,
            method: (() => {
              const rawMethod = paymentDetails
                ? paymentDetails.payment_method
                : selectedPayment.method
              const methodMap: Record<BackendPaymentMethod, string> = {
                bank_transfer: 'Bank Transfer',
                online_gateway: 'Online Gateway',
                cash: 'Cash',
                card: 'Card',
                other: 'Other',
              }
              return methodMap[rawMethod] || rawMethod
            })(),
            reference:
              paymentDetails?.bank_reference ||
              paymentDetails?.payment_number ||
              selectedPayment.reference ||
              `TRX${selectedPayment.id.toString().padStart(5, '0')}`,
            clientId: id || '',
            clientName: paymentHistory.customerName,
            phone: apiClient?.phone_primary || '+380 50 123 4567',
            project: resolveProjectName(selectedPayment?.id),
            // Debt Impact: use backend snapshot when available
            currentDebt: backendPayment
              ? Number(backendPayment.debt_before)
              : paymentHistory.totalDebt,
            newDebt: backendPayment
              ? Number(backendPayment.debt_after)
              : Math.max(0, paymentHistory.totalDebt - selectedPayment.amount),
            // Audit trail from backend, fallback to 'Unknown'
            // Format dates consistently with payment date (MM/DD/YYYY)
            createdBy: paymentDetails?.recorded_by_username || 'Unknown',
            createdAt: paymentDetails?.recorded_at || 'Unknown',
            verifiedBy: paymentDetails?.verified_by_username,
            verifiedAt: paymentDetails?.verified_at || undefined,
            cancelledBy:
              cancelledByUser?.username ||
              (paymentDetails?.reversed_by_user_id ? 'Unknown' : undefined),
            cancelledAt: paymentDetails?.reversed_at || undefined,
            cancellationReason: paymentDetails?.reversal_reason,
          }}
          onCancelPayment={handleCancelPayment}
          onEditPayment={handleEditPayment}
          onViewClientProfile={handleViewClientProfile}
          onPrintReceipt={() => {
            if (!backendPayment) {
              toast.error('Payment not found')
              return
            }
            // Prepare client data if available
            generateReceiptMutation({
              paymentId: backendPayment.id,
              payment: backendPayment,
              clientId: clientId,
              format: 'pdf',
            })
          }}
          onDownloadReceipt={() => {
            if (!backendPayment) {
              toast.error('Payment not found')
              return
            }
            // Prepare client data if available
            generateReceiptMutation({
              paymentId: backendPayment.id,
              payment: backendPayment,
              clientId: clientId,
              format: 'pdf',
            })
          }}
          onReassignEmployee={
            canReassignEmployee && backendPayment?.status === 'verified'
              ? () => setIsReassignModalOpen(true)
              : undefined
          }
        />
      )}

      {/* Reassign Employee Modal */}
      {selectedPayment && backendPayment && (
        <ReassignPaymentEmployeeModal
          open={isReassignModalOpen}
          onClose={() => setIsReassignModalOpen(false)}
          currentEmployeeName={paymentDetails?.recorded_by_username || 'Unknown'}
          currentUserId={paymentDetails?.recorded_by_user_id ?? null}
          isSubmitting={isReassigning}
          onConfirm={(newUserId) => {
            reassignEmployeeMutation(
              { paymentId: backendPayment.id, request: { recorded_by_user_id: newUserId } },
              { onSuccess: () => setIsReassignModalOpen(false) }
            )
          }}
        />
      )}

      {/* Cancel Payment Modal */}
      <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT_DEBT}>
        {selectedPayment && paymentHistory && isCancelModalOpen && (
          <CancelPaymentModal
            open={isCancelModalOpen}
            onClose={() => {
              setIsCancelModalOpen(false)
              setSelectedPayment(null)
            }}
            payment={{
              paymentId: `PMT-${selectedPayment.id}`,
              client: paymentHistory.customerName,
              amount: selectedPayment.amount,
              paymentDate: selectedPayment.date,
              method: selectedPayment.method,
              reference: `TRX${selectedPayment.id.toString().padStart(5, '0')}`,
              status: (selectedPayment.status === 'verified'
                ? 'Verified'
                : selectedPayment.status === 'pending'
                  ? 'Pending'
                  : 'Cancelled') as 'Verified' | 'Pending' | 'Cancelled',
              createdBy: 'Operator Sidorov',
              createdAt: '2025-12-10 09:15:32',
              currentDebt: paymentHistory.totalDebt,
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
                  paymentId: backendPayment.payment_number || backendPayment.id.toString(),
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

      {/* Edit Payment Modal */}
      <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT_DEBT}>
        {selectedPayment && paymentHistory && (
          <EditPaymentModal
            open={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedPayment(null)
            }}
            payment={{
              paymentId: `PMT-${selectedPayment.id}`,
              amount: selectedPayment.amount,
              paymentDate: selectedPayment.date,
              method: (() => {
                // Normalize payment method to match EditPaymentModal expected types
                const method = selectedPayment.method
                if (method === 'card') return 'Card'
                if (method === 'bank_transfer') return 'Bank Transfer'
                if (method === 'online_gateway') return 'Online Gateway'
                if (method === 'cash') return 'Cash'
                return 'Other'
              })(),
              reference:
                selectedPayment.reference || `TRX${selectedPayment.id.toString().padStart(5, '0')}`,
              createdBy: 'Operator Sidorov',
              createdAt: '2025-12-10 09:15:32',
              currentDebt: paymentHistory.totalDebt,
              referenceNumber: selectedPayment.reference || undefined,
              last4Digits: selectedPayment.reference?.match(/^\d{4}$/)
                ? selectedPayment.reference
                : undefined,
              paymentMethodDetails: undefined,
            }}
            onSave={handleSaveEditPayment}
          />
        )}
      </PermissionGuard>

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
    </div>
  )
}
