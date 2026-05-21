import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { useClient } from '@/features/clients/hooks/useClients'
import { authApi } from '@/features/auth/api/authApi'
import { useAuthStore } from '@/stores/authStore'
import {
  MESSAGING_CHANNELS,
  buildClientMessagingVariables,
  collectClientPhones,
  getChannelDestinationLabel,
  getMessagingServiceLabel,
  isMessagingIntegrationUsable,
  renderMessagingTemplate,
  resolveCurrentUserFromQuery,
  resolveDestinationPhone,
  useDestinationQuota,
  useMessagingDrafts,
  useMessagingIntegrations,
  useSendMessage,
  MessagingVariablesPalette,
  insertMessagingVariableAtCursor,
  type MessagingTemplateFocusField,
} from '@/features/messaging'
import type { MessagingChannel, MessagingDraft } from '@/features/messaging'
import { CHANNEL_SPECS } from '@/pages/MessagingDrafts/draftModalShared'
import { SendMessageModalSkeleton } from './SendMessageModalSkeleton'

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

function draftSnapshotMatches(
  draft: MessagingDraft,
  body: string,
  subject: string,
  senderName: string
): boolean {
  return (
    body.trim() === draft.body.trim() &&
    (subject.trim() || '') === (draft.subject || '').trim() &&
    (senderName.trim() || '') === (draft.sender_name || '').trim()
  )
}

function applyDraftContent(
  draft: MessagingDraft,
  channel: MessagingChannel,
  setters: {
    setBody: (body: string) => void
    setSubject: (subject: string) => void
    setSenderName: (sender: string) => void
  }
) {
  const spec = CHANNEL_SPECS[channel]
  setters.setBody(draft.body)
  setters.setSubject(spec.showSubject ? draft.subject || '' : '')
  setters.setSenderName((draft.sender_name || '').slice(0, spec.senderMaxLength))
}

function resetMessageFields(setters: {
  setBody: (body: string) => void
  setSubject: (subject: string) => void
  setSenderName: (sender: string) => void
}) {
  setters.setBody('')
  setters.setSubject('')
  setters.setSenderName('')
}

export interface SendMessageModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  clientName: string
  loans?: Array<{ id: number; loanNumber: string; totalToRepay: number }>
  phones?: string[]
  workPhone?: string
  email?: string | null
  initialPhone?: string
  onSent?: () => void
}

