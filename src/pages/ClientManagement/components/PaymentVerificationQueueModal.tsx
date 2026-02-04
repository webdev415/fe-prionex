/**
 * Payment Verification Queue Modal
 *
 * Modal for verifying pending payments with expandable payment cards.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { convertUTCToUserTimezone } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { Modal, ModalHeader, ModalContent } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface PendingPayment {
  id: string
  paymentId: string
  submittedAt: string
  client: string
  project: string
  amount: number
  method: string
  date: string
  reference: string
  currentDebt: number
  newDebt: number
}

export interface ProcessedPayment {
  id: string
  paymentId: string
  status: 'Verified' | 'Cancelled'
  amount: number
  action: string
  time: string
}

export interface PaymentVerificationQueueModalProps {
  open: boolean
  onClose: () => void
  pendingPayments: PendingPayment[]
  processedPayments: ProcessedPayment[]
  onVerify: (paymentId: string) => void
  onCancel: (paymentId: string, payment: PendingPayment) => void
  onRefresh?: () => void
  initialExpandedPaymentId?: string | null
}

export function PaymentVerificationQueueModal({
  open,
  onClose,
  pendingPayments,
  processedPayments,
  onVerify,
  onCancel,
  onRefresh,
  initialExpandedPaymentId,
}: PaymentVerificationQueueModalProps) {
  const { t, i18n } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatTimeAgo = (timeString: string) => {
    // Convert UTC datetime to user's timezone
    return convertUTCToUserTimezone(timeString, userTimezone)
  }
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [sortBy, setSortBy] = useState('Oldest First')
  const [filter, setFilter] = useState('All Projects')

  // Helper to parse MM/DD/YYYY date string to Date object
  // This function is stable and doesn't need to be in dependencies
  const parseDate = (dateStr: string): number => {
    if (!dateStr) return 0
    // Handle MM/DD/YYYY format (e.g., "01/24/2026")
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr.trim())
    if (match) {
      const [, month, day, year] = match
      const date = new Date(Number(year), Number(month) - 1, Number(day))
      return date.getTime()
    }
    // Fallback: try ISO format or standard Date parsing
    const fallbackDate = new Date(dateStr)
    return isNaN(fallbackDate.getTime()) ? 0 : fallbackDate.getTime()
  }

  // Derived pending list with sort + filter applied
  const visiblePendingPayments = useMemo(() => {
    let list = [...pendingPayments]

    // Filter by project
    if (filter !== 'All Projects') {
      if (filter === 'PrivatBank Collection') {
        list = list.filter((p) => p.project === 'PrivatBank Collection')
      } else if (filter === 'Other Project') {
        list = list.filter((p) => p.project !== 'PrivatBank Collection')
      }
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'Oldest First') {
        const dateDiff = parseDate(a.date) - parseDate(b.date)
        // If dates are equal, sort by amount (ascending) as secondary sort
        return dateDiff !== 0 ? dateDiff : a.amount - b.amount
      }
      if (sortBy === 'Newest First') {
        const dateDiff = parseDate(b.date) - parseDate(a.date)
        // If dates are equal, sort by amount (descending) as secondary sort
        return dateDiff !== 0 ? dateDiff : b.amount - a.amount
      }
      if (sortBy === 'Amount (High to Low)') {
        const amountDiff = b.amount - a.amount
        // If amounts are equal, sort by date (newest first) as secondary sort
        return amountDiff !== 0 ? amountDiff : parseDate(b.date) - parseDate(a.date)
      }
      if (sortBy === 'Amount (Low to High)') {
        const amountDiff = a.amount - b.amount
        // If amounts are equal, sort by date (oldest first) as secondary sort
        return amountDiff !== 0 ? amountDiff : parseDate(a.date) - parseDate(b.date)
      }
      return 0
    })

    return list
  }, [pendingPayments, sortBy, filter])

  // Compute initial expanded payments based on props
  // Using key prop on Modal to reset state when initialExpandedPaymentId changes
  const initialExpandedPayments = useMemo<Set<string>>(() => {
    if (initialExpandedPaymentId) {
      return new Set([initialExpandedPaymentId])
    }
    if (pendingPayments.length > 0 && pendingPayments[0]?.id) {
      return new Set([pendingPayments[0].id])
    }
    return new Set<string>()
  }, [initialExpandedPaymentId, pendingPayments])

  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(initialExpandedPayments)

  const toggleExpanded = (paymentId: string) => {
    const newExpanded = new Set(expandedPayments)
    if (newExpanded.has(paymentId)) {
      newExpanded.delete(paymentId)
    } else {
      newExpanded.add(paymentId)
    }
    setExpandedPayments(newExpanded)
  }

  const handleCancelClick = (payment: PendingPayment) => {
    // Close PaymentVerificationQueueModal
    onClose()
    // Trigger parent to open CancelPaymentModal
    onCancel(payment.id, payment)
  }

  return (
    <Modal key={initialExpandedPaymentId || 'default'} open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.MoneyReceive01 size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.paymentVerificationQueue.title')}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-200px)]">
        {/* Pending Verification Section */}
        <div className="mb-4 flex flex-col items-start gap-3 self-stretch sm:flex-row sm:items-start sm:justify-between">
          <span className="text-dark-500 text-lg leading-[132%] font-light tracking-[-0.4px] sm:text-xl">
            {t('pages.clients.modals.paymentVerificationQueue.pendingVerification')}{' '}
            <span className="text-gray-700">({visiblePendingPayments.length})</span>
          </span>
          <div className="flex items-center gap-3">
            <div className="flex h-6 items-center gap-3">
              <ToggleSwitch checked={autoRefresh} onChange={setAutoRefresh} />
              <span className="text-secondary-800 text-sm">
                {t('pages.clients.modals.paymentVerificationQueue.autoRefresh')}
              </span>
            </div>
            <LinkButton
              variant="regular-secondary"
              leftIcon={<Icons.Reload className="!h-6 !w-6" strokeWidth={1.5} />}
              onClick={onRefresh}
            >
              {t('pages.clients.modals.paymentVerificationQueue.refresh')}
            </LinkButton>
          </div>
        </div>
        <div className="mb-4 flex flex-col items-start gap-3 self-stretch sm:flex-row sm:gap-4">
          <div className="flex h-[63px] w-full flex-1 flex-col items-start justify-center gap-1 sm:w-auto">
            <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.modals.paymentVerificationQueue.sortBy')}
            </span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-[45px] flex-1 rounded-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Oldest First">
                  {t('pages.clients.modals.paymentVerificationQueue.oldestFirst')}
                </SelectItem>
                <SelectItem value="Newest First">
                  {t('pages.clients.modals.paymentVerificationQueue.newestFirst')}
                </SelectItem>
                <SelectItem value="Amount (High to Low)">
                  {t('pages.clients.modals.paymentVerificationQueue.amountHighToLow')}
                </SelectItem>
                <SelectItem value="Amount (Low to High)">
                  {t('pages.clients.modals.paymentVerificationQueue.amountLowToHigh')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex h-[63px] w-full flex-1 flex-col items-start justify-center gap-1 sm:w-auto">
            <span className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.modals.paymentVerificationQueue.filter')}
            </span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-[45px] w-full flex-1 rounded-md sm:w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Projects">
                  {t('pages.clients.modals.paymentVerificationQueue.allProjects')}
                </SelectItem>
                <SelectItem value="PrivatBank Collection">
                  {t('pages.clients.modals.paymentVerificationQueue.privatBankCollection')}
                </SelectItem>
                <SelectItem value="Other Project">
                  {t('pages.clients.modals.paymentVerificationQueue.otherProject')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pending Payment Cards */}
        <div className="space-y-4">
          {visiblePendingPayments.map((payment) => {
            const isExpanded = expandedPayments.has(payment.id)
            return (
              <div key={payment.id} className="mb-4 flex flex-col items-start gap-2 self-stretch">
                {/* Payment Header */}
                <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentVerificationQueue.payment', {
                        paymentId: payment.paymentId,
                      })}
                    </span>
                  </div>
                  <span className="text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-700 sm:text-sm">
                    {t('pages.clients.modals.paymentVerificationQueue.submitted')}{' '}
                    {convertUTCToUserTimezone(payment.submittedAt, userTimezone)}
                  </span>
                </div>

                {/* Payment Details - Always visible */}
                {isExpanded && (
                  <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white/100 bg-white/50 p-4 sm:p-[20px_24px]">
                    <div className="flex flex-col items-start gap-2 self-stretch">
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.client')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {payment.client}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.project')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {payment.project}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.amount')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.method')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {payment.method}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.date')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {convertUTCToUserTimezone(payment.date, userTimezone)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.reference')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {payment.reference}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.currentDebt')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {formatCurrency(payment.currentDebt)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.newDebt')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {formatCurrency(payment.newDebt)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex w-full flex-col items-stretch gap-3 self-stretch sm:flex-row sm:gap-5">
                      <Button
                        variant="secondary"
                        leftIcon={<Icons.CancelCircle size={18} className="text-white" />}
                        onClick={() => handleCancelClick(payment)}
                        className="w-full rounded-md"
                      >
                        {t('pages.clients.modals.paymentVerificationQueue.cancelPayment')}
                      </Button>
                      <Button
                        variant="primary"
                        leftIcon={<Icons.CheckmarkSquare03 size={18} className="text-dark-500" />}
                        onClick={() => onVerify(payment.id)}
                        className="w-full rounded-md"
                      >
                        {t('pages.clients.modals.paymentVerificationQueue.verifyAndApprove')}
                      </Button>
                    </div>
                  </div>
                )}
                {/* Collapsed View - Show minimal info */}
                {!isExpanded && (
                  <div className="flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border border-white/100 bg-white/50 p-4 sm:p-[20px_24px]">
                    <div className="flex flex-col items-start gap-1 self-stretch">
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.client')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {payment.client}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.amount')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                        <span className="w-full text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-600 sm:w-[120px] sm:text-sm">
                          {t('pages.clients.modals.paymentVerificationQueue.method')}
                        </span>
                        <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                          {payment.method}
                        </span>
                      </div>
                    </div>

                    <LinkButton
                      variant="regular-secondary"
                      leftIcon={<Icons.ArrowDown className="!h-5 !w-5" />}
                      onClick={() => toggleExpanded(payment.id)}
                      className="p-0"
                    >
                      {t('pages.clients.modals.paymentVerificationQueue.expandDetails')}
                    </LinkButton>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Recently Processed Section */}
        {processedPayments.length > 0 && (
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.paymentVerificationQueue.recentlyProcessed')}
            </span>
            <div className="flex flex-col items-start justify-center gap-0 self-stretch rounded-xl border border-white bg-white/50 p-3 px-6">
              {processedPayments.map((payment) => (
                <>
                  <div
                    key={payment.id}
                    className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-center sm:gap-5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full',
                          payment.status === 'Verified' ? 'bg-success-200' : 'bg-error-200'
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            payment.status === 'Verified' ? 'bg-success-500' : 'bg-error-500'
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm',
                          payment.status === 'Verified' ? 'text-success-500' : 'text-error-500'
                        )}
                      >
                        {payment.status === 'Verified'
                          ? t('pages.clients.modals.paymentVerificationQueue.verified')
                          : t('pages.clients.debtSummary.paymentStatus.cancelled')}
                      </span>
                    </div>
                    <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                      {payment.paymentId}
                    </span>
                    <div className="flex flex-1 items-start justify-center gap-2.5">
                      <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col items-start gap-1">
                      <span className="text-dark-500 flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                        {payment.action}
                      </span>
                      <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                        {formatTimeAgo(payment.time)}
                      </span>
                    </div>
                  </div>
                  {payment.id !== processedPayments[processedPayments.length - 1].id && (
                    <div className="h-px w-full bg-gray-200" />
                  )}
                </>
              ))}
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}
