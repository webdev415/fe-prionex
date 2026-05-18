import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import {
  MESSAGING_CHANNELS,
  getMessagingServiceLabel,
  isMessagingIntegrationUsable,
  useMessagingDrafts,
  useMessagingIntegrations,
  useSendMessage,
} from '@/features/messaging'
import type { MessagingChannel } from '@/features/messaging'

export interface SendMessageModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  clientName: string
  onSent?: () => void
}

export function SendMessageModal({
  open,
  onClose,
  clientId,
  clientName,
  onSent,
}: SendMessageModalProps) {
  const { t } = useTranslation('common')
  const [channel, setChannel] = useState<MessagingChannel>('sms')
  const [service, setService] = useState('')
  const [draftId, setDraftId] = useState('none')
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [senderName, setSenderName] = useState('')
  const [campaignName, setCampaignName] = useState('')

  const { data: integrations = [], isLoading: integrationsLoading } = useMessagingIntegrations(open)
  const { data: drafts = [], isLoading: draftsLoading } = useMessagingDrafts(channel)
  const sendMessageMutation = useSendMessage()
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return

    setChannel('sms')
    setBody('')
    setSubject('')
    setSenderName('')
    setCampaignName(`Single send to ${clientName}`)
    setDraftId('none')
  }, [clientName, open])

  useEffect(() => {
    if (!open) return
    if (availableChannels.length === 0) return
    if (!availableChannels.includes(channel)) {
      setChannel(availableChannels[0])
    }
  }, [availableChannels, channel, open])

  useEffect(() => {
    if (!open) return

    const availableService = availableIntegrations[0]?.service ?? ''
    setService(availableService)
  }, [availableIntegrations, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const usingDraft = draftId !== 'none'
  const canSend =
    clientId > 0 &&
    !!service &&
    !!campaignName.trim() &&
    (usingDraft || body.trim().length > 0) &&
    !sendMessageMutation.isPending

  const handleSend = async () => {
    if (!canSend) return

    await sendMessageMutation.mutateAsync({
      client_id: clientId,
      channel,
      service,
      draft_id: usingDraft ? Number(draftId) : null,
      body: usingDraft ? null : body.trim(),
      subject: subject.trim() || null,
      sender_name: senderName.trim() || null,
      variables: {},
      name: campaignName.trim(),
    })

    onSent?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.MailSend01 size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.sendMessage.title', {
          defaultValue: `Send message to ${clientName}`,
        })}
      />
      <ModalContent>
        <div className="space-y-4">
          <Input
            label={t('pages.clients.modals.sendMessage.name', 'Campaign label')}
            value={campaignName}
            onChange={(event) => setCampaignName(event.target.value)}
            placeholder={t(
              'pages.clients.modals.sendMessage.namePlaceholder',
              'Single send to client'
            )}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-dark-500 mb-1.5 block text-sm font-light">
                {t('pages.clients.modals.sendMessage.channel', 'Channel')}
              </label>
              <Select
                value={channel}
                onValueChange={(value) => setChannel(value as MessagingChannel)}
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
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'pages.clients.modals.sendMessage.servicePlaceholder',
                      integrationsLoading ? 'Loading integrations...' : 'Select a service'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableIntegrations.length > 0 ? (
                    availableIntegrations.map((integration) => (
                      <SelectItem key={integration.service} value={integration.service}>
                        {getMessagingServiceLabel(integration.service)}
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-dark-500 mb-1.5 block text-sm font-light">
                {t('pages.clients.modals.sendMessage.draft', 'Draft')}
              </label>
              <Select value={draftId} onValueChange={setDraftId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'pages.clients.modals.sendMessage.draftPlaceholder',
                      draftsLoading ? 'Loading drafts...' : 'Select a draft'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t('pages.clients.modals.sendMessage.noDraft', 'No draft (custom message)')}
                  </SelectItem>
                  {drafts.map((draft) => (
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
              onChange={(event) => setSenderName(event.target.value)}
              placeholder={t(
                'pages.clients.modals.sendMessage.senderNamePlaceholder',
                'CRM Prionex'
              )}
            />
          </div>

          <Input
            label={t('pages.clients.modals.sendMessage.subject', 'Subject')}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t(
              'pages.clients.modals.sendMessage.subjectPlaceholder',
              'Reminder about your account'
            )}
            helperText={
              usingDraft
                ? t(
                    'pages.clients.modals.sendMessage.subjectDraftHint',
                    'Subject is optional here; draft subject will be used when present.'
                  )
                : t(
                    'pages.clients.modals.sendMessage.subjectOptional',
                    'Optional unless your chosen channel or draft requires it.'
                  )
            }
          />

          <Textarea
            label={t('pages.clients.modals.sendMessage.body', 'Message body')}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            textareaSize="lg"
            disabled={usingDraft}
            helperText={
              usingDraft
                ? t(
                    'pages.clients.modals.sendMessage.bodyDisabled',
                    'A draft is selected, so the stored draft body will be rendered and sent.'
                  )
                : t(
                    'pages.clients.modals.sendMessage.bodyHint',
                    'Enter a custom message when you are not using a draft.'
                  )
            }
          />
        </div>
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} size="sm">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSend}
          size="sm"
          disabled={!canSend}
          isLoading={sendMessageMutation.isPending}
        >
          {t('pages.clients.modals.sendMessage.send', 'Send message')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default SendMessageModal