export function SendMessageModal({
  open,
  onClose,
  clientId,
  clientName,
  loans = [],
  phones: phonesProp,
  workPhone,
  email: emailProp,
  initialPhone,
  onSent,
}: SendMessageModalProps) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const [channel, setChannel] = useState<MessagingChannel>('sms')
  const [service, setService] = useState('')
  const [draftId, setDraftId] = useState('none')
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [senderName, setSenderName] = useState('')
  const [contentTouched, setContentTouched] = useState(false)
  const [selectedPhone, setSelectedPhone] = useState('')

  const subjectRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const lastFocusedRef = useRef<MessagingTemplateFocusField>('body')

  const { data: integrations = [], isLoading: integrationsLoading } = useMessagingIntegrations(open)
  const { data: channelDrafts = [], isLoading: draftsLoading } = useMessagingDrafts(
    open ? channel : undefined
  )
  const sendMessageMutation = useSendMessage()
  const { data: clientData } = useClient(clientId, !!clientId && open)
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authApi.me(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  })

  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(
    loans.length > 0 ? loans[0].id : null
  )

  const clientPhones = useMemo(() => {
    const base = collectClientPhones(phonesProp, clientData?.phone_primary)
    if (workPhone && workPhone.trim() && !base.includes(workPhone.trim())) {
      return [...base, workPhone.trim()]
    }
    return base
  }, [clientData?.phone_primary, phonesProp, workPhone])

  const clientEmail = (emailProp ?? clientData?.email ?? '').trim()

  const selectedLoan = loans.find((loan) => loan.id === selectedLoanId) ?? loans[0] ?? null
  const selectedDraft = useMemo(
    () => channelDrafts.find((draft) => String(draft.id) === draftId) ?? null,
    [channelDrafts, draftId]
  )
  const channelSpec = CHANNEL_SPECS[channel]
  const showSubject = channelSpec.showSubject
  const destinationKind = getChannelDestinationLabel(channel)
  const hasPhoneDestination = destinationKind === 'phone' && !!selectedPhone.trim()
  const hasEmailDestination = destinationKind === 'email' && !!clientEmail

  const quotaDestination = useMemo(() => {
    if (destinationKind === 'email') return clientEmail
    return selectedPhone
  }, [clientEmail, destinationKind, selectedPhone])

  const { data: quotaData } = useDestinationQuota(quotaDestination, open && !!quotaDestination)

  const availableChannels = useMemo(
    () =>
      MESSAGING_CHANNELS.filter((item) =>
        integrations.some((integration) => isMessagingIntegrationUsable(integration, item))
      ),
    [integrations]
  )

  const availableIntegrations = useMemo(
    () => integrations.filter((integration) => isMessagingIntegrationUsable(integration, channel)),
    [channel, integrations]
  )

  const clientDisplayName = useMemo(() => formatClientNameInitials(clientName), [clientName])

  const currentUser = useMemo(() => resolveCurrentUserFromQuery(currentUserData), [currentUserData])

  const variableValues = useMemo(
    () =>
      buildClientMessagingVariables({
        clientName,
        clientDisplayName,
        clientData,
        currentUser,
        username: user?.username,
        selectedLoan: selectedLoan
          ? {
              loanNumber: selectedLoan.loanNumber,
              totalToRepay: selectedLoan.totalToRepay,
            }
          : null,
      }),
    [clientData, clientDisplayName, clientName, currentUser, selectedLoan, user?.username]
  )

  const previewBody = useMemo(
    () => renderMessagingTemplate(body, variableValues),
    [body, variableValues]
  )

  const previewSubject = useMemo(
    () => (showSubject ? renderMessagingTemplate(subject, variableValues) : ''),
    [showSubject, subject, variableValues]
  )

  useEffect(() => {
    if (!open) return

    setChannel('sms')
    setBody('')
    setSubject('')
    setSenderName('')
    setDraftId('none')
    setService('')
    setContentTouched(false)
    setSelectedLoanId(loans.length > 0 ? loans[0].id : null)
    setSelectedPhone(resolveDestinationPhone(clientPhones, initialPhone))
    lastFocusedRef.current = 'body'
  }, [clientPhones, initialPhone, loans, open])

  const handleInsertVariable = (variableName: string) => {
    insertMessagingVariableAtCursor({
      variableName,
      subject,
      body,
      setSubject,
      setBody,
      showSubject,
      subjectRef,
      bodyRef,
      lastFocusedRef,
      onInserted: () => setContentTouched(true),
    })
  }

  useEffect(() => {
    if (!open) return
    if (availableChannels.length === 0) return
    if (!availableChannels.includes(channel)) {
      setChannel(availableChannels[0])
    }
  }, [availableChannels, channel, open])

  useEffect(() => {
    if (!open) return

    const options = availableIntegrations.map((integration) => integration.service)
    if (options.length === 0) {
      if (service) setService('')
      return
    }
    // Only auto-pick when empty or current service is not valid for this channel.
    if (!service || !options.includes(service)) {
      setService(options[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when channel integrations change, not on manual service pick
  }, [availableIntegrations, open])

  useEffect(() => {
    if (!open || destinationKind !== 'phone') return
    if (selectedPhone && clientPhones.includes(selectedPhone)) return
    setSelectedPhone(resolveDestinationPhone(clientPhones, initialPhone))
  }, [clientPhones, destinationKind, initialPhone, open, selectedPhone])

  const handleChannelChange = (nextChannel: MessagingChannel) => {
    const spec = CHANNEL_SPECS[nextChannel]
    const integrationsForChannel = integrations.filter((integration) =>
      isMessagingIntegrationUsable(integration, nextChannel)
    )

    setChannel(nextChannel)
    setDraftId('none')
    setContentTouched(false)
    resetMessageFields({ setBody, setSubject, setSenderName })
    setService(integrationsForChannel[0]?.service ?? '')

    if (senderName.length > spec.senderMaxLength) {
      setSenderName(senderName.slice(0, spec.senderMaxLength))
    }
    if (body.length > spec.bodyMaxLength) {
      setBody(body.slice(0, spec.bodyMaxLength))
    }
  }

  const handleDraftChange = (value: string) => {
    setDraftId(value)
    setContentTouched(false)

    if (value === 'none') {
      resetMessageFields({ setBody, setSubject, setSenderName })
      return
    }

    const draft = channelDrafts.find((item) => String(item.id) === value)
    if (!draft) return

    applyDraftContent(draft, channel, { setBody, setSubject, setSenderName })
  }

  const useDraftIdOnSend =
    selectedDraft !== null &&
    !contentTouched &&
    draftSnapshotMatches(selectedDraft, body, subject, senderName)

  const hasDestination = destinationKind === 'email' ? hasEmailDestination : hasPhoneDestination

  const quotaExceeded = quotaData != null && !quotaData.allowed

  const canSend =
    clientId > 0 &&
    !!service &&
    hasDestination &&
    body.trim().length > 0 &&
    (!channelSpec.subjectRequired || subject.trim().length > 0) &&
    !quotaExceeded &&
    !sendMessageMutation.isPending

  const isFormLoading = integrationsLoading || draftsLoading

  const serviceLabel = (serviceKey: string) =>
    t(`pages.messagingIntegrations.services.${serviceKey}`, getMessagingServiceLabel(serviceKey))

  const handleSend = async () => {
    if (!canSend) return

    await sendMessageMutation.mutateAsync({
      client_id: clientId,
      channel,
      service,
      draft_id: useDraftIdOnSend ? selectedDraft!.id : null,
      body: useDraftIdOnSend ? null : body.trim(),
      subject: showSubject ? subject.trim() || null : null,
      sender_name: senderName.trim() || null,
      variables: variableValues,
      destination_override: destinationKind === 'phone' ? selectedPhone || null : null,
    })

    onSent?.()
    onClose()
  }

  const destinationLabel =
    channel === 'email'
      ? t('pages.clients.modals.sendMessage.clientEmail', 'Client email')
      : channel === 'viber'
        ? t('pages.clients.modals.sendMessage.clientPhoneViber', 'Client phone (Viber)')
        : t('pages.clients.modals.sendMessage.clientPhoneSms', 'Client phone (SMS)')

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.MailSend01 size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.sendMessage.title', {
          clientName,
          defaultValue: `Send message to ${clientName}`,
        })}
      />
      <ModalContent>
        {isFormLoading ? (
          <SendMessageModalSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-dark-500 mb-1.5 block text-sm font-light">
                  {t('pages.clients.modals.sendMessage.channel', 'Channel')}
                </label>
                <Select
                  value={channel}
                  onValueChange={(value) => handleChannelChange(value as MessagingChannel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChannels.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item.toUpperCase()}
                      </SelectItem>
                    ))}
                    {availableChannels.length === 0 && (
                      <SelectItem value="__none" disabled>
                        {t(
                          'pages.clients.modals.sendMessage.noChannels',
                          'No enabled channels are available'
                        )}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-dark-500 mb-1.5 block text-sm font-light">
                  {t('pages.clients.modals.sendMessage.service', 'Service')}
                </label>
                <Select
                  value={service || undefined}
                  onValueChange={setService}
                  disabled={!hasDestination || availableIntegrations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        integrationsLoading
                          ? t(
                              'pages.clients.modals.sendMessage.loadingIntegrations',
                              'Loading integrations...'
                            )
                          : t(
                              'pages.clients.modals.sendMessage.servicePlaceholder',
                              'Select a service'
                            )
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIntegrations.length > 0 ? (
                      availableIntegrations.map((integration) => (
                        <SelectItem key={integration.service} value={integration.service}>
                          {serviceLabel(integration.service)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none" disabled>
                        {t(
                          'pages.clients.modals.sendMessage.noIntegrations',
                          'No enabled integrations for this channel'
                        )}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-dark-500 mb-2 text-sm font-medium">
                {t('pages.clients.modals.sendMessage.recipient', 'Recipient')}
              </div>
              {destinationKind === 'email' ? (
                <div className="space-y-2">
                  <div className="text-dark-500 text-xs font-light">{destinationLabel}</div>
                  <div className="text-dark-500 text-sm font-medium">{clientEmail || '—'}</div>
                  {!clientEmail && (
                    <p className="text-error-600 text-xs">
                      {t(
                        'pages.clients.modals.sendMessage.noEmail',
                        'This client has no email address on file.'
                      )}
                    </p>
                  )}
                  {clientEmail && quotaData && (
                    <div
                      className={`flex items-center gap-1.5 text-xs ${
                        quotaData.allowed ? 'text-gray-500' : 'text-error-600 font-medium'
                      }`}
                    >
                      {quotaData.allowed ? (
                        <Icons.Info size={12} strokeWidth={1.5} />
                      ) : (
                        <Icons.Warning size={12} strokeWidth={1.5} />
                      )}
                      {quotaData.allowed
                        ? t(
                            'pages.clients.modals.sendMessage.quotaStatus',
                            '{{sent}} / {{limit}} messages sent today',
                            { sent: quotaData.sent_today, limit: quotaData.daily_limit }
                          )
                        : t(
                            'pages.clients.modals.sendMessage.quotaExceeded',
                            'Daily limit reached ({{limit}} / {{limit}}). Cannot send.',
                            { limit: quotaData.daily_limit }
                          )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-dark-500 text-xs font-light">{destinationLabel}</div>
                  {clientPhones.length > 1 ? (
                    <Select value={selectedPhone} onValueChange={setSelectedPhone}>
                      <SelectTrigger className="bg-white">
                        <SelectValue
                          placeholder={t(
                            'pages.clients.modals.sendMessage.selectPhone',
                            'Select phone number'
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {clientPhones.map((phone) => (
                          <SelectItem key={phone} value={phone}>
                            {phone}
                            {phone === workPhone
                              ? ` (${t('pages.clients.modals.sendMessage.workPhone', 'work')})`
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-dark-500 text-sm font-medium">{selectedPhone || '—'}</div>
                  )}
                  {!hasPhoneDestination && (
                    <p className="text-error-600 text-xs">
                      {t(
                        'pages.clients.modals.sendMessage.noPhone',
                        'This client has no phone number on file.'
                      )}
                    </p>
                  )}
                  {hasPhoneDestination && quotaData && (
                    <div
                      className={`flex items-center gap-1.5 text-xs ${
                        quotaData.allowed ? 'text-gray-500' : 'text-error-600 font-medium'
                      }`}
                    >
                      {quotaData.allowed ? (
                        <Icons.Info size={12} strokeWidth={1.5} />
                      ) : (
                        <Icons.Warning size={12} strokeWidth={1.5} />
                      )}
                      {quotaData.allowed
                        ? t(
                            'pages.clients.modals.sendMessage.quotaStatus',
                            '{{sent}} / {{limit}} messages sent today',
                            { sent: quotaData.sent_today, limit: quotaData.daily_limit }
                          )
                        : t(
                            'pages.clients.modals.sendMessage.quotaExceeded',
                            'Daily limit reached ({{limit}} / {{limit}}). Cannot send.',
                            { limit: quotaData.daily_limit }
                          )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-dark-500 mb-1.5 block text-sm font-light">
                  {t('pages.clients.modals.sendMessage.draft', 'Draft')}
                </label>
                <Select
                  value={draftId}
                  onValueChange={handleDraftChange}
                  disabled={!hasDestination}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        draftsLoading
                          ? t('pages.clients.modals.sendMessage.loadingDrafts', 'Loading drafts...')
                          : t('pages.clients.modals.sendMessage.draftPlaceholder', 'Select a draft')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t('pages.clients.modals.sendMessage.noDraft', 'No draft (custom message)')}
                    </SelectItem>
                    {channelDrafts.map((draft) => (
                      <SelectItem key={draft.id} value={String(draft.id)}>
                        {draft.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                label={t('pages.clients.modals.sendMessage.senderName', 'Sender name')}
                value={senderName}
                onChange={(event) => {
                  setSenderName(event.target.value)
                  setContentTouched(true)
                }}
                maxLength={channelSpec.senderMaxLength}
                disabled={!hasDestination}
                placeholder={t(
                  'pages.clients.modals.sendMessage.senderNamePlaceholder',
                  'CRM Prionex'
                )}
              />
            </div>

            {loans.length > 0 && (
              <div>
                <label className="text-dark-500 mb-1.5 block text-sm font-light">
                  {t('pages.clients.modals.sendSMS.loanNumber', 'Loan number')}
                </label>
                <Select
                  value={selectedLoanId?.toString() ?? ''}
                  onValueChange={(value) => setSelectedLoanId(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {loans.map((loan) => (
                      <SelectItem key={loan.id} value={loan.id.toString()}>
                        {loan.loanNumber} — {formatMoneyUAHTwoDecimals(loan.totalToRepay)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showSubject && (
              <Input
                ref={subjectRef}
                label={t('pages.clients.modals.sendMessage.subject', 'Subject')}
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value)
                  setContentTouched(true)
                }}
                onFocus={() => {
                  lastFocusedRef.current = 'subject'
                }}
                disabled={!hasDestination}
                placeholder={t(
                  'pages.clients.modals.sendMessage.subjectPlaceholder',
                  'Reminder about your account'
                )}
                required={channelSpec.subjectRequired}
              />
            )}

            <Textarea
              ref={bodyRef}
              label={t('pages.clients.modals.sendMessage.body', 'Message body')}
              value={body}
              onChange={(event) => {
                setBody(event.target.value)
                setContentTouched(true)
              }}
              onFocus={() => {
                lastFocusedRef.current = 'body'
              }}
              textareaSize="lg"
              maxLength={channelSpec.bodyMaxLength}
              disabled={!hasDestination}
              helperText={t(
                'pages.clients.modals.sendMessage.bodyHint',
                'Edit the message before sending. Variables like {{client_name}} are filled from client data.'
              )}
            />

            <MessagingVariablesPalette onInsert={handleInsertVariable} disabled={!hasDestination} />

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-dark-500 text-sm font-medium">
                  {t('pages.clients.modals.sendMessage.preview', 'Message preview')}
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 ring-inset">
                  {channel.toUpperCase()}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-dark-500 font-medium">
                    {t('pages.clients.modals.sendMessage.previewTo', 'To')}:
                  </span>{' '}
                  <span className="text-gray-600">
                    {destinationKind === 'email' ? clientEmail || '—' : selectedPhone || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-dark-500 font-medium">
                    {t('pages.clients.modals.sendMessage.previewSender', 'Sender')}:
                  </span>{' '}
                  <span className="text-gray-600">{senderName.trim() || '—'}</span>
                </div>
                {showSubject && (
                  <div>
                    <span className="text-dark-500 font-medium">
                      {t('pages.clients.modals.sendMessage.previewSubject', 'Subject')}:
                    </span>{' '}
                    <span className="text-gray-600">{previewSubject || '—'}</span>
                  </div>
                )}
                <div>
                  <span className="text-dark-500 font-medium">
                    {t('pages.clients.modals.sendMessage.previewBody', 'Message')}:
                  </span>
                  <pre className="text-dark-500 mt-1 overflow-auto rounded-lg bg-white p-3 text-xs whitespace-pre-wrap">
                    {previewBody.trim() || '—'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          className="w-full rounded-md"
          disabled={isFormLoading}
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSend}
          className="w-full rounded-md"
          disabled={!canSend || isFormLoading}
          isLoading={sendMessageMutation.isPending}
          title={
            quotaExceeded
              ? t(
                  'pages.clients.modals.sendMessage.quotaExceededHint',
                  'Daily message limit reached for this recipient'
                )
              : undefined
          }
        >
          {t('pages.clients.modals.sendMessage.send', 'Send message')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default SendMessageModal
