/**
 * Cancel Payment Modal
 *
 * Modal for confirming payment cancellation with detailed information and warnings.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { convertUTCToUserTimezone } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface PaymentToCancel {
  paymentId: string
  client: string
  amount: number
  paymentDate: string
  method: string
  reference: string
  status: 'Verified' | 'Pending' | 'Cancelled'
  createdBy: string
  createdAt: string
  currentDebt: number
}

export interface CancelPaymentModalProps {
  open: boolean
  onClose: () => void
  payment: PaymentToCancel
  onConfirm: (data: { reason: string; additionalDetails: string }) => void
}

export function CancelPaymentModal({ open, onClose, payment, onConfirm }: CancelPaymentModalProps) {
  const { t, i18n } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return `₴ ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
  const [reason, setReason] = useState<string>('')
  const [additionalDetails, setAdditionalDetails] = useState<string>('')
  const [isConfirmed, setIsConfirmed] = useState(false)

  const cancelledAmount = payment.amount
  const newDebtAfterCancel = payment.currentDebt + cancelledAmount
  const debtIncrease = cancelledAmount

  const minDetailsLength = 20
  const maxDetailsLength = 100
  const detailsLength = additionalDetails.length
  const isDetailsValid = detailsLength >= minDetailsLength && detailsLength <= maxDetailsLength

  const canConfirm = reason && isDetailsValid && isConfirmed

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({ reason, additionalDetails })
    // Reset form
    setReason('')
    setAdditionalDetails('')
    setIsConfirmed(false)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setReason('')
    setAdditionalDetails('')
    setIsConfirmed(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.CancelCircle size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.cancelPayment.title')}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-200px)]">
        {/* Warning Banner */}
        <div className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white bg-white/50 px-6 py-3">
          <Icons.Warning size={24} className="text-error-500" />
          <span className="text-error-500 text-center text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.cancelPayment.warning')}
          </span>
        </div>

        <div className="mb-4 flex flex-col items-start gap-4 self-stretch">
          {/* Payment to Cancel Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.cancelPayment.paymentToCancel')}
              </span>
            </div>
            <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-start sm:gap-3">
                <div className="flex flex-1 flex-col items-start gap-1 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.paymentId')}{' '}
                      <span className="font-medium">{payment.paymentId}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.client')}{' '}
                      <span className="font-medium">{payment.client}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.amount')}{' '}
                      <span className="font-medium">{formatCurrency(payment.amount)}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.paymentDate')}{' '}
                      <span className="font-medium">
                        {convertUTCToUserTimezone(payment.paymentDate, userTimezone)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.method')}{' '}
                      <span className="font-medium">{payment.method}</span>
                    </span>
                  </div>
                </div>

                <div className="hidden h-[121px] w-px bg-gray-200 sm:mx-2 sm:block"></div>
                <div className="h-px w-full bg-gray-200 sm:hidden"></div>

                <div className="flex flex-1 flex-col items-start gap-1 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.reference')}{' '}
                      <span className="font-medium">{payment.reference}</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-start">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.status')}
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
                          'text-xs font-medium sm:text-sm',
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
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.reference')}{' '}
                      <span className="font-medium">{payment.paymentDate}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.created')}{' '}
                      <span className="font-medium">{payment.createdBy}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.created')}{' '}
                      <span className="font-medium">
                        {convertUTCToUserTimezone(payment.createdAt, userTimezone)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Impact on Client Section */}
          <div className="flex flex-col items-start gap-2 self-stretch">
            <div className="flex flex-col items-start gap-2 self-stretch">
              <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.modals.cancelPayment.impactOnClient')}
              </span>
            </div>
            <div className="flex w-full flex-col items-start justify-center gap-2 rounded-xl border border-white bg-white/50 px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col items-start gap-4 self-stretch sm:flex-row sm:items-center sm:gap-3">
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.currentDebt')}{' '}
                      <span className="font-medium">{formatCurrency(payment.currentDebt)}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-6 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.cancelledPayment')}{' '}
                      <span className="font-medium">+{formatCurrency(cancelledAmount)}</span>
                    </span>
                  </div>
                </div>
                <div className="hidden w-[26px] self-stretch sm:block">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="27"
                    height="51"
                    viewBox="0 0 27 51"
                    fill="none"
                  >
                    <path d="M4.36595 0.23175L17.4429 25.2318L4.36595 50.2317" stroke="#DFDFDF" />
                    <path d="M0.443097 0.23175L13.52 25.2318L0.443095 50.2317" stroke="#DFDFDF" />
                  </svg>
                </div>
                <div className="h-px w-full bg-gray-200 sm:hidden"></div>
                <div className="flex flex-1 flex-col items-start gap-2 p-0">
                  <div className="flex flex-col items-start gap-1 self-stretch">
                    <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                      {t('pages.clients.modals.cancelPayment.newDebtAfterCancel')}
                    </span>
                    <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                      {formatCurrency(newDebtAfterCancel)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="my-2 h-px w-full bg-gray-200" />
              <div className="flex items-center justify-center gap-1 self-stretch">
                <Icons.ArrowUp02 size={14} className="text-error-500 sm:size-4" />
                <span className="text-error-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.cancelPayment.clientDebtWillIncrease')}{' '}
                  {formatCurrency(debtIncrease)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cancellation Reason Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <div className="flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.clients.modals.cancelPayment.cancellationReason')}
            </span>
          </div>
          <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-4 px-4 sm:p-5 sm:px-6">
            <div className="flex flex-col items-start gap-1 self-stretch">
              <Label
                required
                className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]"
              >
                {t('pages.clients.modals.cancelPayment.selectReason')}
              </Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1.5 h-[45px] w-full">
                  <SelectValue
                    placeholder={t('pages.clients.modals.cancelPayment.selectReasonOfCancellation')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incorrect Amount">
                    {t('pages.clients.modals.cancelPayment.incorrectAmount')}
                  </SelectItem>
                  <SelectItem value="Duplicate Payment">
                    {t('pages.clients.modals.cancelPayment.duplicatePayment')}
                  </SelectItem>
                  <SelectItem value="Payment Error">
                    {t('pages.clients.modals.cancelPayment.paymentError')}
                  </SelectItem>
                  <SelectItem value="Client Request">
                    {t('pages.clients.modals.cancelPayment.clientRequest')}
                  </SelectItem>
                  <SelectItem value="Other">
                    {t('pages.clients.modals.cancelPayment.other')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-start gap-2 self-stretch">
              <Label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
                {t('pages.clients.modals.cancelPayment.additionalDetails')}
              </Label>
              <div className="relative w-full">
                <Textarea
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder={t('pages.clients.modals.cancelPayment.requiredMin20Characters')}
                  textareaSize="md"
                  variant={detailsLength > 0 && !isDetailsValid ? 'error' : 'default'}
                  maxLength={maxDetailsLength}
                  className="pr-16"
                />
                <div className="absolute right-4 bottom-3 text-xs text-gray-500">
                  {detailsLength}/{maxDetailsLength}
                </div>
              </div>
              {detailsLength > 0 && detailsLength < minDetailsLength && (
                <p className="text-error-500 mt-1.5 text-xs">
                  {t('pages.clients.modals.cancelPayment.minimumCharactersRequired', {
                    min: minDetailsLength,
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Consequences Section */}
        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.modals.cancelPayment.consequences')}
          </span>
          <div className="flex flex-col items-start justify-center gap-2.5 self-stretch rounded-xl border border-white/50 bg-white/50 p-5 px-6">
            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={18} className="text-gray-700 sm:size-5" />
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.cancelPayment.paymentStatusCancelled')}{' '}
                  <span className="font-medium">
                    {t('pages.clients.modals.cancelPayment.cancelled')}
                  </span>
                </span>
              </div>
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={18} className="text-gray-700 sm:size-5" />
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.cancelPayment.clientDebtRestored')}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={18} className="text-gray-700 sm:size-5" />
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.cancelPayment.receiptInvalidated')}
                </span>
              </div>
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={18} className="text-gray-700 sm:size-5" />
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.cancelPayment.cannotBeUndone')}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-1 items-start gap-1">
                <Icons.ArrowRight02 size={18} className="text-gray-700 sm:size-5" />
                <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                  {t('pages.clients.modals.cancelPayment.loggedInAuditTrail')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="flex items-center gap-1 self-stretch">
          <Checkbox
            checked={isConfirmed}
            onCheckedChange={(checked) => setIsConfirmed(checked === true)}
            id="confirm-cancellation"
          />
          <Label
            htmlFor="confirm-cancellation"
            className="text-dark-500 cursor-pointer text-sm leading-[150%] font-medium tracking-[-0.28px]"
          >
            {t('pages.clients.modals.cancelPayment.iConfirmThisCancellationIsCorrect')}
          </Label>
        </div>
      </ModalContent>
      <ModalFooter className="flex flex-col items-stretch gap-4 self-stretch border-none sm:flex-row sm:items-start">
        <Button
          variant="cancel"
          onClick={handleClose}
          className="h-12 w-full self-stretch rounded-md p-0"
        >
          {t('pages.clients.modals.recordPayment.cancel')}
        </Button>
        <div className="flex w-full flex-col items-center gap-2 self-stretch">
          <Button
            variant="primary"
            leftIcon={<Icons.Success size={18} className="text-dark-500" />}
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="h-12 w-full self-stretch rounded-md p-0 sm:w-auto"
          >
            {t('pages.clients.modals.cancelPayment.confirmCancellation')}
          </Button>
          <p className="text-xs leading-[150%] font-light tracking-[-0.28px] text-gray-700 sm:text-sm">
            {t('pages.clients.modals.cancelPayment.requiresSupervisorApproval')}
          </p>
        </div>
      </ModalFooter>
    </Modal>
  )
}
