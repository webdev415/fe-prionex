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
import { useClient } from '@/features/clients/hooks/useClients'
import { authApi } from '@/features/auth/api/authApi'
import { useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '@/lib/errors'
import { formatDateDotDMY } from '@/lib/formatters'

export interface SendSMSModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  clientName: string
  phoneNumber: string
  loans?: Array<{ id: number; loanNumber: string; totalToRepay: number }>
  onSent?: () => void
}

/**
 * Formats a full name (FirstName MiddleName LastName) into
 * "LastName F. M." format as required for SMS display.
 * Falls back to original string if parsing fails.
 */
const formatClientNameInitials = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 3) {
    const [firstName, middleName, lastName] = parts
    return `${lastName} ${firstName[0].toUpperCase()}. ${middleName[0].toUpperCase()}.`
  }
  if (parts.length === 2) {
    const [firstName, lastName] = parts
    return `${lastName} ${firstName[0].toUpperCase()}.`
  }
  return fullName
}

// Render template message by replacing variables with actual values
const renderTemplateMessage = (
  templateText: string,
  variables: {
    client_name?: string
    debt_amount?: string
    operator_name?: string
    [key: string]: string | undefined
  }
): string => {
  let rendered = templateText
  // Replace all variables in format {variable_name}
  rendered = rendered.replace(/\{(\w+)\}/g, (match, varName) => {
    return variables[varName] !== undefined && variables[varName] !== ''
      ? variables[varName]!
      : match
  })
  return rendered
}

