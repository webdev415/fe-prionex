/**
 * Payment History Page
 *
 * Displays full payment history for a client with filtering and pagination.
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

// Types
interface Payment {
  id: number
  date: string
  amount: number
  method: 'Online' | 'Bank' | 'Card'
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

// Mock data - replace with actual API call
const getMockPaymentHistory = (_clientId: string): PaymentHistoryData => {
  return {
    customerName: 'Savchenko Ivan Petrovich',
    status: 'Active',
    progressPercentage: 15,
    totalPaid: 15450.0,
    totalDebt: 125450.0,
    totalPayments: 23,
    totalPaymentsAmount: 125450.0,
    verifiedPayments: 20,
    verifiedPaymentsAmount: 105450.0,
    pendingPayments: 3,
    pendingPaymentsAmount: 25000.0,
    payments: [
      {
        id: 1,
        date: '10/6/2023',
        amount: 900,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      { id: 2, date: '10/7/2023', amount: 780, method: 'Online', status: 'Pending' },
      {
        id: 3,
        date: '10/8/2023',
        amount: 820,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 4,
        date: '10/9/2023',
        amount: 870,
        method: 'Online',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      { id: 5, date: '10/10/2023', amount: 810, method: 'Bank', status: 'Pending' },
      { id: 6, date: '10/11/2023', amount: 830, method: 'Bank', status: 'Cancelled' },
      {
        id: 7,
        date: '10/5/2023',
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      { id: 8, date: '10/11/2023', amount: 830, method: 'Bank', status: 'Cancelled' },
      {
        id: 9,
        date: '10/5/2023',
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      { id: 10, date: '10/7/2023', amount: 10080, method: 'Online', status: 'Pending' },
    ],
  }
}

export function PaymentHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryData | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [methodFilter, setMethodFilter] = useState<string>('All')
  const [startDate, setStartDate] = useState<Date | null>(new Date('2024-11-20'))
  const [endDate, setEndDate] = useState<Date | null>(new Date('2024-11-20'))
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  // Note: selectedPaymentId is set but not currently read, reserved for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  // Mock data for verification queue
  const mockPendingPayments = [
    {
      id: '1',
      paymentId: 'PMT-2025-12-001',
      submittedAt: '2 hours ago',
      client: 'Savchenko Ivan Petrovich',
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
      client: 'Savchenko Ivan Petrovich',
      project: 'PrivatBank Collection',
      amount: 12000.0,
      method: 'Bank Transfer',
      date: '2025-12-15',
      reference: 'TRX98766',
      currentDebt: 125450.0,
      newDebt: 113450.0,
    },
  ]

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
      navigate(`/dashboard/${id}`)
    }
  }

  useEffect(() => {
    if (id) {
      // TODO: Replace with actual API call
      const data = getMockPaymentHistory(id)
      setTimeout(() => {
        setPaymentHistory(data)
      }, 1000)
    }
  }, [id])

  const formatCurrency = (amount: number) => {
    return `₴ ${amount
      .toLocaleString('uk-UA', {
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
      // TODO: Add date range filtering
      return true
    })
  }, [paymentHistory, statusFilter, methodFilter])

  // Paginate payments
  const totalPages = Math.ceil(filteredPayments.length / pageSize)
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredPayments.slice(start, end)
  }, [filteredPayments, currentPage, pageSize])

  if (!paymentHistory) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
      {/* Header */}
      <div className="flex h-12 items-start justify-between self-stretch">
        <div className="flex w-[723px] items-center gap-4 self-stretch">
          <Button
            variant="white-secondary"
            leftIcon={<Icons.ArrowLeft02 size={20} />}
            onClick={() => navigate(`/dashboard/${id}/debt-summary`)}
            className="h-12 rounded-full"
          >
            Back to Client
          </Button>
          <span className="text-dark-500 text-center text-2xl leading-tight font-light tracking-[-0.48px]">
            Payment History: <span className="font-medium">{paymentHistory.customerName}</span>
          </span>
        </div>
        <Button
          variant="primary"
          leftIcon={<Icons.Csv02 size={20} />}
          onClick={() => setIsExportModalOpen(true)}
          className="h-12 rounded-full"
        >
          Export CSV
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
                Total Paid:{' '}
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
                Call
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
                Edit
              </Button>
            </div>
          </div>

          {/* Total Payments */}
          <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-2">
                <Icons.Wallet01 size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  Total Payments
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  Number of Payments
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
                  Verified
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  Number of Payments
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
                  Pending
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  Number of Payments
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
              Payment History <span className="font-light">(Last 10)</span>
            </span>
            <div className="flex flex-col items-start self-stretch">
              {/* Filters */}
              <div className="flex items-start gap-5 self-stretch rounded-t-xl border border-b-0 border-[#EBECE8] bg-white p-4">
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    Status:
                  </span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-[45px] rounded-md border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="Verified">Verified</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    Method:
                  </span>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="h-[45px] rounded-md border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="Bank">Bank</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="Direct Debit">Direct Debit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col items-start justify-center gap-1 self-stretch">
                  <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                    Date Range:
                  </span>
                  <div className="flex items-center gap-3">
                    <DateSelect
                      value={startDate}
                      onChange={({ value }) => setStartDate(value)}
                      placeholder="Start date"
                      className="flex-1"
                    />
                    <span>-</span>
                    <DateSelect
                      value={endDate}
                      onChange={({ value }) => setEndDate(value)}
                      placeholder="End date"
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
                        Date
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-right text-xs font-medium">
                        Amount
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                        Method
                      </th>
                      <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                        Status
                      </th>
                      <th className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium">
                        Actions
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
                          No payment history found
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
                            {payment.method}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium">
                            <div className="flex items-center gap-2">
                              {getStatusDot(payment.status)}
                              <span>{payment.status}</span>
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
                                  PDF
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
                                  Verify
                                </LinkButton>
                              )}
                              <LinkButton
                                variant="regular-secondary"
                                size="xs"
                                leftIcon={<Icons.View size={14} />}
                                onClick={() => handleViewDetails(payment)}
                              >
                                View
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
