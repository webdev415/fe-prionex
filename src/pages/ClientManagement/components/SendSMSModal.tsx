/**
 * Send SMS Modal Component
 *
 * Modal for sending SMS messages with template selection, message composition,
 * character counting, and daily limit checking.
 */

import { useState, useMemo, useEffect } from 'react'
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface SendSMSModalProps {
  open: boolean
  onClose: () => void
  clientName: string
  phoneNumber: string
  debtAmount?: number
  onSend: (data: {
    template: string
    message: string
    clientName: string
    debtAmount: string
  }) => void
}

const SMS_TEMPLATES = [
  'Payment Reminder',
  'Payment Overdue',
  'Payment Confirmation',
  'Loan Information',
  'Custom Message',
]

// Mock daily SMS limit tracking (in real app, this would come from API)
const DAILY_SMS_LIMIT = 3
let dailySMSCount = 1 // Mock: start with 1 sent today

const calculateSMSParts = (message: string): number => {
  const hasCyrillic = /[А-Яа-яЁё]/.test(message)
  const maxLength = hasCyrillic ? 70 : 160
  return Math.ceil(message.length / maxLength)
}

const calculateCost = (smsParts: number): number => {
  return smsParts * 1.0 // 1.00 per SMS part
}

export function SendSMSModal({
  open,
  onClose,
  clientName,
  phoneNumber,
  debtAmount = 0,
  onSend,
}: SendSMSModalProps) {
  const [template, setTemplate] = useState<string>('Payment Reminder')
  const [message, setMessage] = useState<string>('')
  const [clientNameField, setClientNameField] = useState<string>(clientName)
  const [debtAmountField, setDebtAmountField] = useState<string>(
    debtAmount > 0 ? debtAmount.toFixed(2) : ''
  )
  const [smsSentToday, setSmsSentToday] = useState<number>(dailySMSCount)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setTemplate('Payment Reminder')
      setMessage('Dear Ivan, we remind you of the debt of 25,000 UAH Contact: Maria')
      setClientNameField(clientName)
      setDebtAmountField(debtAmount > 0 ? debtAmount.toFixed(2) : '')
      setSmsSentToday(dailySMSCount)
    } else {
      setMessage('')
    }
  }, [open, clientName, debtAmount])

  // Calculate message metrics
  const messageMetrics = useMemo(() => {
    const hasCyrillic = /[А-Яа-яЁё]/.test(message)
    const maxChars = hasCyrillic ? 70 : 160
    const charCount = message.length
    const smsParts = calculateSMSParts(message)
    const cost = calculateCost(smsParts)
    const exceedsLimit = charCount > maxChars

    return {
      charCount,
      maxChars,
      smsParts,
      cost,
      hasCyrillic,
      exceedsLimit,
    }
  }, [message])

  const isDailyLimitReached = smsSentToday >= DAILY_SMS_LIMIT
  const canSend = !isDailyLimitReached && message.trim().length > 0

  const handleSend = () => {
    if (!canSend) return

    onSend({
      template,
      message,
      clientName: clientNameField,
      debtAmount: debtAmountField,
    })
    // Increment daily count (mock)
    dailySMSCount++
    setSmsSentToday(dailySMSCount)
    onClose()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl" className="p-10">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between self-stretch">
          <div className="flex items-center gap-6">
            <div className="bg-primary-300 flex h-12 w-12 items-center justify-center rounded-full">
              <Icons.ChatFeedback01 size={24} className="text-dark-500" strokeWidth={1.5} />
            </div>
            <span className="text-dark-500 text-2xl font-medium">Send SMS</span>
          </div>
          <div className="flex items-center justify-end gap-1 pr-4">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isDailyLimitReached ? 'bg-error-500' : 'bg-success-500'
              )}
            />
            <span className="text-dark-500 text-base font-light">
              SMS sent today:{' '}
              <span className="font-medium">
                {smsSentToday}/{DAILY_SMS_LIMIT}
              </span>
            </span>
          </div>
        </div>
        <div className="flex h-px flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>
        {/* Content */}
        <ModalContent className="p-0">
          <div className="flex flex-col gap-6">
            {/* Recipient Info */}
            <div className="flex items-start justify-between self-stretch">
              <span className="text-dark-500 text-base leading-[155%] font-light tracking-[-0.32px]">
                Send SMS to {clientName}
              </span>
              <span className="text-dark-500 text-base leading-[155%] font-light tracking-[-0.32px]">
                {phoneNumber}
              </span>
            </div>
            {/* Daily Limit Reached State */}
            {isDailyLimitReached ? (
              <div className="flex flex-col items-center gap-5 self-stretch rounded-xl border border-white bg-white/50 px-6 py-5">
                <Icons.MailBlock02 size={48} className="text-error-500" strokeWidth={0.5} />
                <p className="text-error-500 self-stretch text-center text-xl leading-[132%] font-light tracking-[-0.4px]">
                  Daily limit reached: {smsSentToday}/{DAILY_SMS_LIMIT} SMS sent to this number
                </p>
                <p className="text-dark-500 self-stretch text-center text-[18px] leading-[150%] font-light tracking-[-0.36px]">
                  Next SMS available tomorrow at <span className="font-medium">00:00</span>
                </p>
              </div>
            ) : (
              <>
                {/* Template */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                    Template:
                  </label>
                  <Select value={template} onValueChange={setTemplate}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {SMS_TEMPLATES.map((tpl) => (
                        <SelectItem key={tpl} value={tpl}>
                          {tpl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                    Message:
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 min-h-[120px] resize-none rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none"
                  />
                </div>

                {/* Message Metrics */}
                <div className="flex flex-col items-start justify-center gap-5 self-stretch rounded-xl border border-white bg-white/50 px-6 py-5">
                  <div className="flex items-center gap-5 self-stretch">
                    <div className="flex flex-1 items-center gap-1">
                      <div
                        className={cn(
                          'h-2 w-2 rounded-full',
                          messageMetrics.exceedsLimit ? 'bg-error-500' : 'bg-success-500'
                        )}
                      />
                      <span className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                        {messageMetrics.charCount}/{messageMetrics.maxChars} characters
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <Icons.TypeCursor size={20} className="text-gray-600" />
                      <span className="text-dark-500 text-sm font-light">
                        Script:{' '}
                        <span className="text-dark-500 font-medium">
                          {messageMetrics.hasCyrillic ? 'Cyrillic' : 'Latin'}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 self-stretch">
                    <div className="flex flex-1 items-center gap-2">
                      <Icons.Mail size={20} className="text-gray-600" />
                      <span className="text-dark-500 text-sm font-medium">
                        {messageMetrics.smsParts}{' '}
                        <span className="font-light">
                          {messageMetrics.smsParts !== 1 ? 'SMS parts' : 'SMS part'}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <Icons.Money04 size={20} className="text-gray-600" />
                      <span className="text-dark-500 text-sm font-light">
                        Cost:{' '}
                        <span className="text-dark-500 font-medium">
                          ₴{formatCurrency(messageMetrics.cost)}
                        </span>
                      </span>
                    </div>
                  </div>
                  {/* Warning if exceeds limit */}
                  {messageMetrics.exceedsLimit && (
                    <div className="flex items-center justify-center gap-2 self-stretch">
                      <Icons.Warning size={20} className="text-warning-500" strokeWidth={2} />
                      <span className="text-error-500 text-sm font-medium">
                        Message will be split into {messageMetrics.smsParts} SMS parts
                      </span>
                    </div>
                  )}
                </div>

                {/* Client Name and Debt Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                      Client name:
                    </label>
                    <input
                      type="text"
                      value={clientNameField}
                      onChange={(e) => setClientNameField(e.target.value)}
                      className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                      Debt amount:
                    </label>
                    <input
                      type="text"
                      value={debtAmountField}
                      onChange={(e) => setDebtAmountField(e.target.value)}
                      className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </ModalContent>

        {/* Footer */}
        <ModalFooter>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="text-dark-500 border-gray-400 bg-white hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'bg-primary-300 text-dark-500 hover:bg-primary-400',
              !canSend && 'cursor-not-allowed opacity-50'
            )}
          >
            <Icons.MailSend01 size={20} className="mr-2" />
            Send SMS
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default SendSMSModal
