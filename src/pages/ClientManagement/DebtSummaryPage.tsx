/**
 * Debt Summary Page
 *
 * Displays customer debt summary with payment progress and payment history.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { RecordPaymentModal } from './components/RecordPaymentModal'

// Types
interface Payment {
  id: number
  date: string
  amount: number
  method: 'Online' | 'Bank' | 'Card'
  status: 'Verified' | 'Pending' | 'Cancelled'
  receipt?: string
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

// Mock data - replace with actual API call
const getMockDebtSummary = (_clientId: string): DebtSummaryData => {
  return {
    customerName: 'Savchenko Ivan Petrovich',
    status: 'Active',
    progressPercentage: 15,
    totalPaid: 15450.0,
    totalDebt: 125450.0,
    daysPastDue: 18,
    lastPayment: {
      amount: 5000.0,
      date: '10/11/2023',
    },
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
    ],
    totalVerified: 100456,
    pendingVerification: 100456,
  }
}

export function DebtSummaryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [debtSummary, setDebtSummary] = useState<DebtSummaryData | null>(null)
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)

  useEffect(() => {
    if (id) {
      // TODO: Replace with actual API call
      const data = getMockDebtSummary(id)
      setTimeout(() => {
        setDebtSummary(data)
      }, 1000)
    }
  }, [id])

  if (!debtSummary) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-gray-600">Loading...</div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    // Format with spaces as thousands separator, no decimals (e.g., "₴ 10 080")
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
        {' '}
        <span className={cn('h-1.5 w-1.5 rounded-full', statusColors[status])} />
      </span>
    )
  }

  // Remove the paymentColumns array - we'll build the table directly

  const handleRecordPayment = (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Card Payment' | 'Other'
    status: 'Pending Verification' | 'Verified'
    generateReceipt: boolean
    updateBalance: boolean
  }) => {
    // TODO: Implement API call to record payment
    console.log('Record payment:', data)
    // Refresh debt summary after payment
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
      {/* Header */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center">
          <LinkButton variant="regular-secondary" onClick={() => navigate(`/dashboard/${id}`)}>
            <Icons.ArrowLeft02 size={24} />
          </LinkButton>
          <span className="text-dark-500 flex-1 text-2xl leading-tight font-light tracking-[-0.48px]">
            Debt Summary
          </span>
        </div>
        <DoubleButton
          icon={<Icons.Add size={24} />}
          iconPosition="left"
          onClick={() => setIsRecordPaymentModalOpen(true)}
        >
          Record Payment
        </DoubleButton>
      </div>

      {/* Main Content */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Left Panel - Customer Info and Summary */}
        <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
          <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-6">
            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                  <Icons.User size={24} className="text-dark-500" />
                </div>
                <span className="text-dark-500 text-xl leading-[132%] font-medium tracking-[-0.4px]">
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
              <div className="relative flex h-[150px] w-[150px] items-center justify-center">
                <svg className="h-[150px] w-[150px] -rotate-90 transform" viewBox="0 0 100 100">
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
                <span className="text-secondary-800 absolute text-[36px] leading-[126%] font-medium tracking-[-0.72px]">
                  {Math.round(debtSummary.progressPercentage)}%
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-5 self-stretch">
              <span className="text-dark-500 text-center text-xl leading-[132%] font-light tracking-[-0.4px]">
                Total Paid:{' '}
                <span className="font-medium">{formatCurrency(debtSummary.totalPaid)}</span>
              </span>
              <LinkButton
                variant="regular-secondary"
                leftIcon={<Icons.MoneyReceive01 size={24} />}
                onClick={() => navigate(`/dashboard/${id}/payment-history`)}
                className="flex-1"
              >
                View Payment History
              </LinkButton>

              <LinkButton
                variant="regular-secondary"
                leftIcon={<Icons.PieChart08 size={24} />}
                onClick={() => {
                  // TODO: Handle generate payment plan
                  console.log('Generate payment plan')
                }}
                className="flex-1"
              >
                Generate Payment Plan
              </LinkButton>
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

          {/* Last Payment Card */}
          <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white/100 bg-white/50 p-5 px-0">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-3">
                <Icons.Money01 size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  Last Payment
                </span>
              </div>
              <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                Date
              </span>
            </div>
            <div className="flex items-center justify-between self-stretch px-6 py-0">
              <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
                {formatCurrency(debtSummary.lastPayment.amount)}
              </span>
              <span className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                {debtSummary.lastPayment.date}
              </span>
            </div>
          </div>

          {/* Total Debt Card */}
          <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-2">
                <Icons.Wallet01 size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  Total Debt
                </span>
              </div>
              <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                Days Past Due
              </span>
            </div>
            <div className="flex items-center justify-between self-stretch px-6 py-0">
              <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
                {formatCurrency(debtSummary.totalDebt)}
              </span>
              <span className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                Days Past Due: {debtSummary.daysPastDue}
              </span>
            </div>
            <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
          </div>
        </div>

        {/* Right Panel - Payment History */}
        <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-6">
          <div className="flex flex-col items-start gap-3 self-stretch">
            <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
              Payment History <span className="font-light">(Last 10)</span>
            </span>

            {/* Custom Table */}
            <div className="w-full overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
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
                    <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-medium">
                      Receipt
                    </th>
                    <th className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {debtSummary.payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium"
                      >
                        No payment history found
                      </td>
                    </tr>
                  ) : (
                    debtSummary.payments.map((payment, index) => (
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
                        <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-medium">
                          {payment.receipt ? (
                            <LinkButton
                              variant="regular-secondary"
                              size="xs"
                              leftIcon={<Icons.FileDownload size={14} />}
                              onClick={() => {
                                // TODO: Handle view receipt
                                console.log('View receipt', payment.id)
                              }}
                            >
                              PDF
                            </LinkButton>
                          ) : (
                            <span className="text-xs text-gray-500"></span>
                          )}
                        </td>
                        <td className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium">
                          {payment.status === 'Pending' ? (
                            <LinkButton
                              variant="regular-secondary"
                              size="xs"
                              leftIcon={<Icons.Success size={14} />}
                              onClick={() => {
                                // TODO: Handle verify payment
                                console.log('Verify payment', payment.id)
                              }}
                            >
                              Verify
                            </LinkButton>
                          ) : (
                            <LinkButton
                              variant="regular-secondary"
                              size="xs"
                              leftIcon={<Icons.View size={14} />}
                              onClick={() => {
                                // TODO: Handle view details
                                console.log('View details', payment.id)
                              }}
                            >
                              View Details
                            </LinkButton>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* View All Link - Part of table structure */}
              <div className="flex items-center justify-center gap-[1px] self-stretch rounded-none border-x border-[#EBECE8]">
                <div className="flex min-h-[49px] flex-1 items-center justify-center gap-1 bg-[linear-gradient(0deg,#f2f3f0,#f2f3f0),#ffffff] p-2 px-4">
                  <LinkButton
                    variant="regular-secondary"
                    leftIcon={<Icons.Reload size={16} />}
                    onClick={() => {
                      // TODO: Handle view all
                      console.log('View all payments')
                    }}
                  >
                    View All (23)
                  </LinkButton>
                </div>
              </div>

              {/* Summary Row - Part of table structure */}
              <div className="flex w-full items-center justify-between border-[#EBECE8] bg-white">
                <div className="flex flex-1 items-center border-r border-[#EBECE8] px-6 py-4">
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    Total Verified:
                  </span>
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {formatCurrency(debtSummary.totalVerified)}
                  </span>
                </div>
                <div className="flex flex-1 items-center px-6 py-4">
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    Pending Verification:
                  </span>
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
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
          onSave={handleRecordPayment}
        />
      )}
    </div>
  )
}
