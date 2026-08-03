/**
 * Payment Details Modal
 *
 * Modal for viewing detailed information about a payment.
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { convertUTCToUserTimezone, formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { PaymentDebtBreakdown } from './PaymentDebtBreakdown'
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
  onCancelPayment: () => void
  onEditPayment: () => void
  onViewClientProfile?: () => void
  onPrintReceipt?: () => void
  onDownloadReceipt?: () => void
  /**
   * When set, an edit icon appears next to "Created by" and invokes this
   * callback. The parent is responsible for permission-gating the affordance.
   */
  onReassignEmployee?: () => void
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
  onReassignEmployee,
}: PaymentDetailsModalProps) {
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)
  const hasDebt = Number(payment.newDebt) > 0

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

  const canCancel =
    (payment.status === 'Pending' || payment.status === 'Verified') &&
    isPaymentLessThan7DaysOld(payment.paymentDate)

  const handleEditPayment = () => {
    // Trigger parent to close PaymentDetailsModal and open EditPaymentModal
    onEditPayment()
  }

  const handleCancelPayment = () => {
    // Trigger parent to close PaymentDetailsModal and open CancelPaymentModal
    onCancelPayment()
  }

  const handleDownloadReceipt = async () => {
    try {
      // Delegate the actual download logic to the parent via callback.
      // Different pages (DebtSummary, PaymentHistory) can implement their
      // own receipt generation/downloading using the payment ID.
      if (onDownloadReceipt) {
        onDownloadReceipt()
      } else {
        toast.info('Receipt download is not configured for this view yet.')
      }
    } catch (error) {
      console.error('Error downloading receipt:', error)
      toast.error('Failed to download receipt. Please try again.')
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} maxWidth="3xl">
        <ModalHeader
          icon={
            <div className="bg-primary flex items-center justify-center rounded-full p-2.5">
              <Icons.MoneyReceive01
                size={20}
                className="text-primary-foreground"
                strokeWidth={1.5}
              />
            </div>
          }
          title={t('pages.clients.modals.paymentDetails.title', { paymentId: payment.paymentId })}
          className="pb-6"
        />
        <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-250px)]">
          {/* Action Buttons */}
          {(canCancel || canEditOrCancel) && (
            <div className="mb-4 flex flex-col items-stretch gap-3 self-stretch sm:flex-row sm:gap-5">
              {canCancel && (
                <Button
                  variant="secondary"
                  leftIcon={<Icons.CancelCircle size={18} className="sm:size-5" />}
                  onClick={handleCancelPayment}
                  className="h-12 w-full flex-1 rounded-md sm:w-auto"
                >
                  {t('pages.clients.modals.paymentDetails.cancelPayment')}
                </Button>
              )}
              {canEditOrCancel && (
                <Button
                  variant="primary"
                  leftIcon={<Icons.PencilEdit size={18} className="sm:size-5" />}
                  onClick={handleEditPayment}
                  className="h-12 w-full flex-1 rounded-md sm:w-auto"
                >
                  {t('pages.clients.modals.paymentDetails.editPayment')}
                </Button>
              )}
            </div>
          )}

          {/* Payment Information Section */}
          <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.paymentDetails.paymentInformation')}
              </span>
            </div>
            <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentDetails.paymentId')}{' '}
                      <span className="font-medium">{payment.paymentId}</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-center">
                    <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentDetails.status')}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full',
                          payment.status === 'Verified'
                            ? 'bg-success-200'
                            : payment.status === 'Pending'
                              ? 'bg-muted'
                              : 'bg-error-200'
                        )}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            payment.status === 'Verified'
                              ? 'bg-success-500'
                              : payment.status === 'Pending'
                                ? 'bg-muted-foreground'
                                : 'bg-error-500'
                          )}
                        />
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium sm:text-sm',
                          payment.status === 'Verified'
                            ? 'text-success-500'
                            : payment.status === 'Pending'
                              ? 'text-muted-foreground'
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
                    <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentDetails.amount')}{' '}
                      <span className="font-medium">
                        {formatMoneyUAHTwoDecimals(payment.amount)}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="bg-muted hidden h-[79px] w-px sm:mx-2 sm:block"></div>
                <div className="bg-muted h-px w-full sm:hidden"></div>

                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentDetails.paymentDate')}{' '}
                      <span className="font-medium">
                        {convertUTCToUserTimezone(payment.paymentDate, userTimezone)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentDetails.paymentMethod')}{' '}
                      <span className="font-medium">{payment.method}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
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
              <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
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
            <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col items-start gap-1 self-stretch">
                <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                  <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.clients.modals.paymentDetails.clientId')}
                  </span>
                  <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {payment.clientId}
                  </span>
                </div>
                <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                  <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.clients.modals.paymentDetails.name')}
                  </span>
                  <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {payment.clientName}
                  </span>
                </div>
                <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                  <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.clients.modals.paymentDetails.phone')}
                  </span>
                  <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {payment.phone}
                  </span>
                </div>
                <div className="flex flex-col items-start gap-1 self-stretch sm:flex-row sm:gap-6">
                  <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.clients.modals.paymentDetails.project')}
                  </span>
                  <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {payment.project}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Debt Impact Section */}
          <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
            <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.paymentDetails.debtImpact')}
            </span>
            <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border p-4 px-4 sm:p-5 sm:px-6">
              {/* <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-start sm:gap-5">
                <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                  {t('pages.clients.modals.paymentDetails.debtBefore')}
                </span>
                <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {formatMoneyUAHTwoDecimals(payment.currentDebt)}
                </span>
              </div> */}
              <div className="flex flex-col items-start gap-1 self-stretch">
                <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-center sm:gap-5">
                  <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.clients.modals.paymentDetails.paymentAmount')}
                  </span>
                  <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    - {formatMoneyUAHTwoDecimals(payment.amount)}
                  </span>
                </div>

                <div className="bg-muted my-2 h-px w-full" />

                {/* <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-center sm:gap-5">
                  <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                    {t('pages.clients.modals.paymentDetails.debtAfter')}
                  </span>
                  <span className="text-foreground flex-1 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                    {formatMoneyUAHTwoDecimals(payment.newDebt)}
                  </span>
                </div> */}
              </div>
              <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-center sm:gap-5">
                <span className="text-foreground w-full text-xs leading-[150%] font-light tracking-[-0.28px] sm:w-[120px] sm:text-sm">
                  {t('pages.clients.modals.paymentDetails.clientStatus')}
                </span>
                <div className="flex flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="bg-card flex items-center justify-center gap-1 rounded-full px-3 py-1">
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
                        'text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm',
                        hasDebt ? 'text-success-500' : 'text-error-500'
                      )}
                    >
                      {hasDebt
                        ? t('pages.clients.statuses.active')
                        : t('pages.clients.statuses.paid')}
                    </span>
                  </div>
                  <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                    {hasDebt && t('pages.clients.modals.paymentDetails.stillHasDebt')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Debt Breakdown Section */}
          <PaymentDebtBreakdown paymentId={payment.paymentId} />

          {/* Audit Trail Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.paymentDetails.auditTrail')}
            </span>
            <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-2 self-stretch rounded-xl border p-4 sm:p-6">
              <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-foreground inline-flex items-center gap-1.5 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentDetails.assignedTo')}{' '}
                      <span className="font-medium">{payment.createdBy}</span>
                      {onReassignEmployee && payment.status === 'Verified' && (
                        <button
                          type="button"
                          onClick={onReassignEmployee}
                          className="bg-primary/10 text-primary-700 hover:bg-primary-100 hover:text-primary-800 focus:ring-primary-500 inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors focus:ring-2 focus:outline-none"
                          aria-label={t('pages.clients.modals.paymentDetails.reassignEmployee')}
                          title={t('pages.clients.modals.paymentDetails.reassignEmployee')}
                        >
                          <Icons.PencilEdit02 size={14} strokeWidth={1.5} />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.paymentDetails.createdAt')}{' '}
                      <span className="font-medium">
                        {convertUTCToUserTimezone(payment.createdAt, userTimezone)}
                      </span>
                    </span>
                  </div>
                </div>
                {payment.status === 'Verified' && payment.verifiedBy && payment.verifiedAt && (
                  <>
                    <div className="bg-muted hidden h-[50px] w-px sm:mx-2 sm:block"></div>
                    <div className="bg-muted h-px w-full sm:hidden"></div>
                    <div className="flex flex-1 flex-col items-start gap-2 p-0">
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                          {t('pages.clients.modals.paymentDetails.verifiedBy')}{' '}
                          <span className="font-medium">{payment.verifiedBy}</span>
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                          {t('pages.clients.modals.paymentDetails.verifiedAt')}{' '}
                          <span className="font-medium">
                            {convertUTCToUserTimezone(payment.verifiedAt, userTimezone)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {payment.status === 'Cancelled' && payment.cancelledBy && payment.cancelledAt && (
                  <>
                    <div className="bg-muted hidden h-[50px] w-px sm:mx-2 sm:block"></div>
                    <div className="bg-muted h-px w-full sm:hidden"></div>
                    <div className="flex flex-1 flex-col items-start gap-2 p-0">
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                          {t('pages.clients.modals.paymentDetails.cancelledBy')}{' '}
                          <span className="font-medium">{payment.cancelledBy}</span>
                        </span>
                      </div>
                      <div className="flex items-start gap-6 self-stretch">
                        <span className="text-foreground text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                          {t('pages.clients.modals.paymentDetails.cancelledAt')}{' '}
                          <span className="font-medium">
                            {convertUTCToUserTimezone(payment.cancelledAt, userTimezone)}
                          </span>
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
            <div className="flex w-full flex-col items-stretch gap-3 self-stretch sm:flex-row sm:gap-3">
              <Button
                variant="white-secondary"
                leftIcon={<Icons.Printer size={18} className="sm:size-5" />}
                onClick={onPrintReceipt}
                className="h-12 w-full self-stretch rounded-md sm:w-auto"
              >
                {t('pages.clients.modals.paymentDetails.printReceipt')}
              </Button>
              <Button
                variant="white-secondary"
                leftIcon={<Icons.FileDownload size={18} className="sm:size-5" />}
                onClick={handleDownloadReceipt}
                className="h-12 w-full self-stretch rounded-md sm:w-auto"
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
    </>
  )
}
