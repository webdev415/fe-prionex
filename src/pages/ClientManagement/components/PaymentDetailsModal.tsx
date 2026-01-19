/**
 * Payment Details Modal
 *
 * Modal for viewing detailed information about a payment.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { EditPaymentModal } from './EditPaymentModal'
// TODO: When backend API is ready, import: import api from '@/lib/api'

export interface PaymentDetails {
  paymentId: string
  status: 'Verified' | 'Pending' | 'Cancelled'
  amount: number
  paymentDate: string
  method: string
  reference: string
  clientId: string
  clientName: string
  phone: string
  project: string
  currentDebt: number
  newDebt: number
  createdBy: string
  createdAt: string
  verifiedBy?: string
  verifiedAt?: string
  cancelledBy?: string
  cancelledAt?: string
  cancellationReason?: string
}

export interface PaymentDetailsModalProps {
  open: boolean
  onClose: () => void
  payment: PaymentDetails
  onCancelPayment?: () => void
  onEditPayment?: () => void
  onViewClientProfile?: () => void
  onPrintReceipt?: () => void
  onDownloadReceipt?: () => void
  onSaveEdit?: (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Card Payment' | 'Other'
    reference: string
  }) => void
}

export function PaymentDetailsModal({
  open,
  onClose,
  payment,
  onCancelPayment,
  onEditPayment,
  onViewClientProfile,
  onPrintReceipt,
  onDownloadReceipt,
  onSaveEdit,
}: PaymentDetailsModalProps) {
  const { t, i18n } = useTranslation('common')

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const hasDebt = payment.newDebt > 0

  // Helper function to check if payment date is less than 7 days old
  const isPaymentLessThan7DaysOld = (paymentDate: string): boolean => {
    try {
      // Parse payment date - could be MM/DD/YYYY or YYYY-MM-DD format
      let paymentDateObj: Date
      if (paymentDate.includes('/')) {
        // MM/DD/YYYY format
        const [month, day, year] = paymentDate.split('/')
        paymentDateObj = new Date(Number(year), Number(month) - 1, Number(day))
      } else {
        // YYYY-MM-DD format
        paymentDateObj = new Date(paymentDate)
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
  }

  const canEditOrCancel =
    payment.status === 'Pending' && isPaymentLessThan7DaysOld(payment.paymentDate)

  const handleEditPayment = () => {
    setIsEditModalOpen(true)
    if (onEditPayment) {
      onEditPayment()
    }
  }

  const handleSaveEdit = (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Online Gateway' | 'Cash' | 'Card' | 'Other'
    referenceNumber?: string
    last4Digits?: string
    paymentMethodDetails?: string
  }) => {
    if (onSaveEdit) {
      // Convert to old format for backward compatibility if needed
      onSaveEdit({
        amount: data.amount,
        date: data.date,
        method:
          data.method === 'Card'
            ? 'Card Payment'
            : (data.method as 'Bank Transfer' | 'Card Payment' | 'Other'),
        reference: data.referenceNumber || '',
      })
    }
    setIsEditModalOpen(false)
  }

  // Convert payment method to EditPaymentModal format (for backward compatibility)
  const getPaymentMethod = ():
    | 'Bank Transfer'
    | 'Card Payment'
    | 'Other'
    | 'Online Gateway'
    | 'Cash'
    | 'Card' => {
    if (payment.method === 'Bank' || payment.method === 'Bank Transfer') {
      return 'Bank Transfer'
    }
    if (payment.method === 'Card' || payment.method === 'Card Payment') {
      return 'Card'
    }
    if (payment.method === 'Online Gateway') {
      return 'Online Gateway'
    }
    if (payment.method === 'Cash') {
      return 'Cash'
    }
    return 'Other'
  }

  const handleDownloadReceipt = async () => {
    try {
      // TODO: Backend API endpoint not ready yet
      // When backend is ready, implement the following:
      //
      // 1. Extract payment ID from paymentId (format: PMT-123 or just 123)
      //    const paymentId = payment.paymentId.replace(/^PMT-/, '')
      //
      // 2. Call backend API endpoint:
      //    import api from '@/lib/api'
      //    const response = await api.get(`/api/payments/${paymentId}/receipt`, {
      //      params: { format: 'pdf' },
      //      responseType: 'blob',
      //    })
      //
      // 3. Create blob URL and trigger download:
      //    const blob = new Blob([response.data], { type: 'application/pdf' })
      //    const url = URL.createObjectURL(blob)
      //    const a = document.createElement('a')
      //    a.href = url
      //
      // 4. Extract filename from Content-Disposition header or use default:
      //    const contentDisposition = response.headers['content-disposition']
      //    const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i)
      //    const filename = filenameMatch?.[1] || `receipt_${payment.paymentId}.pdf`
      //
      // 5. Trigger download:
      //    a.download = filename
      //    document.body.appendChild(a)
      //    a.click()
      //    document.body.removeChild(a)
      //    URL.revokeObjectURL(url)

      // Temporary: Show message that backend is not ready
      toast.info('Receipt download will be available when backend API is ready')

      // Call the optional callback
      if (onDownloadReceipt) {
        onDownloadReceipt()
      }
    } catch (error) {
      console.error('Error downloading receipt:', error)
      toast.error('Failed to download receipt. Please try again.')
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} maxWidth="2xl">
        <ModalHeader
          icon={
            <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
              <Icons.MoneyReceive01 size={20} className="text-dark-500" strokeWidth={1.5} />
            </div>
          }
          title={t('pages.clients.modals.paymentDetails.title', { paymentId: payment.paymentId })}
          className="pb-6"
        />
        <ModalContent className="max-h-[calc(90vh-250px)]">
          {/* Action Buttons - Only show for Pending status when payment is < 7 days old */}
          {canEditOrCancel && (
            <div className="mb-4 flex items-center gap-5 self-stretch">
              {onCancelPayment && (
                <Button
                  variant="secondary"
                  leftIcon={<Icons.CancelCircle size={20} />}
                  onClick={onCancelPayment}
                  className="h-12 flex-1 rounded-md"
                >
                  {t('pages.clients.modals.paymentDetails.cancelPayment')}
                </Button>
              )}
              <Button
                variant="primary"
                leftIcon={<Icons.PencilEdit size={20} />}
                onClick={handleEditPayment}
                className="h-12 flex-1 rounded-md"
              >
                {t('pages.clients.modals.paymentDetails.editPayment')}
              </Button>
            </div>
          )}

          {/* Payment Information Section */}
          <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.paymentDetails.paymentInformation')}
              </span>
            </div>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 px-6 py-5">
              <div className="flex items-center gap-3 self-stretch">
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.paymentId')}{' '}
                      <span className="font-medium">{payment.paymentId}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.status')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full',
                          payment.status === 'Verified'
                            ? 'bg-success-200'
                            : payment.status === 'Pending'
                              ? 'bg-gray-200'
                              : 'bg-error-200'
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            payment.status === 'Verified'
                              ? 'bg-success-500'
                              : payment.status === 'Pending'
                                ? 'bg-gray-500'
                                : 'bg-error-500'
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-sm font-medium',
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
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.amount')}{' '}
                      <span className="font-medium">{formatCurrency(payment.amount)}</span>
                    </span>
                  </div>
                </div>

                <div className="mx-2 h-[79px] w-px bg-gray-200"></div>

                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.paymentDate')}{' '}
                      <span className="font-medium">{payment.paymentDate}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.paymentMethod')}{' '}
                      <span className="font-medium">{payment.method}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.reference')}{' '}
                      <span className="font-medium">{payment.reference}</span>
                    </span>
                  </div>
                </div>
              </div>
              {payment.status === 'Cancelled' && payment.cancellationReason && (
                <div className="border-error-200 bg-error-50 mt-4 flex flex-col items-start gap-2 self-stretch rounded-lg border px-4 py-3">
                  <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.modals.paymentDetails.cancellationReason')}
                  </span>
                  <span className="text-error-600 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {payment.cancellationReason}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Client Information Section */}
          <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
            <div className="flex items-center justify-between self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.paymentDetails.clientInformation')}
              </span>
              {onViewClientProfile && (
                <LinkButton
                  variant="regular-secondary"
                  rightIcon={<Icons.ArrowRight size={20} />}
                  onClick={onViewClientProfile}
                >
                  {t('pages.clients.modals.paymentDetails.viewClientProfile')}
                </LinkButton>
              )}
            </div>
            <div className="flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border border-white bg-white/50 px-6 py-5">
              <div className="flex flex-col items-start gap-1 self-stretch">
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.paymentDetails.clientId')}
                  </span>
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {payment.clientId}
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.paymentDetails.name')}
                  </span>
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {payment.clientName}
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.paymentDetails.phone')}
                  </span>
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {payment.phone}
                  </span>
                </div>
                <div className="flex items-start gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.paymentDetails.project')}
                  </span>
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {payment.project}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Debt Impact Section */}
          <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.paymentDetails.debtImpact')}
            </span>
            <div className="flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border border-white bg-white/50 p-5 px-6">
              <div className="flex items-start gap-5 self-stretch">
                <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                  {t('pages.clients.modals.paymentDetails.debtBefore')}
                </span>
                <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {formatCurrency(payment.currentDebt)}
                </span>
              </div>
              <div className="flex flex-col items-start gap-1 self-stretch">
                <div className="flex items-center gap-5 self-stretch">
                  <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.paymentDetails.paymentAmount')}
                  </span>
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    - {formatCurrency(payment.amount)}
                  </span>
                </div>

                <div className="my-2 h-px w-full bg-gray-200" />

                <div className="flex items-center gap-5 self-stretch">
                  <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                    {t('pages.clients.modals.paymentDetails.debtAfter')}
                  </span>
                  <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {formatCurrency(payment.newDebt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-5 self-stretch">
                <span className="text-dark-500 w-[120px] text-sm leading-[150%] font-light tracking-[-0.28px]">
                  {t('pages.clients.modals.paymentDetails.clientStatus')}
                </span>
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex items-center justify-center gap-1 rounded-full bg-white px-3 py-1">
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full',
                        hasDebt ? 'bg-success-200' : 'bg-error-200'
                      )}
                    >
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          hasDebt ? 'bg-success-500' : 'bg-error-500'
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        'text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        hasDebt ? 'text-success-500' : 'text-error-500'
                      )}
                    >
                      {hasDebt
                        ? t('pages.clients.statuses.active')
                        : t('pages.clients.statuses.paid')}
                    </span>
                  </div>
                  <span className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                    {hasDebt && t('pages.clients.modals.paymentDetails.stillHasDebt')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Trail Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.paymentDetails.auditTrail')}
            </span>
            <div className="flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border border-white bg-white/50 p-6">
              <div className="flex items-center gap-3 self-stretch">
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.createdBy')}{' '}
                      <span className="font-medium">{payment.createdBy}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                      {t('pages.clients.modals.paymentDetails.createdAt')}{' '}
                      <span className="font-medium">{payment.createdAt}</span>
                    </span>
                  </div>
                </div>
                {payment.status === 'Verified' && payment.verifiedBy && payment.verifiedAt && (
                  <>
                    <div className="mx-2 h-[50px] w-px bg-gray-200"></div>
                    <div className="flex flex-1 flex-col items-start gap-2 p-0">
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                          {t('pages.clients.modals.paymentDetails.verifiedBy')}{' '}
                          <span className="font-medium">{payment.verifiedBy}</span>
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                          {t('pages.clients.modals.paymentDetails.verifiedAt')}{' '}
                          <span className="font-medium">{payment.verifiedAt}</span>
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {payment.status === 'Cancelled' && payment.cancelledBy && payment.cancelledAt && (
                  <>
                    <div className="mx-2 h-[50px] w-px bg-gray-200"></div>
                    <div className="flex flex-1 flex-col items-start gap-2 p-0">
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                          {t('pages.clients.modals.paymentDetails.cancelledBy')}{' '}
                          <span className="font-medium">{payment.cancelledBy}</span>
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                          {t('pages.clients.modals.paymentDetails.cancelledAt')}{' '}
                          <span className="font-medium">{payment.cancelledAt}</span>
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter className="flex flex-col self-stretch border-none">
          {payment.status === 'Verified' && (
            <div className="flex w-full items-center gap-3 self-stretch">
              <Button
                variant="white-secondary"
                leftIcon={<Icons.Printer size={20} />}
                onClick={onPrintReceipt}
                className="h-12 w-full flex-1 self-stretch rounded-md"
              >
                {t('pages.clients.modals.paymentDetails.printReceipt')}
              </Button>
              <Button
                variant="white-secondary"
                leftIcon={<Icons.FileDownload size={20} />}
                onClick={handleDownloadReceipt}
                className="h-12 w-full flex-1 self-stretch rounded-md"
              >
                {t('pages.clients.modals.paymentDetails.downloadReceiptPDF')}
              </Button>
            </div>
          )}
          <Button
            variant="cancel"
            onClick={onClose}
            className="flex h-12 w-full self-stretch rounded-md"
          >
            {t('pages.clients.modals.paymentDetails.close')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Payment Modal */}
      <EditPaymentModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        payment={{
          paymentId: payment.paymentId,
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          method: getPaymentMethod(),
          reference: payment.reference,
          createdBy: payment.createdBy,
          createdAt: payment.createdAt,
          currentDebt: payment.currentDebt,
          referenceNumber: payment.reference,
          last4Digits: payment.reference?.match(/^\d{4}$/) ? payment.reference : undefined,
          paymentMethodDetails: undefined, // Not stored in PaymentDetails interface yet
        }}
        onSave={handleSaveEdit}
      />
    </>
  )
}
