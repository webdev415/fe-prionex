/**
 * Payment Details Modal
 *
 * Modal for viewing detailed information about a payment.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { EditPaymentModal } from './EditPaymentModal'
import { generatePaymentReceiptPDF } from '@/lib/pdfReceiptGenerator'

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
  onCancelPayment: _onCancelPayment, // Not used - Cancel Payment button is disabled
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

  const handleEditPayment = () => {
    setIsEditModalOpen(true)
    if (onEditPayment) {
      onEditPayment()
    }
  }

  const handleSaveEdit = (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Card Payment' | 'Other'
    reference: string
  }) => {
    if (onSaveEdit) {
      onSaveEdit(data)
    }
    setIsEditModalOpen(false)
  }

  // Convert payment method to EditPaymentModal format
  const getPaymentMethod = (): 'Bank Transfer' | 'Card Payment' | 'Other' => {
    if (payment.method === 'Bank' || payment.method === 'Bank Transfer') {
      return 'Bank Transfer'
    }
    if (payment.method === 'Card' || payment.method === 'Card Payment') {
      return 'Card Payment'
    }
    return 'Other'
  }

  const handleDownloadReceipt = () => {
    // Generate receipt number in format RCP-YYYY-MM-XXX
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    // Extract number from payment ID or use a default
    const paymentNum = payment.paymentId.match(/\d+/)?.[0] || '000'
    const receiptNumber = `RCP-${year}-${month}-${paymentNum.padStart(3, '0')}`

    // Calculate days past due (mock calculation - replace with actual data)
    const paymentDate = new Date(payment.paymentDate)
    const today = new Date()
    const daysPastDue = Math.floor(
      (today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Format payment method to match template
    const formatPaymentMethod = (method: string): string => {
      if (method === 'Bank' || method === 'Bank Transfer') {
        return 'Bank Transfer'
      }
      if (method === 'Card' || method === 'Card Payment') {
        return 'Card Payment'
      }
      return method
    }

    // Generate PDF receipt
    // Use payment date for dateIssued if available, otherwise use createdAt
    const dateIssued = payment.paymentDate || payment.createdAt

    generatePaymentReceiptPDF({
      receiptNumber,
      paymentId: payment.reference || payment.paymentId,
      dateIssued: dateIssued,
      clientName: payment.clientName,
      clientId: payment.clientId,
      phone: payment.phone,
      contract: `CONTRACT-${new Date(payment.createdAt).getFullYear()}-${payment.clientId.padStart(4, '0')}`,
      paymentDate: payment.paymentDate,
      paymentMethod: formatPaymentMethod(payment.method),
      transactionRef: payment.reference,
      paymentAmount: payment.amount,
      daysPastDue: daysPastDue > 0 ? daysPastDue : 0,
      status: payment.status === 'Verified' ? 'ACTIVE' : payment.status.toUpperCase(),
      outstandingBalanceBefore: payment.currentDebt + payment.amount,
      paymentApplied: payment.amount,
      remainingBalance: payment.newDebt,
      receivedBy: payment.createdBy,
      verifiedBy: payment.verifiedBy,
      verifiedOn: payment.verifiedAt,
      companyName: 'PrivatBank Debt Collection',
      companyAddress: 'Kyiv, Ukraine, 01001',
      companyPhone: '+380 44 123 4567',
      companyEmail: 'collections@privatbank.ua',
    })

    // Call the optional callback
    if (onDownloadReceipt) {
      onDownloadReceipt()
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
          {/* Action Buttons */}
          <div className="mb-4 flex items-center gap-5 self-stretch">
            <Button
              variant="secondary"
              leftIcon={<Icons.CancelCircle size={20} />}
              onClick={() => {
                // Cancel Payment button should not do anything
                // Only "Reject Payment" in PaymentVerificationQueueModal opens CancelPaymentModal
              }}
              className="h-12 flex-1 rounded-md"
            >
              {t('pages.clients.modals.paymentDetails.cancelPayment')}
            </Button>
            <Button
              variant="primary"
              leftIcon={<Icons.PencilEdit size={20} />}
              onClick={handleEditPayment}
              className="h-12 flex-1 rounded-md"
            >
              {t('pages.clients.modals.paymentDetails.editPayment')}
            </Button>
          </div>

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
                  {t('pages.clients.modals.paymentDetails.currentTotalDebt')}
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
                    {t('pages.clients.modals.paymentDetails.paymentAmount')}
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
                <div className="mx-2 h-[50px] w-px bg-gray-200"></div>
                {/* {payment.verifiedBy && payment.verifiedAt && ( */}
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
                {/* )} */}
              </div>
            </div>
          </div>
        </ModalContent>
        <ModalFooter className="flex flex-col self-stretch border-none">
          <div className="flex items-center gap-3 self-stretch">
            <Button
              variant="white-secondary"
              leftIcon={<Icons.Printer size={20} />}
              onClick={onPrintReceipt}
              className="h-12 flex-1 rounded-md"
            >
              {t('pages.clients.modals.paymentDetails.printReceipt')}
            </Button>
            <Button
              variant="white-secondary"
              leftIcon={<Icons.FileDownload size={20} />}
              onClick={handleDownloadReceipt}
              className="h-12 flex-1 rounded-md"
            >
              {t('pages.clients.modals.paymentDetails.downloadReceiptPDF')}
            </Button>
          </div>
          <Button variant="cancel" onClick={onClose} className="flex h-12 self-stretch rounded-md">
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
        }}
        onSave={handleSaveEdit}
      />
    </>
  )
}
