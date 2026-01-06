/**
 * Send SMS Modal Component
 *
 * Modal for sending SMS messages with template selection, message composition,
 * character counting, and daily limit checking.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { useSMSTemplates, useSendSMS, useSMSConfig, useSMSHistory } from '@/features/sms'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/lib/errors'

export interface SendSMSModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  clientName: string
  phoneNumber: string
  debtAmount?: number
  onSent?: () => void
}

const calculateSMSParts = (message: string): number => {
  const hasCyrillic = /[\u0400-\u04FF]/.test(message)
  const maxLength = hasCyrillic ? 70 : 120
  return Math.ceil(message.length / maxLength)
}

const calculateCost = (smsParts: number, baseCost: number): number => {
  return smsParts * baseCost
}

// Render template message by replacing variables with actual values
const renderTemplateMessage = (
  templateText: string,
  variables: { client_name?: string; debt_amount?: string; operator_name?: string; [key: string]: string | undefined }
): string => {
  let rendered = templateText
  // Replace all variables in format {variable_name}
  rendered = rendered.replace(/\{(\w+)\}/g, (match, varName) => {
    return variables[varName] !== undefined && variables[varName] !== '' ? variables[varName]! : match
  })
  return rendered
}

export function SendSMSModal({
  open,
  onClose,
  clientId,
  clientName,
  phoneNumber,
  debtAmount = 0,
  onSent,
}: SendSMSModalProps) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  
  // API hooks
  const { data: templatesData, isLoading: isLoadingTemplates } = useSMSTemplates(
    user?.active_project_id ? { project_id: parseInt(user.active_project_id) } : undefined
  )
  const { data: configData } = useSMSConfig(
    user?.active_project_id ? parseInt(user.active_project_id) : undefined
  )
  const sendSMSMutation = useSendSMS()
  
  // Get SMS history for today's count
  const today = new Date().toISOString().split('T')[0]
  const { data: historyData } = useSMSHistory(clientId, {
    from_date: today,
    to_date: today,
  })

  const templates = templatesData?.templates || []
  const baseCost = configData?.base_cost_uah || 0.5
  const dailyLimit = configData?.max_sms_per_recipient_per_day || 3
  const smsSentToday = historyData?.total || 0

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [message, setMessage] = useState<string>('')
  const [customMessage, setCustomMessage] = useState<string>('')
  const [messageEdited, setMessageEdited] = useState<boolean>(false)
  const [clientNameField, setClientNameField] = useState<string>(clientName)
  const [debtAmountField, setDebtAmountField] = useState<string>(
    debtAmount > 0 ? debtAmount.toFixed(2) : ''
  )

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedTemplateId(null)
      setMessage('')
      setCustomMessage('')
      setMessageEdited(false)
      setClientNameField(clientName)
      setDebtAmountField(debtAmount > 0 ? debtAmount.toFixed(2) : '')
      
      // Set default template if available
      if (templates.length > 0) {
        const defaultTemplate = templates.find(tpl => tpl.name === 'Payment Reminder') || templates[0]
        setSelectedTemplateId(defaultTemplate.id)
        setMessage(defaultTemplate.message_text)
        setMessageEdited(false)
      }
    } else {
      setMessage('')
      setCustomMessage('')
      setMessageEdited(false)
    }
  }, [open, clientName, debtAmount, templates])

  // Update message when template changes
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find((t) => t.id === selectedTemplateId)
      if (template) {
        setMessage(template.message_text)
        setMessageEdited(false)
      }
    }
  }, [selectedTemplateId, templates])

  // Render template message with variables replaced, or use custom message
  // If message was manually edited, use it as-is (don't re-render)
  const displayMessage = useMemo(() => {
    if (selectedTemplateId && message) {
      if (messageEdited) {
        // Message was manually edited, use it as-is
        return message
      }
      // Render template with variables
      return renderTemplateMessage(message, {
        client_name: clientNameField,
        debt_amount: debtAmountField,
        operator_name: user?.username || '',
      })
    }
    return customMessage
  }, [selectedTemplateId, message, messageEdited, customMessage, clientNameField, debtAmountField, user?.username])

  // Calculate message metrics
  const messageMetrics = useMemo(() => {
    const msg = displayMessage
    const hasCyrillic = /[\u0400-\u04FF]/.test(msg)
    const maxChars = hasCyrillic ? 70 : 120
    const charCount = msg.length
    const smsParts = calculateSMSParts(msg)
    const cost = calculateCost(smsParts, baseCost)
    const exceedsLimit = charCount > maxChars

    return {
      charCount,
      maxChars,
      smsParts,
      cost,
      hasCyrillic,
      exceedsLimit,
    }
  }, [displayMessage, baseCost])

  const isDailyLimitReached = smsSentToday >= dailyLimit
  const canSend = !isDailyLimitReached && displayMessage.trim().length > 0 && !sendSMSMutation.isPending

  const handleSend = async () => {
    if (!canSend) return

    try {
      const request =
        selectedTemplateId && !messageEdited
          ? {
              client_id: clientId,
              template_id: selectedTemplateId,
              variables: {
                client_name: clientNameField,
                debt_amount: debtAmountField || '0',
              },
            }
          : selectedTemplateId && messageEdited
            ? {
                // If template was selected but edited, send as custom message but include template_id to preserve template_name
                client_id: clientId,
                custom_message: displayMessage,
                template_id: selectedTemplateId, // Include template_id so backend can save template_name
              }
            : {
                client_id: clientId,
                custom_message: displayMessage,
              }

      await sendSMSMutation.mutateAsync(request)
      toast.success(t('pages.clients.modals.sendSMS.smsSentSuccessfully') || 'SMS sent successfully')
      onSent?.()
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
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
            <span className="text-dark-500 text-2xl font-medium">
              {t('pages.clients.modals.sendSMS.title')}
            </span>
          </div>
          <div className="flex items-center justify-end gap-1 pr-4">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isDailyLimitReached ? 'bg-error-500' : 'bg-success-500'
              )}
            />
            <span className="text-dark-500 text-base font-light">
              {t('pages.clients.modals.sendSMS.smsSentToday')}:{' '}
              <span className="font-medium">
                {smsSentToday}/{dailyLimit}
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
                {t('pages.clients.modals.sendSMS.sendSMSTo')} {clientName}
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
                  {t('pages.clients.modals.sendSMS.dailyLimitReached')}: {smsSentToday}/
                  {dailyLimit} {t('pages.clients.modals.sendSMS.smsSentToThisNumber')}
                </p>
                <p className="text-dark-500 self-stretch text-center text-[18px] leading-[150%] font-light tracking-[-0.36px]">
                  {t('pages.clients.modals.sendSMS.nextSMSAvailableTomorrow')}{' '}
                  <span className="font-medium">00:00</span>
                </p>
              </div>
            ) : (
              <>
                {/* Template Selection */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                    {t('pages.clients.modals.sendSMS.template')}:
                  </label>
                  <Select
                    value={selectedTemplateId?.toString() || 'custom'}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setSelectedTemplateId(null)
                        setCustomMessage('')
                      } else {
                        setSelectedTemplateId(parseInt(value, 10))
                      }
                    }}
                  >
                    <SelectTrigger className="w-full" disabled={isLoadingTemplates}>
                      <SelectValue
                        placeholder={
                          isLoadingTemplates
                            ? t('pages.clients.modals.sendSMS.loadingTemplates') || 'Loading...'
                            : t('pages.clients.modals.sendSMS.selectTemplate')
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">
                        {t('pages.clients.modals.sendSMS.customMessage') || 'Custom Message'}
                      </SelectItem>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id.toString()}>
                          {tpl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                    {t('pages.clients.modals.sendSMS.message')}:
                  </label>
                  <textarea
                    value={displayMessage}
                    onChange={(e) => {
                      if (selectedTemplateId) {
                        setMessage(e.target.value)
                        setMessageEdited(true)
                      } else {
                        setCustomMessage(e.target.value)
                      }
                    }}
                    disabled={!!selectedTemplateId && isLoadingTemplates}
                    placeholder={t('pages.clients.modals.sendSMS.typeYourMessageHere')}
                    className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 min-h-[120px] resize-none rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        {messageMetrics.charCount}/{messageMetrics.maxChars}{' '}
                        {t('pages.clients.modals.sendSMS.characters')}
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <Icons.TypeCursor size={20} className="text-gray-600" />
                      <span className="text-dark-500 text-sm font-light">
                        {t('pages.clients.modals.sendSMS.script')}:{' '}
                        <span className="text-dark-500 font-medium">
                          {messageMetrics.hasCyrillic
                            ? t('pages.clients.modals.sendSMS.cyrillic')
                            : t('pages.clients.modals.sendSMS.latin')}
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
                          {messageMetrics.smsParts !== 1
                            ? t('pages.clients.modals.sendSMS.smsParts')
                            : t('pages.clients.modals.sendSMS.smsPart')}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <Icons.Money04 size={20} className="text-gray-600" />
                      <span className="text-dark-500 text-sm font-light">
                        {t('pages.clients.modals.sendSMS.cost')}:{' '}
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
                        {t('pages.clients.modals.sendSMS.messageWillBeSplit')}{' '}
                        {messageMetrics.smsParts} {t('pages.clients.modals.sendSMS.smsParts')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Client Name and Debt Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-950">
                      {t('pages.clients.modals.sendSMS.clientName')}:
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
                      {t('pages.clients.modals.sendSMS.debtAmount')}:
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
          <Button variant="cancel" size="md" onClick={onClose} className="flex-1">
            {t('actions.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            disabled={!canSend || sendSMSMutation.isPending}
            className="flex-1"
            leftIcon={<Icons.MailSend01 size={20} className="mr-2" />}
          >
            {sendSMSMutation.isPending
              ? t('pages.clients.modals.sendSMS.sending') || 'Sending...'
              : t('pages.clients.modals.sendSMS.sendSMS')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default SendSMSModal
