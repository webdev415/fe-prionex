/**
 * Payment History Page
 *
 * Displays full payment history for a client with filtering and pagination.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useURLState, useAutoPersistedState } from '@/hooks'
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
import { ExportPaymentsCSVModal } from './components/ExportPaymentsCSVModal'
import { PaymentDetailsModal } from './components/PaymentDetailsModal'
import { CancelPaymentModal } from './components/CancelPaymentModal'
import { EditPaymentModal } from './components/EditPaymentModal'
import { useClient } from '@/features/clients/hooks/useClients'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { useCallStore } from '@/stores/callStore'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOriginateCall } from '@/features/calls/hooks/useCall'
import { useCallWebSocket } from '@/features/calls/hooks/useCallWebSocket'

// Types
interface Payment {
  id: number
  date: string
  amount: number
  method:
    | 'Bank Transfer'
    | 'Online Gateway'
    | 'Cash'
    | 'Card'
    | 'Other'
    | 'Online'
    | 'Bank'
    | 'Direct Debit' // Support both old and new values
  status: 'Verified' | 'Pending' | 'Cancelled'
  receipt?: string
  reference?: string
}

interface PaymentHistoryData {
  customerName: string
  status: 'Active' | 'Paid' | 'Partially Paid' | 'Dispute' | 'Written off' | 'Sold' | 'Legal'
  progressPercentage: number
  totalPaid: number
  totalDebt: number
  totalPayments: number
  totalPaymentsAmount: number
  verifiedPayments: number
  verifiedPaymentsAmount: number
  pendingPayments: number
  pendingPaymentsAmount: number
  payments: Payment[]
}

// Mock client data for fallback
const mockClientDetail = {
  fullName: 'Savchenko Ivan Petrovich',
}

// Helper function to normalize payment method values (for backward compatibility)
const normalizePaymentMethod = (
  method: Payment['method']
): 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other' => {
  // Map old values to new values
  if (method === 'Bank' || method === 'Bank Transfer') return 'Bank Transfer'
  if (method === 'Card') return 'Card'
  if (method === 'Online' || method === 'Online Gateway') return 'Online Gateway'
  if (method === 'Cash') return 'Cash'
  if (method === 'Direct Debit' || method === 'Other') return 'Other'
  return 'Other' // Default fallback
}

// Helper function to format date as MM/DD/YYYY
const formatDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

// Mock payment history data - replace with actual API call
const getMockPaymentHistory = (): Omit<PaymentHistoryData, 'customerName'> => {
  const today = new Date()

  // Generate dates for testing:
  // - Some payments within last 7 days (for Verify button testing)
  // - Some payments older than 7 days
  const dates = {
    today: formatDate(today),
    yesterday: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)),
    twoDaysAgo: formatDate(new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)),
    threeDaysAgo: formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)),
    fourDaysAgo: formatDate(new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000)),
    fiveDaysAgo: formatDate(new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)),
    sixDaysAgo: formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)),
    sevenDaysAgo: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
    eightDaysAgo: formatDate(new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000)),
    tenDaysAgo: formatDate(new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)),
    twoWeeksAgo: formatDate(new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)),
    threeWeeksAgo: formatDate(new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000)),
    oneMonthAgo: formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
  }

  return {
    status: 'Active',
    progressPercentage: 15,
    totalPaid: 15450.0,
    totalDebt: 125450.0,
    totalPayments: 23,
    totalPaymentsAmount: 125450.0,
    verifiedPayments: 13,
    verifiedPaymentsAmount: 11170.0,
    pendingPayments: 7,
    pendingPaymentsAmount: 14510.0,
    payments: [
      {
        id: 1,
        date: dates.today, // Today - Pending, should show Verify button
        amount: 10080,
        method: 'Other',
        status: 'Pending',
        reference: 'REF-001234',
      },
      {
        id: 2,
        date: dates.yesterday, // Yesterday - Verified
        amount: 900,
        method: 'Bank Transfer',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: 'TRX98765',
      },
      {
        id: 3,
        date: dates.twoDaysAgo, // 2 days ago - Pending, should show Verify button
        amount: 780,
        method: 'Other',
        status: 'Pending',
        reference: 'REF-001235',
      },
      {
        id: 4,
        date: dates.threeDaysAgo, // 3 days ago - Verified
        amount: 820,
        method: 'Bank Transfer',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: 'TRX98766',
      },
      {
        id: 5,
        date: dates.fourDaysAgo, // 4 days ago - Verified
        amount: 870,
        method: 'Other',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: 'REF-001236',
      },
      {
        id: 6,
        date: dates.fiveDaysAgo, // 5 days ago - Pending, should show Verify button
        amount: 810,
        method: 'Bank Transfer',
        status: 'Pending',
        reference: 'TRX98767',
      },
      {
        id: 7,
        date: dates.sixDaysAgo, // 6 days ago - Cancelled
        amount: 830,
        method: 'Bank Transfer',
        status: 'Cancelled',
        reference: 'TRX98768',
      },
      {
        id: 8,
        date: dates.sevenDaysAgo, // 7 days ago - Verified (exactly 7 days, should NOT show Verify)
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: '****1234',
      },
      {
        id: 9,
        date: dates.eightDaysAgo, // 8 days ago - Pending, should NOT show Verify button (too old)
        amount: 830,
        method: 'Bank Transfer',
        status: 'Pending',
        reference: 'TRX98769',
      },
      {
        id: 10,
        date: dates.tenDaysAgo, // 10 days ago - Verified
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: '****5678',
      },
      {
        id: 11,
        date: dates.twoWeeksAgo, // 14 days ago - Verified
        amount: 920,
        method: 'Other',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: 'REF-001237',
      },
      {
        id: 12,
        date: dates.threeDaysAgo, // 3 days ago - Pending, should show Verify button
        amount: 750,
        method: 'Bank Transfer',
        status: 'Pending',
        reference: 'TRX98770',
      },
      {
        id: 13,
        date: dates.twoWeeksAgo, // 14 days ago - Verified
        amount: 680,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: '****9012',
      },
      {
        id: 14,
        date: dates.oneMonthAgo, // 30 days ago - Verified
        amount: 950,
        method: 'Other',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: 'REF-001238',
      },
      {
        id: 15,
        date: dates.oneMonthAgo, // 30 days ago - Pending, should NOT show Verify button (too old)
        amount: 720,
        method: 'Bank Transfer',
        status: 'Pending',
        reference: 'TRX98771',
      },
      {
        id: 16,
        date: dates.threeWeeksAgo, // 21 days ago - Verified
        amount: 880,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: '****3456',
      },
      {
        id: 17,
        date: dates.tenDaysAgo, // 10 days ago - Cancelled
        amount: 640,
        method: 'Other',
        status: 'Cancelled',
        reference: 'REF-001239',
      },
      {
        id: 18,
        date: dates.twoWeeksAgo, // 14 days ago - Verified
        amount: 790,
        method: 'Bank Transfer',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: 'TRX98772',
      },
      {
        id: 19,
        date: dates.threeWeeksAgo, // 21 days ago - Verified
        amount: 910,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: '****7890',
      },
      {
        id: 20,
        date: dates.oneMonthAgo, // 30 days ago - Pending, should NOT show Verify button (too old)
        amount: 560,
        method: 'Other',
        status: 'Pending',
        reference: 'REF-001240',
      },
      {
        id: 21,
        date: dates.threeWeeksAgo, // 21 days ago - Verified
        amount: 1020,
        method: 'Bank Transfer',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: 'TRX98773',
      },
      {
        id: 22,
        date: dates.oneMonthAgo, // 30 days ago - Verified
        amount: 730,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
        reference: '****2345',
      },
      {
        id: 23,
        date: dates.fourDaysAgo, // 4 days ago - Pending, should show Verify button
        amount: 890,
        method: 'Other',
        status: 'Pending',
        reference: 'REF-001241',
      },
    ],
  }
}

export function PaymentHistoryPage() {
  const { t, i18n } = useTranslation('common')
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
    (value: Date | null) => setStartDateUrl(value ? value.toISOString().split('T')[0] : ''),
    [setStartDateUrl]
  )
  const setEndDate = useCallback(
    (value: Date | null) => setEndDateUrl(value ? value.toISOString().split('T')[0] : ''),
    [setEndDateUrl]
  )

  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryData | null>(null)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [openDropdownPaymentId, setOpenDropdownPaymentId] = useState<number | null>(null)
  const dateRangeInitialized = useRef(false)

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null)

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

  // Fetch client data from API (same as DebtSummaryPage)
  const clientId = id ? Number(id) : 0
  const {
    data: apiClient,
    isLoading: isLoadingClient,
    isError: isClientError,
    error: clientError,
  } = useClient(clientId, !!clientId)

  // Get client name and create client object for call functionality
  const client = useMemo(() => {
    if (!apiClient) return null

    const fullName = [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
      .filter(Boolean)
      .join(' ')

    return {
      id: apiClient.id,
      fullName: fullName || mockClientDetail.fullName,
      phones: [
        { number: apiClient.phone_primary, type: 'primary' as const },
        ...(apiClient.phone_secondary
          ? [{ number: apiClient.phone_secondary, type: 'secondary' as const }]
          : []),
      ],
    }
  }, [apiClient])

  // Get client name from API or fallback to mock
  const customerName = useMemo(() => {
    return client?.fullName || mockClientDetail.fullName
  }, [client])

  // Helper function to check if payment date is less than 7 days old
  const isPaymentLessThan7DaysOld = useCallback((paymentDate: string): boolean => {
    try {
      // Parse payment date in format MM/DD/YYYY
      const [month, day, year] = paymentDate.split('/')
      const paymentDateObj = new Date(Number(year), Number(month) - 1, Number(day))

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

  // Convert Payment to PendingPayment format
  const convertPaymentToPendingPayment = useCallback(
    (payment: Payment): import('./components/PaymentVerificationQueueModal').PendingPayment => {
      // Calculate time ago (simple implementation)
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

      // Calculate current debt and new debt
      // For now, use paymentHistory.totalDebt as current debt
      const currentDebt = paymentHistory?.totalDebt || 0
      const newDebt = Math.max(0, currentDebt - payment.amount)

      return {
        id: payment.id.toString(),
        paymentId: `PMT-${payment.id}`,
        submittedAt,
        client: customerName,
        project: 'PrivatBank Collection', // Default project, can be enhanced later
        amount: payment.amount,
        method: normalizePaymentMethod(payment.method),
        date: payment.date,
        reference: payment.reference || `TRX${payment.id.toString().padStart(5, '0')}`,
        currentDebt,
        newDebt,
      }
    },
    [customerName, paymentHistory]
  )

  // Filter pending payments that are less than 7 days old
  const pendingPaymentsForVerification = useMemo(() => {
    if (!paymentHistory) return []

    return paymentHistory.payments
      .filter((payment) => {
        return payment.status === 'Pending' && isPaymentLessThan7DaysOld(payment.date)
      })
      .map(convertPaymentToPendingPayment)
  }, [paymentHistory, isPaymentLessThan7DaysOld, convertPaymentToPendingPayment])

  const mockProcessedPayments = [
    {
      id: '1',
      paymentId: 'PMT-2025-12-000',
      status: 'Verified' as const,
      amount: 3500.0,
      action: 'Verified by You',
      time: '30 mins ago',
    },
    {
      id: '2',
      paymentId: 'PMT-2025-12-000',
      status: 'Verified' as const,
      amount: 6500.0,
      action: 'Verified by You',
      time: '2 hours ago',
    },
    {
      id: '3',
      paymentId: 'PMT-2025-12-000',
      status: 'Cancelled' as const,
      amount: 7500.0,
      action: 'Cancelled by You',
      time: '3 hours ago',
    },
  ]

  const handleVerifyPayment = (paymentId: string) => {
    // TODO: Implement API call to verify payment
    console.log('Verify payment', paymentId)
    // Close modal after verification
    setIsVerificationModalOpen(false)
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
    method: 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
    referenceNumber?: string
    last4Digits?: string
    paymentMethodDetails?: string
  }) => {
    // TODO: Implement API call to save edit payment
    console.log('Save edit payment', selectedPayment?.id, data)
    setIsEditModalOpen(false)
    setSelectedPayment(null)
    // Optionally refresh the payment history data
  }

  const handleExport = (data: {
    startDate: Date | null
    endDate: Date | null
    statuses: string[]
    method: string
    project: string
    columns: string[]
  }) => {
    // TODO: Implement CSV export
    console.log('Export CSV with data:', data)
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

  // Load payment history data
  useEffect(() => {
    if (customerName) {
      // TODO: Replace with actual API call to fetch payment history
      // For now, use mock data but with real customer name from client data
      const mockData = getMockPaymentHistory()
      const data: PaymentHistoryData = {
        ...mockData,
        customerName,
      }
      // Simulate API delay
      setTimeout(() => {
        setPaymentHistory(data)

        // Calculate and set date range to match payment history date range
        if (data.payments.length > 0 && !dateRangeInitialized.current) {
          // Parse all payment dates and find min/max
          const dates = data.payments.map((payment) => {
            const [month, day, year] = payment.date.split('/')
            return new Date(Number(year), Number(month) - 1, Number(day))
          })

          const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
          const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

          // Set dates only once when payment history first loads
          setStartDate(minDate)
          setEndDate(maxDate)
          dateRangeInitialized.current = true
        }
      }, 500)
    }
  }, [customerName, setStartDate, setEndDate])

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${amount
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
        <span className={cn('h-1.5 w-1.5 rounded-full', statusColors[status])} />
      </span>
    )
  }

  // Handle sort
  const handleSort = (key: string) => {
    const newOrder: 'asc' | 'desc' =
      sortConfig?.key === key && sortConfig.order === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key, order: newOrder })
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
        // Normalize payment method for comparison
        const normalizedPaymentMethod = normalizePaymentMethod(payment.method)
        const normalizedFilterMethod = normalizePaymentMethod(methodFilter as Payment['method'])
        if (normalizedPaymentMethod !== normalizedFilterMethod) return false
      }

      // Date range filtering
      if (startDate || endDate) {
        // Parse payment date in format MM/DD/YYYY
        const [month, day, year] = payment.date.split('/')
        const paymentDate = new Date(Number(year), Number(month) - 1, Number(day))

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
            // Parse dates in format MM/DD/YYYY
            const [aMonth, aDay, aYear] = a.date.split('/')
            const [bMonth, bDay, bYear] = b.date.split('/')
            aValue = new Date(Number(aYear), Number(aMonth) - 1, Number(aDay)).getTime()
            bValue = new Date(Number(bYear), Number(bMonth) - 1, Number(bDay)).getTime()
            break
          }
          case 'amount':
            aValue = a.amount
            bValue = b.amount
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

  // Calculate display range subtitle for title
  const getPaymentHistorySubtitle = () => {
    if (!paymentHistory || filteredPayments.length === 0) {
      return null
    }

    const total = filteredPayments.length
    const start = (currentPage - 1) * pageSize + 1
    const end = Math.min(currentPage * pageSize, total)

    // If showing first page with 10 items, show "Last 10"
    if (currentPage === 1 && pageSize === 10 && total >= 10) {
      return t('pages.clients.paymentHistory.subtitle.last10')
    }

    // Otherwise show the range
    if (start === end) {
      return t('pages.clients.paymentHistory.subtitle.single', { index: start, total })
    }
    return t('pages.clients.paymentHistory.subtitle.range', { start, end, total })
  }

  // Show loading state while fetching client or payment history
  if (isLoadingClient || !paymentHistory) {
    return (
      <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-3 self-stretch sm:h-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-4 sm:self-stretch">
            <div className="h-10 w-24 animate-pulse rounded-full bg-gray-200 sm:h-12 sm:w-32" />
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200 sm:h-8 sm:w-64" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-full bg-gray-200 sm:h-12 sm:w-32" />
        </div>

        {/* Main Content Skeleton */}
        <div className="flex flex-col items-start gap-5 self-stretch xl:flex-row">
          {/* Left Column Skeleton */}
          <div className="flex w-full flex-col items-start gap-5 self-stretch xl:w-[35%]">
            {/* Client Information Card Skeleton */}
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
              </div>

              {/* Action Buttons Skeleton */}
              <div className="flex w-full flex-col items-start gap-3 sm:flex-row">
                <div className="h-10 w-full flex-1 animate-pulse rounded-full bg-gray-200 sm:w-auto" />
                <div className="h-10 w-full flex-1 animate-pulse rounded-full bg-gray-200 sm:w-auto" />
              </div>
            </div>

            {/* Summary Cards Skeleton */}
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-4 pb-6 sm:pt-5"
              >
                <div className="flex flex-col items-start gap-2 self-stretch px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                  <div className="h-3 w-28 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-32" />
                </div>
                <div className="flex flex-col items-start gap-2 self-stretch px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="h-5 w-28 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-32" />
                  <div className="h-4 w-14 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-16" />
                </div>
              </div>
            ))}
          </div>

          {/* Right Column Skeleton - Payment History Table */}
          <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-4 sm:p-6">
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="h-4 w-40 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-48" />

              {/* Filters Skeleton */}
              <div className="flex flex-col items-start gap-3 self-stretch rounded-t-xl border border-b-0 border-[#EBECE8] bg-white p-3 sm:flex-row sm:gap-5 sm:p-4">
                <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 sm:w-auto">
                  <div className="h-3 w-12 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
                <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 sm:w-auto">
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
                <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 sm:w-auto">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
                <div className="flex w-full flex-1 flex-col items-start justify-center gap-1 sm:w-auto">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
              </div>

              {/* Table Skeleton */}
              <div className="w-full overflow-x-auto overflow-y-hidden rounded-xl rounded-t-none border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
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
                        <td className="h-[49px] px-3 text-center sm:px-6">
                          <div className="mx-auto h-5 w-20 animate-pulse rounded bg-gray-200 sm:h-6 sm:w-24" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Skeleton */}
              <div className="flex flex-col items-start gap-3 self-stretch sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-24" />
                  <div className="h-9 w-18 animate-pulse rounded bg-gray-200 sm:h-10 sm:w-20" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 animate-pulse rounded bg-gray-200 sm:h-10 sm:w-10" />
                  <div className="h-9 w-9 animate-pulse rounded bg-gray-200 sm:h-10 sm:w-10" />
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200 sm:h-4 sm:w-20" />
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
        <p className="font-medium text-gray-900">
          {t('pages.clients.debtSummary.failedToLoadClient')}
        </p>
        <p className="text-sm text-gray-600">
          {clientError?.message || t('pages.clients.debtSummary.errorOccurred')}
        </p>
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
        <Button
          variant="primary"
          leftIcon={<Icons.Csv02 size={18} className="sm:size-5" />}
          onClick={() => setIsExportModalOpen(true)}
          className="h-10 w-full rounded-full sm:h-12 sm:w-auto"
        >
          {t('pages.clients.paymentHistory.exportCSV')}
        </Button>
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
              <Button
                variant="primary"
                leftIcon={<Icons.Headset size={18} className="sm:size-5" />}
                className="w-full rounded-full"
                disabled={!user?.asterisk_extension}
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
              <Button
                variant="secondary"
                leftIcon={<Icons.PencilEdit02 size={18} className="sm:size-5" />}
                className="w-full rounded-full"
                onClick={() => {
                  // TODO: Handle edit
                  console.log('Edit customer')
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
              {t('pages.clients.paymentHistory.title')}{' '}
              {getPaymentHistorySubtitle() && (
                <span className="font-light">({getPaymentHistorySubtitle()})</span>
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
                      <SelectItem value="Verified">
                        {t('pages.clients.paymentHistory.verified')}
                      </SelectItem>
                      <SelectItem value="Pending">
                        {t('pages.clients.paymentHistory.pending')}
                      </SelectItem>
                      <SelectItem value="Cancelled">
                        {t('pages.clients.debtSummary.paymentStatus.cancelled')}
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
                      <SelectItem value="Bank Transfer">
                        {t('pages.clients.modals.recordPayment.bankTransfer')}
                      </SelectItem>
                      <SelectItem value="Online Gateway" disabled>
                        {t('pages.clients.modals.recordPayment.onlineGateway')}
                      </SelectItem>
                      <SelectItem value="Cash" disabled>
                        {t('pages.clients.modals.recordPayment.cash')}
                      </SelectItem>
                      <SelectItem value="Card">
                        {t('pages.clients.modals.recordPayment.card')}
                      </SelectItem>
                      <SelectItem value="Other">
                        {t('pages.clients.modals.recordPayment.other')}
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
              <div className="data-table-scroll w-full overflow-x-auto overflow-y-hidden rounded-xl rounded-t-none border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
                <table className="min-w-full border-collapse">
                  <thead>
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
                      <th
                        className="text-dark-500 h-[49px] cursor-pointer border-r border-[#EBECE8] px-3 text-right text-xs font-medium transition-colors select-none hover:bg-gray-50 sm:px-6"
                        onClick={() => handleSort('amount')}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          {t('pages.clients.paymentHistory.tableHeaders.amount')}
                          {getSortIcon('amount')}
                        </span>
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.paymentHistory.tableHeaders.method')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.paymentHistory.tableHeaders.reference')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-left text-xs font-medium sm:px-6">
                        {t('pages.clients.paymentHistory.tableHeaders.status')}
                      </th>
                      <th className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
                        {t('pages.clients.paymentHistory.tableHeaders.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium"
                        >
                          {t('pages.clients.paymentHistory.noPaymentHistory')}
                        </td>
                      </tr>
                    ) : (
                      paginatedPayments.map((payment, index) => (
                        <tr
                          key={payment.id}
                          className={`transition-colors ${
                            index % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'
                          }`}
                        >
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                            {payment.date}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-right text-xs font-medium sm:px-6">
                            {formatCurrency(payment.amount)}
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
                              return methodTranslations[normalizedMethod]
                            })()}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-3 text-xs font-medium sm:px-6">
                            {payment.reference || '-'}
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
                                {payment.status === 'Verified'
                                  ? t('pages.clients.debtSummary.paymentStatus.verified')
                                  : payment.status === 'Pending'
                                    ? t('pages.clients.debtSummary.paymentStatus.pending')
                                    : t('pages.clients.debtSummary.paymentStatus.cancelled')}
                              </span>
                            </div>
                          </td>
                          <td className="text-dark-500 h-[49px] px-3 text-center text-xs font-medium sm:px-6">
                            <div className="flex items-center justify-center gap-2 sm:gap-4">
                              {/* Desktop: Individual buttons */}
                              <div className="hidden items-center gap-4 lg:flex">
                                {payment.status === 'Verified' && (
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
                                      // TODO: Handle download PDF
                                      console.log('Download PDF', payment.id)
                                    }}
                                  >
                                    {t('pages.clients.paymentHistory.actions.pdf')}
                                  </LinkButton>
                                )}
                                {payment.status === 'Pending' &&
                                  isPaymentLessThan7DaysOld(payment.date) && (
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
                                    {payment.status === 'Verified' && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          // TODO: Handle download PDF
                                          console.log('Download PDF', payment.id)
                                          setOpenDropdownPaymentId(null)
                                        }}
                                        className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                                      >
                                        <Icons.FileDownload size={16} strokeWidth={1.5} />
                                        <span>{t('pages.clients.paymentHistory.actions.pdf')}</span>
                                      </DropdownMenuItem>
                                    )}
                                    {payment.status === 'Pending' &&
                                      isPaymentLessThan7DaysOld(payment.date) && (
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
                                      )}
                                    <DropdownMenuItem
                                      onClick={() => {
                                        handleViewDetails(payment)
                                        setOpenDropdownPaymentId(null)
                                      }}
                                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                                    >
                                      <Icons.View size={16} strokeWidth={1.5} />
                                      <span>{t('pages.clients.paymentHistory.actions.view')}</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
              <div className="flex w-full justify-end">
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
        processedPayments={mockProcessedPayments}
        onVerify={handleVerifyPayment}
        onCancel={handleCancelPaymentFromQueue}
        onRefresh={() => {
          // TODO: Refresh pending payments
          console.log('Refresh payments')
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
            paymentId: `PMT-${selectedPayment.id}`,
            status: selectedPayment.status,
            amount: selectedPayment.amount,
            paymentDate: selectedPayment.date,
            method: selectedPayment.method,
            reference:
              selectedPayment.reference || `TRX${selectedPayment.id.toString().padStart(5, '0')}`,
            clientId: id || '',
            clientName: paymentHistory.customerName,
            phone: '+380 50 123 4567',
            project: 'PrivatBank Collection',
            currentDebt: paymentHistory.totalDebt,
            newDebt: paymentHistory.totalDebt - selectedPayment.amount,
            createdBy: 'Operator Sidorov',
            createdAt: '2025-12-10 09:15:32',
            verifiedBy: selectedPayment.status === 'Verified' ? 'Supervisor Petrov' : undefined,
            verifiedAt: selectedPayment.status === 'Verified' ? '2025-12-10 14:30:18' : undefined,
            cancelledBy: selectedPayment.status === 'Cancelled' ? 'Supervisor Petrov' : undefined,
            cancelledAt: selectedPayment.status === 'Cancelled' ? '2025-12-10 16:45:22' : undefined,
            cancellationReason:
              selectedPayment.status === 'Cancelled'
                ? 'Incorrect payment amount entered. Client requested cancellation.'
                : undefined,
          }}
          onCancelPayment={handleCancelPayment}
          onEditPayment={handleEditPayment}
          onViewClientProfile={handleViewClientProfile}
          onPrintReceipt={() => {
            // TODO: Handle print receipt
            console.log('Print receipt', selectedPayment.id)
          }}
          onDownloadReceipt={() => {
            // TODO: Handle download receipt
            console.log('Download receipt', selectedPayment.id)
          }}
        />
      )}

      {/* Cancel Payment Modal */}
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
            status: selectedPayment.status as 'Verified' | 'Pending' | 'Cancelled',
            createdBy: 'Operator Sidorov',
            createdAt: '2025-12-10 09:15:32',
            currentDebt: paymentHistory.totalDebt,
          }}
          onConfirm={(data) => {
            // TODO: Handle cancel payment
            console.log('Cancel payment:', data)
            setIsCancelModalOpen(false)
            setSelectedPayment(null)
          }}
        />
      )}

      {/* Edit Payment Modal */}
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
              if (method === 'Card') return 'Card'
              if (method === 'Bank Transfer' || method === 'Bank') return 'Bank Transfer'
              if (method === 'Online Gateway' || method === 'Online') return 'Online Gateway'
              if (method === 'Cash') return 'Cash'
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
    </div>
  )
}