export function SendSMSModal({
  open,
  onClose,
  clientId,
  clientName,
  phoneNumber,
  loans = [],
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

  // Fetch client details (debts, contract_number, max promise date for SMS {due_date})
  const { data: clientData } = useClient(clientId, !!clientId && open)

  // Fetch current user details to get operator phone
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.me(),
    enabled: open, // Only fetch when modal is open
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Get SMS history for today's count
  const today = new Date().toISOString().split('T')[0]
  const { data: historyData } = useSMSHistory(clientId, {
    from_date: today,
    to_date: today,
  })

  // Memoize templates to avoid recreating array on every render
  const templates = useMemo(() => templatesData?.templates || [], [templatesData?.templates])
  const dailyLimit = configData?.max_sms_per_recipient_per_day || 3
  const smsSentToday = historyData?.total || 0

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [message, setMessage] = useState<string>('')
  const [customMessage, setCustomMessage] = useState<string>('')
  const [messageEdited, setMessageEdited] = useState<boolean>(false)
  const [clientNameField, setClientNameField] = useState<string>(
    formatClientNameInitials(clientName)
  )
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(
    loans.length > 0 ? loans[0].id : null
  )

  const selectedLoan = loans.find((l) => l.id === selectedLoanId) ?? loans[0] ?? null

  // Reset form when modal opens/closes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      // Reset form state when modal opens - this is intentional behavior
      setSelectedTemplateId(null)
      setMessage('')
      setCustomMessage('')
      setMessageEdited(false)
      setClientNameField(formatClientNameInitials(clientName))
      setSelectedLoanId(loans.length > 0 ? loans[0].id : null)

      // Set default template if available
      if (templates.length > 0) {
        const defaultTemplate =
          templates.find((tpl) => tpl.name === 'Payment Reminder') || templates[0]
        setSelectedTemplateId(defaultTemplate.id)
        setMessage(defaultTemplate.message_text)
        setMessageEdited(false)
      }
    } else {
      setMessage('')
      setCustomMessage('')
      setMessageEdited(false)
    }
  }, [open, clientName, loans, templates])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Update message when template changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find((t) => t.id === selectedTemplateId)
      if (template) {
        // Update message when template selection changes - this is intentional behavior
        setMessage(template.message_text)
        setMessageEdited(false)
      }
    }
  }, [selectedTemplateId, templates])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Calculate variable values from client data
  const variableValues = useMemo(() => {
    // Prefer the currently selected loan for contract_number.
    // Fallback to first debt for backwards-compatibility when loans aren't provided.
    const contractNumber =
      selectedLoan?.loanNumber ??
      (clientData?.debts && clientData.debts.length > 0 ? clientData.debts[0].contract_number : '')

    // {due_date} = max promise_to_pay_date across this client's interactions (DD.MM.YYYY)
    const dueDate = formatDateDotDMY(clientData?.max_promise_to_pay_date ?? null)

    // Get operator_phone from user API response
    const operatorPhone = currentUserData?.data?.phone || ''

    return {
      client_name: clientNameField,
      debt_amount: selectedLoan ? Number(selectedLoan.totalToRepay).toFixed(2) : '',
      operator_name: user?.username || '',
      operator_phone: operatorPhone,
      due_date: dueDate,
      contract_number: contractNumber,
    }
  }, [clientData, clientNameField, selectedLoan, user?.username, currentUserData])

  // Render template message with variables replaced, or use custom message
  // If message was manually edited, use it as-is (don't re-render)
  const displayMessage = useMemo(() => {
    if (selectedTemplateId && message) {
      if (messageEdited) {
        // Message was manually edited, use it as-is
        return message
      }
      // Render template with all variables
      return renderTemplateMessage(message, variableValues)
    }
    return customMessage
  }, [selectedTemplateId, message, messageEdited, customMessage, variableValues])

  const isDailyLimitReached = smsSentToday >= dailyLimit
  const canSend =
    !isDailyLimitReached && displayMessage.trim().length > 0 && !sendSMSMutation.isPending

  const handleSend = async () => {
    if (!canSend) return

    try {
      const request =
        selectedTemplateId && !messageEdited
          ? {
              client_id: clientId,
              to_number: phoneNumber || undefined,
              template_id: selectedTemplateId,
              variables: {
                client_name: variableValues.client_name,
                debt_amount: variableValues.debt_amount || '0',
                operator_name: variableValues.operator_name,
                operator_phone: variableValues.operator_phone,
                due_date: variableValues.due_date,
                contract_number: variableValues.contract_number,
              },
            }
          : selectedTemplateId && messageEdited
            ? {
                // If template was selected but edited, send as custom message but include template_id to preserve template_name
                client_id: clientId,
                to_number: phoneNumber || undefined,
                custom_message: displayMessage,
                template_id: selectedTemplateId, // Include template_id so backend can save template_name
              }
            : {
                client_id: clientId,
                to_number: phoneNumber || undefined,
                custom_message: displayMessage,
              }

      const response = await sendSMSMutation.mutateAsync(request)

      // Check the status field in response
      if (response.status === 'failed') {
        const isDuplicate =
          response.error_message?.toUpperCase().includes('DUPLICATE') ||
          response.error_code?.toUpperCase().includes('DUPLICATE')

        toast.error(
          isDuplicate
            ? t('pages.clients.modals.sendSMS.smsFailedDuplicate')
            : t('pages.clients.modals.sendSMS.smsFailedToSend')
        )
        // Don't close modal - let user try again or check configuration
        return
      }

      // Success case
      toast.success(
        t('pages.clients.modals.sendSMS.smsSentSuccessfully') || 'SMS sent successfully'
      )
      onSent?.()
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl" className="p-4 sm:p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 self-stretch sm:flex-row sm:items-center sm:gap-0">
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
            <Icons.ChatFeedback01 size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
          </div>
          <span className="text-dark-500 text-xl font-medium sm:text-2xl">
            {t('pages.clients.modals.sendSMS.title')}
          </span>
        </div>
        <div className="flex items-center justify-end gap-1 sm:pr-4">
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              isDailyLimitReached ? 'bg-error-500' : 'bg-success-500'
            )}
          />
          <span className="text-dark-500 text-xs font-light sm:text-base">
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
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Recipient Info */}
          <div className="flex flex-col items-start justify-between gap-2 self-stretch sm:flex-row sm:items-center">
            <span className="text-dark-500 text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
              {t('pages.clients.modals.sendSMS.sendSMSTo')} {clientName}
            </span>
            <span className="text-dark-500 text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
              {phoneNumber}
            </span>
          </div>
          {/* Daily Limit Reached State */}
          {isDailyLimitReached ? (
            <div className="flex flex-col items-center gap-4 self-stretch rounded-xl border border-white bg-white/50 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
              <Icons.MailBlock02
                size={40}
                className="text-error-500 sm:size-12"
                strokeWidth={0.5}
              />
              <p className="text-error-500 self-stretch text-center text-base leading-[132%] font-light tracking-[-0.4px] sm:text-xl">
                {t('pages.clients.modals.sendSMS.dailyLimitReached')}: {smsSentToday}/{dailyLimit}{' '}
                {t('pages.clients.modals.sendSMS.smsSentToThisNumber')}
              </p>
              <p className="text-dark-500 self-stretch text-center text-sm leading-[150%] font-light tracking-[-0.36px] sm:text-[18px]">
                {t('pages.clients.modals.sendSMS.nextSMSAvailableTomorrow')}{' '}
                <span className="font-medium">00:00</span>
              </p>
            </div>
          ) : (
            <>
              {/* Template Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-950 sm:text-sm">
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
                <label className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-950 sm:text-sm">
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
                  className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 min-h-[100px] resize-none rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 sm:min-h-[120px] sm:text-sm"
                />
              </div>

              {/* Client Name and Loan Number */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-950 sm:text-sm">
                    {t('pages.clients.modals.sendSMS.clientName')}:
                  </label>
                  <input
                    type="text"
                    value={clientNameField}
                    onChange={(e) => setClientNameField(e.target.value)}
                    readOnly
                    className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light focus:ring-2 focus:outline-none sm:text-sm"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-950 sm:text-sm">
                    {t('pages.clients.modals.sendSMS.loanNumber')}:
                  </label>
                  {loans.length > 0 ? (
                    <Select
                      value={selectedLoanId?.toString() ?? ''}
                      onValueChange={(value) => setSelectedLoanId(Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {loans.map((loan) => (
                          <SelectItem key={loan.id} value={loan.id.toString()}>
                            {loan.loanNumber} — ₴{Number(loan.totalToRepay).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type="text"
                      value="—"
                      readOnly
                      className="text-dark-500 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light sm:text-sm"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ModalContent>

      {/* Footer */}
      <ModalFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
        <Button variant="cancel" size="sm" onClick={onClose} className="w-full rounded-md">
          {t('actions.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={!canSend || sendSMSMutation.isPending}
          className="w-full rounded-md"
          leftIcon={<Icons.MailSend01 size={18} className="sm:size-5" />}
        >
          {sendSMSMutation.isPending
            ? t('pages.clients.modals.sendSMS.sending') || 'Sending...'
            : t('pages.clients.modals.sendSMS.sendSMS')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default SendSMSModal
