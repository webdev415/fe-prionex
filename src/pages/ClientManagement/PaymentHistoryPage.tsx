/**
 * Payment History Page
 *
 * Displays full payment history for a client with filtering and pagination.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
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
import { cn } from '@/lib/utils'
import { PaymentVerificationQueueModal } from './components/PaymentVerificationQueueModal'
import { ExportPaymentsCSVModal } from './components/ExportPaymentsCSVModal'
import { PaymentDetailsModal } from './components/PaymentDetailsModal'
import { CancelPaymentModal } from './components/CancelPaymentModal'
import { useClient } from '@/features/clients/hooks/useClients'

// Types
interface Payment {
  id: number
  date: string
  amount: number
  method: 'Online' | 'Bank' | 'Card' | 'Direct Debit'
  status: 'Verified' | 'Pending' | 'Cancelled'
  receipt?: string
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

// Mock payment history data - replace with actual API call
const getMockPaymentHistory = (): Omit<PaymentHistoryData, 'customerName'> => {
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
        date: '10/7/2023',
        amount: 10080,
        method: 'Online',
        status: 'Pending',
      },
      {
        id: 2,
        date: '10/6/2023',
        amount: 900,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 3,
        date: '10/7/2023',
        amount: 780,
        method: 'Online',
        status: 'Pending',
      },
      {
        id: 4,
        date: '10/8/2023',
        amount: 820,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 5,
        date: '10/9/2023',
        amount: 870,
        method: 'Online',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 6,
        date: '10/10/2023',
        amount: 810,
        method: 'Bank',
        status: 'Pending',
      },
      {
        id: 7,
        date: '10/11/2023',
        amount: 830,
        method: 'Bank',
        status: 'Cancelled',
      },
      {
        id: 8,
        date: '10/5/2023',
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 9,
        date: '10/11/2023',
        amount: 830,
        method: 'Bank',
        status: 'Cancelled',
      },
      {
        id: 10,
        date: '10/5/2023',
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 11,
        date: '10/4/2023',
        amount: 920,
        method: 'Online',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 12,
        date: '10/3/2023',
        amount: 750,
        method: 'Bank',
        status: 'Pending',
      },
      {
        id: 13,
        date: '10/2/2023',
        amount: 680,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 14,
        date: '10/1/2023',
        amount: 950,
        method: 'Online',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 15,
        date: '9/30/2023',
        amount: 720,
        method: 'Bank',
        status: 'Pending',
      },
      {
        id: 16,
        date: '9/29/2023',
        amount: 880,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 17,
        date: '9/28/2023',
        amount: 640,
        method: 'Online',
        status: 'Cancelled',
      },
      {
        id: 18,
        date: '9/27/2023',
        amount: 790,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 19,
        date: '9/26/2023',
        amount: 910,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 20,
        date: '9/25/2023',
        amount: 560,
        method: 'Online',
        status: 'Pending',
      },
      {
        id: 21,
        date: '9/24/2023',
        amount: 1020,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 22,
        date: '9/23/2023',
        amount: 730,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 23,
        date: '9/22/2023',
        amount: 890,
        method: 'Online',
        status: 'Pending',
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
  // Note: selectedPaymentId is set but not currently read, reserved for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const dateRangeInitialized = useRef(false)

  // Fetch client data from API (same as DebtSummaryPage)
  const clientId = id ? Number(id) : 0
  const {
    data: apiClient,
    isLoading: isLoadingClient,
    isError: isClientError,
    error: clientError,
  } = useClient(clientId, !!clientId)

  // Get client name from API or fallback to mock
  const customerName = useMemo(() => {
    if (apiClient) {
      const fullName = [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
        .filter(Boolean)
        .join(' ')
      return fullName || mockClientDetail.fullName
    }
    return mockClientDetail.fullName
  }, [apiClient])

  // Mock data for verification queue (will use customerName from state)
  const mockPendingPayments = useMemo(
    () => [
      {
        id: '1',
        paymentId: 'PMT-2025-12-001',
        submittedAt: '2 hours ago',
        client: customerName,
        project: 'PrivatBank Collection',
        amount: 5000.0,
        method: 'Bank Transfer',
        date: '2025-12-15',
        reference: 'TRX98765',
        currentDebt: 125450.0,
        newDebt: 120450.0,
      },
      {
        id: '2',
        paymentId: 'PMT-2025-12-002',
        submittedAt: '6 hours ago',
        client: customerName,
        project: 'PrivatBank Collection',
        amount: 12000.0,
        method: 'Bank Transfer',
        date: '2025-12-15',
        reference: 'TRX98766',
        currentDebt: 125450.0,
        newDebt: 113450.0,
      },
    ],
    [customerName]
  )

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
      status: 'Rejected' as const,
      amount: 7500.0,
      action: 'Rejected by You',
      time: '3 hours ago',
    },
  ]

  const handleVerifyPayment = (paymentId: string) => {
    // TODO: Implement API call to verify payment
    console.log('Verify payment', paymentId)
    // Close modal after verification
    setIsVerificationModalOpen(false)
  }

  const handleRejectPayment = (paymentId: string) => {
    // TODO: Implement API call to reject payment
    console.log('Reject payment', paymentId)
    // Close modal after rejection
    setIsVerificationModalOpen(false)
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
      setIsPaymentDetailsModalOpen(false)
      setIsCancelModalOpen(true)
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

  // Filter payments
  const filteredPayments = useMemo(() => {
    if (!paymentHistory) return []

    return paymentHistory.payments.filter((payment) => {
      if (statusFilter !== 'All' && payment.status !== statusFilter) return false
      if (methodFilter !== 'All' && payment.method !== methodFilter) return false

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
  }, [paymentHistory, statusFilter, methodFilter, startDate, endDate])

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
        <div className="flex h-12 items-start justify-between self-stretch">
          <div className="flex items-center gap-4 self-stretch">
            <div className="h-12 w-32 animate-pulse rounded-full bg-gray-200" />
            <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-12 w-32 animate-pulse rounded-full bg-gray-200" />
        </div>

        {/* Main Content Skeleton */}
        <div className="flex items-start gap-5 self-stretch">
          {/* Left Column Skeleton */}
          <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
            {/* Client Information Card Skeleton */}
            <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-6">
              {/* Client Name Skeleton */}
              <div className="flex flex-col items-center justify-center gap-4 self-stretch">
                <div className="flex items-center justify-center gap-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                  <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
              </div>

              {/* Progress Circle Skeleton */}
              <div className="mb-6 flex justify-center">
                <div className="relative flex h-[150px] w-[150px] items-center justify-center">
                  <div className="h-[150px] w-[150px] animate-pulse rounded-full bg-gray-200" />
                  <div className="absolute h-12 w-12 animate-pulse rounded-full bg-gray-300" />
                </div>
              </div>

              {/* Total Paid Skeleton */}
              <div className="flex flex-col items-center gap-5 self-stretch">
                <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
              </div>

              {/* Action Buttons Skeleton */}
              <div className="flex items-start gap-3">
                <div className="h-10 flex-1 animate-pulse rounded-full bg-gray-200" />
                <div className="h-10 flex-1 animate-pulse rounded-full bg-gray-200" />
              </div>
            </div>

            {/* Summary Cards Skeleton */}
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6"
              >
                <div className="flex items-start justify-between self-stretch px-6">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="flex items-center justify-between self-stretch px-6">
                  <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>

          {/* Right Column Skeleton - Payment History Table */}
          <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-6">
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />

              {/* Filters Skeleton */}
              <div className="flex items-start gap-5 self-stretch rounded-t-xl border border-b-0 border-[#EBECE8] bg-white p-4">
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <div className="h-3 w-12 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                  <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
                </div>
              </div>

              {/* Table Skeleton */}
              <div className="w-full overflow-hidden rounded-xl rounded-t-none border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-left">
                        <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-right">
                        <div className="ml-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-left">
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-left">
                        <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] px-6 text-center">
                        <div className="mx-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}
                      >
                        <td className="h-[49px] border-r border-[#EBECE8] px-6">
                          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-6 text-right">
                          <div className="ml-auto h-4 w-24 animate-pulse rounded bg-gray-200" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-6">
                          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-6">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 animate-pulse rounded-full bg-gray-200" />
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                          </div>
                        </td>
                        <td className="h-[49px] px-6 text-center">
                          <div className="mx-auto h-6 w-24 animate-pulse rounded bg-gray-200" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Skeleton */}
              <div className="flex items-center justify-between self-stretch">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 animate-pulse rounded bg-gray-200" />
                  <div className="h-10 w-10 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
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
      <div className="flex h-12 items-start justify-between self-stretch">
        <div className="flex items-center gap-4 self-stretch">
          <Button
            variant="white-secondary"
            leftIcon={<Icons.ArrowLeft02 size={20} />}
            onClick={() => navigate(`/dashboard/clients/${id}/debt-summary`)}
            className="h-12 rounded-full"
          >
            {t('pages.clients.paymentHistory.backToClient')}
          </Button>
          <span className="text-dark-500 text-center text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.clients.paymentHistory.title')}:{' '}
            <span className="font-medium">{paymentHistory.customerName}</span>
          </span>
        </div>
        <Button
          variant="primary"
          leftIcon={<Icons.Csv02 size={20} />}
          onClick={() => setIsExportModalOpen(true)}
          className="h-12 rounded-full"
        >
          {t('pages.clients.paymentHistory.exportCSV')}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Left Column - Client Summary */}
        <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
          {/* Client Information Card */}
          <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-6">
            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                  <Icons.User size={24} className="text-dark-500" />
                </div>
                <span className="text-dark-500 text-xl leading-[132%] font-medium tracking-[-0.4px]">
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
              <div className="relative flex h-[150px] w-[150px] items-center justify-center">
                <svg className="h-[150px] w-[150px] -rotate-90 transform" viewBox="0 0 100 100">
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
                <span className="text-secondary-800 absolute text-[36px] leading-[126%] font-medium tracking-[-0.72px]">
                  {Math.round(paymentHistory.progressPercentage)}%
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-5 self-stretch">
              <span className="text-dark-500 text-center text-xl leading-[132%] font-light tracking-[-0.4px]">
                {t('pages.clients.paymentHistory.totalPaid')}{' '}
                <span className="font-medium">{formatCurrency(paymentHistory.totalPaid)}</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-start gap-3">
              <Button
                variant="primary"
                leftIcon={<Icons.Headset size={20} />}
                className="flex-1 rounded-full"
                onClick={() => {
                  // TODO: Handle call
                  console.log('Call customer')
                }}
              >
                {t('pages.clients.paymentHistory.call')}
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Icons.PencilEdit02 size={20} />}
                className="flex-1 rounded-full"
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
          <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-2">
                <Icons.Wallet01 size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.paymentHistory.totalPayments')}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.paymentHistory.numberOfPayments')}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between self-stretch px-6">
              <span className="text-dark-500 text-center text-xl leading-[132%] font-medium tracking-[-0.4px]">
                {formatCurrency(paymentHistory.totalPaymentsAmount)}
              </span>
              <span className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                {paymentHistory.totalPayments}
              </span>
            </div>
            <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
          </div>

          {/* Verified Payments */}
          <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-2">
                <Icons.AddInvoice size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.paymentHistory.verified')}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.paymentHistory.numberOfPayments')}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between self-stretch px-6">
              <span className="text-dark-500 text-center text-xl leading-[132%] font-medium tracking-[-0.4px]">
                {formatCurrency(paymentHistory.verifiedPaymentsAmount)}
              </span>
              <span className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                {paymentHistory.verifiedPayments}
              </span>
            </div>
          </div>

          {/* Pending Payments */}
          <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-2">
                <Icons.Invoice01 size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.paymentHistory.pending')}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.paymentHistory.numberOfPayments')}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between self-stretch px-6">
              <span className="text-dark-500 text-center text-xl leading-[132%] font-medium tracking-[-0.4px]">
                {formatCurrency(paymentHistory.pendingPaymentsAmount)}
              </span>
              <span className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                {paymentHistory.pendingPayments}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column - Payment History Table */}
        <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-6">
          <div className="flex flex-col items-start gap-3 self-stretch">
            <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
              {t('pages.clients.paymentHistory.title')}{' '}
              {getPaymentHistorySubtitle() && (
                <span className="font-light">({getPaymentHistorySubtitle()})</span>
              )}
            </span>
            <div className="flex flex-col items-start self-stretch">
              {/* Filters */}
              <div className="flex items-start gap-5 self-stretch rounded-t-xl border border-b-0 border-[#EBECE8] bg-white p-4">
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.clients.paymentHistory.filters.status')}
                  </span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-[45px] rounded-md border-gray-200">
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
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
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
                      <SelectItem value="Bank">
                        {t('pages.clients.debtSummary.paymentMethod.bank')}
                      </SelectItem>
                      <SelectItem value="Card">
                        {t('pages.clients.debtSummary.paymentMethod.card')}
                      </SelectItem>
                      <SelectItem value="Online">
                        {t('pages.clients.debtSummary.paymentMethod.online')}
                      </SelectItem>
                      <SelectItem value="Direct Debit">
                        {t('pages.clients.debtSummary.paymentMethod.directDebit')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col items-start justify-center gap-1 self-stretch">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    {t('pages.clients.paymentHistory.filters.dateRange')}
                  </span>
                  <div className="flex items-center gap-3">
                    <DateSelect
                      value={startDate}
                      onChange={({ value }) => setStartDate(value)}
                      placeholder={t('pages.clients.paymentHistory.filters.startDate')}
                      className="flex-1"
                    />
                    <span>-</span>
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
              <div className="w-full overflow-hidden rounded-xl rounded-t-none border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                        {t('pages.clients.paymentHistory.tableHeaders.date')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-right text-xs font-medium">
                        {t('pages.clients.paymentHistory.tableHeaders.amount')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                        {t('pages.clients.paymentHistory.tableHeaders.method')}
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                        {t('pages.clients.paymentHistory.tableHeaders.status')}
                      </th>
                      <th className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium">
                        {t('pages.clients.paymentHistory.tableHeaders.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
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
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium">
                            {payment.date}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-right text-xs font-medium">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium">
                            {payment.method === 'Direct Debit'
                              ? t('pages.clients.debtSummary.paymentMethod.directDebit')
                              : t(
                                  `pages.clients.debtSummary.paymentMethod.${payment.method.toLowerCase()}`
                                )}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium">
                            <div className="flex items-center gap-2">
                              {getStatusDot(payment.status)}
                              <span>
                                {payment.status === 'Verified'
                                  ? t('pages.clients.debtSummary.paymentStatus.verified')
                                  : payment.status === 'Pending'
                                    ? t('pages.clients.debtSummary.paymentStatus.pending')
                                    : t('pages.clients.debtSummary.paymentStatus.cancelled')}
                              </span>
                            </div>
                          </td>
                          <td className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium">
                            <div className="flex items-center justify-center gap-2">
                              {payment.status === 'Verified' && payment.receipt && (
                                <LinkButton
                                  variant="regular-secondary"
                                  size="xs"
                                  leftIcon={<Icons.FileDownload size={14} />}
                                  onClick={() => {
                                    // TODO: Handle download PDF
                                    console.log('Download PDF', payment.id)
                                  }}
                                >
                                  {t('pages.clients.paymentHistory.actions.pdf')}
                                </LinkButton>
                              )}
                              {payment.status === 'Pending' && (
                                <LinkButton
                                  variant="regular-secondary"
                                  size="xs"
                                  leftIcon={<Icons.Success size={14} />}
                                  onClick={() => {
                                    setSelectedPaymentId(payment.id)
                                    setIsVerificationModalOpen(true)
                                  }}
                                >
                                  {t('pages.clients.paymentHistory.actions.verify')}
                                </LinkButton>
                              )}
                              <LinkButton
                                variant="regular-secondary"
                                size="xs"
                                leftIcon={<Icons.View size={14} />}
                                onClick={() => handleViewDetails(payment)}
                              >
                                {t('pages.clients.paymentHistory.actions.view')}
                              </LinkButton>
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
        pendingPayments={mockPendingPayments}
        processedPayments={mockProcessedPayments}
        onVerify={handleVerifyPayment}
        onReject={handleRejectPayment}
        onRefresh={() => {
          // TODO: Refresh pending payments
          console.log('Refresh payments')
        }}
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
            reference: `TRX${selectedPayment.id.toString().padStart(5, '0')}`,
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
          }}
          onCancelPayment={handleCancelPayment}
          onEditPayment={() => {
            // Edit payment modal is handled internally by PaymentDetailsModal
            console.log('Edit payment', selectedPayment.id)
          }}
          onSaveEdit={(data) => {
            // TODO: Handle save edit payment
            console.log('Save edit payment', selectedPayment.id, data)
            // Close the payment details modal after saving
            setIsPaymentDetailsModalOpen(false)
            setSelectedPayment(null)
            // Optionally refresh the payment history data
          }}
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
    </div>
  )
}
