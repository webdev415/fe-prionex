import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { intlLocaleForUiLanguage } from '@/lib/i18n'
import { toast } from 'sonner'
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
import { useHasPermission } from '@/hooks/usePermissions'
import {
  BULK_MESSAGING_RECIPIENT_CAP,
  MESSAGING_CHANNELS,
  fetchFilteredClientIds,
  isMessagingIntegrationUsable,
  launchPermissionForChannel,
  useCreateMessagingCampaign,
  useMessagingDrafts,
  useMessagingIntegrations,
  getMessagingServiceLabel,
  MessagingVariablesPalette,
  ViberRichContentFields,
  buildViberContentForSend,
  readDraftViberFormState,
  resetViberImages,
  viberPublicUrls,
  type MessagingViberImageAttachment,
  insertMessagingVariableAtCursor,
  type MessagingTemplateFocusField,
} from '@/features/messaging'
import type { MessagingChannel, MessagingDraft } from '@/features/messaging'
import { CHANNEL_SPECS } from '@/pages/MessagingDrafts/draftModalShared'
import { BulkSendMessageModalSkeleton } from './BulkSendMessageModalSkeleton'

const NO_DRAFT_VALUE = 'none'

interface BulkSendMessageModalProps {
  open: boolean
  /** Explicit row selection (when header select-all is off). */
  clientIds: number[]
  selectedClients: Array<{
    id: number
    fullName: string
    priority: 'Critical' | 'High' | 'Medium' | 'Low'
    score: number
    debt: string
  }>
  totalSelectedCount: number
  /** True when user selected all clients matching the current list filters. */
  allClientsSelectedAcrossPages?: boolean
  /** Unchecked rows while in select-all mode. */
  excludedClientIds?: number[]
  /** Client list API params (filters + sort) without pagination — used to resolve all filtered ids. */
  clientListFilterParams?: Record<string, unknown>
  onClose: () => void
  onLaunched?: () => void
}

const formatCampaignDateStamp = (language: string) =>
  new Intl.DateTimeFormat(intlLocaleForUiLanguage(language), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date())

function draftSnapshotMatches(draft: MessagingDraft, body: string, subject: string): boolean {
  return (
    body.trim() === draft.body.trim() && (subject.trim() || '') === (draft.subject || '').trim()
  )
}

function applyDraftToForm(
  draft: MessagingDraft,
  channel: MessagingChannel,
  setters: {
    setBody: (body: string) => void
    setSubject: (subject: string) => void
  }
) {
  const spec = CHANNEL_SPECS[channel]
  setters.setBody(draft.body)
  setters.setSubject(spec.showSubject ? draft.subject || '' : '')
}

function resetCustomMessageFields(setters: {
  setBody: (body: string) => void
  setSubject: (subject: string) => void
}) {
  setters.setBody('')
  setters.setSubject('')
}

export function BulkSendMessageModal({
  open,
  clientIds,
  selectedClients,
  totalSelectedCount,
  allClientsSelectedAcrossPages = false,
  excludedClientIds = [],
  clientListFilterParams = {},
  onClose,
  onLaunched,
}: BulkSendMessageModalProps) {
  const { t } = useTranslation('common')
  const canLaunchSms = useHasPermission(launchPermissionForChannel('sms'))
  const canLaunchViber = useHasPermission(launchPermissionForChannel('viber'))
  const canLaunchEmail = useHasPermission(launchPermissionForChannel('email'))
  const [campaignName, setCampaignName] = useState('')
  const [channel, setChannel] = useState<MessagingChannel>('sms')
  const [service, setService] = useState('')
  const [draftId, setDraftId] = useState(NO_DRAFT_VALUE)
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [contentTouched, setContentTouched] = useState(false)
  const [isResolvingRecipients, setIsResolvingRecipients] = useState(false)
  const [viberAddImage, setViberAddImage] = useState(false)
  const [viberImages, setViberImages] = useState<MessagingViberImageAttachment[]>([])
  const [viberAddButton, setViberAddButton] = useState(false)
  const [viberButtonName, setViberButtonName] = useState('')
  const [viberButtonUrl, setViberButtonUrl] = useState('')

  const subjectRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const lastFocusedRef = useRef<MessagingTemplateFocusField>('body')

  const { data: integrations = [], isLoading: integrationsLoading } = useMessagingIntegrations(open)
  const { data: drafts = [], isLoading: draftsLoading } = useMessagingDrafts(
    open ? channel : undefined
  )
  const createCampaignMutation = useCreateMessagingCampaign()
  const channelSpec = CHANNEL_SPECS[channel]
  const isCustomMessage = draftId === NO_DRAFT_VALUE
  const isMy2Viber = channel === 'viber' && service === 'my2_viber'

  const excludedSet = useMemo(() => new Set(excludedClientIds), [excludedClientIds])

  const availableChannels = useMemo(
    () =>
      MESSAGING_CHANNELS.filter((item) => {
        const allowed =
          (item === 'sms' && canLaunchSms) ||
          (item === 'viber' && canLaunchViber) ||
          (item === 'email' && canLaunchEmail)
        if (!allowed) return false
        return integrations.some((integration) => isMessagingIntegrationUsable(integration, item))
      }),
    [canLaunchEmail, canLaunchSms, canLaunchViber, integrations]
  )

  const availableIntegrations = useMemo(
    () => integrations.filter((integration) => isMessagingIntegrationUsable(integration, channel)),
    [channel, integrations]
  )

  const selectedDraft = useMemo(
    () => drafts.find((draft) => String(draft.id) === draftId) ?? null,
    [drafts, draftId]
  )

  const useDraftIdOnLaunch =
    selectedDraft !== null && !contentTouched && draftSnapshotMatches(selectedDraft, body, subject)

  const previewLabel = isCustomMessage
    ? t('pages.clients.modals.bulkSendMessage.customMessage', 'Custom message')
    : (selectedDraft?.name ?? '')

  useEffect(() => {
    if (!open) return
    if (availableChannels.length === 0) return
    if (!availableChannels.includes(channel)) {
      setChannel(availableChannels[0])
    }
  }, [availableChannels, channel, open])

  useEffect(() => {
    if (!open) return

    const date = formatCampaignDateStamp(i18n.language)
    setCampaignName(
      t('pages.clients.modals.bulkSendMessage.defaultCampaignName', {
        channel: channel.toUpperCase(),
        date,
        defaultValue: `Bulk ${channel.toUpperCase()} campaign — ${date}`,
      })
    )
  }, [channel, open, t])

  useEffect(() => {
    if (!open) return

    const options = availableIntegrations.map((integration) => integration.service)
    if (options.length === 0) {
      setService('')
      return
    }
    if (!service || !options.includes(service)) {
      setService(options[0])
    }
  }, [availableIntegrations, channel, open, service])

  useEffect(() => {
    if (!open) return

    setDraftId(NO_DRAFT_VALUE)
    resetCustomMessageFields({ setBody, setSubject })
    setContentTouched(false)
    setViberAddImage(false)
    setViberImages((prev) => resetViberImages(prev))
    setViberAddButton(false)
    setViberButtonName('')
    setViberButtonUrl('')
    lastFocusedRef.current = 'body'
  }, [open])

  useEffect(() => {
    if (!open || draftsLoading || isCustomMessage) return
    if (drafts.length === 0) {
      setDraftId(NO_DRAFT_VALUE)
      return
    }
    const draftStillValid = drafts.some((draft) => String(draft.id) === draftId)
    if (!draftStillValid) {
      setDraftId(String(drafts[0].id))
    }
  }, [draftId, drafts, draftsLoading, isCustomMessage, open])

  const previewClients = selectedClients.slice(0, 5)
  const remainingCount = Math.max(totalSelectedCount - previewClients.length, 0)
  const recipientCountLabel = allClientsSelectedAcrossPages ? totalSelectedCount : clientIds.length

  const hasSelection =
    totalSelectedCount > 0 && (allClientsSelectedAcrossPages || clientIds.length > 0)

  const hasViberRich =
    isMy2Viber &&
    ((viberAddImage && viberPublicUrls(viberImages).length > 0) ||
      (viberAddButton && viberButtonName.trim() && viberButtonUrl.trim()))
  const hasMessageContent =
    (body.trim().length > 0 || hasViberRich) &&
    (!channelSpec.subjectRequired || subject.trim().length > 0)

  const canLaunch =
    hasSelection &&
    campaignName.trim().length > 0 &&
    !!service &&
    hasMessageContent &&
    !createCampaignMutation.isPending &&
    !isResolvingRecipients

  const isFormLoading = integrationsLoading || draftsLoading

  const serviceLabel = (serviceKey: string) =>
    t(`pages.messagingIntegrations.services.${serviceKey}`, getMessagingServiceLabel(serviceKey))

  const handleChannelChange = (nextChannel: MessagingChannel) => {
    const spec = CHANNEL_SPECS[nextChannel]
    setChannel(nextChannel)
    setDraftId(NO_DRAFT_VALUE)
    setContentTouched(false)
    resetCustomMessageFields({ setBody, setSubject })
    setViberAddImage(false)
    setViberImages((prev) => resetViberImages(prev))
    setViberAddButton(false)
    setViberButtonName('')
    setViberButtonUrl('')
    if (body.length > spec.bodyMaxLength) {
      setBody(body.slice(0, spec.bodyMaxLength))
    }
  }

  const applyViberFromDraft = (draft: MessagingDraft | null) => {
    const viberForm = readDraftViberFormState(draft)
    setViberAddImage(viberForm.addImage)
    setViberImages((prev) => {
      resetViberImages(prev)
      return viberForm.images
    })
    setViberAddButton(viberForm.addButton)
    setViberButtonName(viberForm.buttonName)
    setViberButtonUrl(viberForm.buttonUrl)
  }

  const handleDraftChange = (value: string) => {
    setDraftId(value)
    setContentTouched(false)
    if (value === NO_DRAFT_VALUE) {
      resetCustomMessageFields({ setBody, setSubject })
      applyViberFromDraft(null)
      return
    }
    const draft = drafts.find((item) => String(item.id) === value)
    if (draft) {
      applyDraftToForm(draft, channel, { setBody, setSubject })
      applyViberFromDraft(draft)
    }
  }

  const handleInsertVariable = (variableName: string) => {
    insertMessagingVariableAtCursor({
      variableName,
      subject,
      body,
      setSubject,
      setBody,
      showSubject: channelSpec.showSubject,
      subjectRef,
      bodyRef,
      lastFocusedRef,
      onInserted: () => setContentTouched(true),
    })
  }

  const resolveRecipientIds = async (): Promise<number[]> => {
    if (allClientsSelectedAcrossPages) {
      return fetchFilteredClientIds(clientListFilterParams, excludedSet)
    }
    return clientIds
  }

  const handleLaunch = async () => {
    if (!canLaunch) return

    setIsResolvingRecipients(true)
    let ids: number[] = []
    try {
      ids = await resolveRecipientIds()
    } catch (error) {
      console.error('bulk messaging: resolve recipient ids failed', error)
      toast.error(
        t(
          'pages.clients.modals.bulkSendMessage.resolveFailed',
          'Could not load the full client list for this campaign.'
        )
      )
      setIsResolvingRecipients(false)
      return
    }

    if (ids.length === 0) {
      toast.error(
        t(
          'pages.clients.modals.bulkSendMessage.noRecipients',
          'No recipients match the current selection.'
        )
      )
      setIsResolvingRecipients(false)
      return
    }
    if (ids.length >= BULK_MESSAGING_RECIPIENT_CAP) {
      toast.warning(
        t(
          'pages.clients.modals.bulkSendMessage.recipientCap',
          'Only the first {{cap}} recipients will be included.',
          { cap: BULK_MESSAGING_RECIPIENT_CAP }
        )
      )
    }

    const viberContent = isMy2Viber
      ? buildViberContentForSend({
          urlImages: viberPublicUrls(viberImages),
          buttonName: viberButtonName,
          buttonUrl: viberButtonUrl,
        })
      : null

    try {
      await createCampaignMutation.mutateAsync({
        name: campaignName.trim(),
        channel,
        service,
        ...(useDraftIdOnLaunch
          ? { draft_id: selectedDraft!.id }
          : {
              ...(body.trim() ? { body: body.trim() } : {}),
              subject: channelSpec.showSubject ? subject.trim() || null : null,
            }),
        selection_payload: {
          mode: 'ids',
          ids,
        },
        source: 'bulk',
        viber_content: viberContent ?? null,
      })

      onLaunched?.()
      onClose()
    } catch (error) {
      console.error('bulk messaging: create campaign failed', error)
    } finally {
      setIsResolvingRecipients(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.MessageMultiple01
              size={18}
              className="text-primary-foreground"
              strokeWidth={1.5}
            />
          </div>
        }
        title={t('pages.clients.modals.bulkSendMessage.title', {
          count: totalSelectedCount,
          defaultValue: `Send message to ${totalSelectedCount} clients`,
        })}
      />
      <ModalContent>
        <div className="space-y-6">
          <div className="border-border bg-card/50 rounded-xl border p-4">
            <div className="text-foreground text-sm font-medium">
              {t(
                'pages.clients.modals.bulkSendMessage.selectedClients',
                'Selected clients preview'
              )}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {t('pages.clients.modals.bulkSendMessage.recipientCount', {
                count: recipientCountLabel,
                defaultValue: '{{count}} recipients will receive this message',
              })}
            </div>
            {allClientsSelectedAcrossPages && (
              <p className="text-muted-foreground mt-2 text-xs">
                {t(
                  'pages.clients.modals.bulkSendMessage.filteredSelectAllHint',
                  'All clients matching your current search and filters are included (across all pages).'
                )}
              </p>
            )}
            <div className="text-muted-foreground mt-3 space-y-2 text-sm">
              {previewClients.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3"
                >
                  <span className="text-foreground font-medium">
                    {client.fullName} (#{client.id})
                  </span>
                  <span>{client.priority}</span>
                  <span>{client.debt}</span>
                </div>
              ))}
              {remainingCount > 0 && (
                <div className="text-muted-foreground text-xs">
                  {t('pages.clients.modals.bulkSendMessage.andMore', {
                    count: remainingCount,
                    defaultValue: `and ${remainingCount} more clients`,
                  })}
                </div>
              )}
            </div>
          </div>

          {isFormLoading ? (
            <BulkSendMessageModalSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label={t('pages.clients.modals.bulkSendMessage.campaignName', 'Campaign name')}
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder={t(
                    'pages.clients.modals.bulkSendMessage.campaignNamePlaceholder',
                    'May payment reminder'
                  )}
                />

                <div>
                  <label className="text-foreground mb-1.5 block text-sm font-light">
                    {t('pages.clients.modals.bulkSendMessage.channel', 'Channel')}
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
                            'pages.clients.modals.bulkSendMessage.noChannels',
                            'No enabled channels are available'
                          )}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-foreground mb-1.5 block text-sm font-light">
                    {t('pages.clients.modals.bulkSendMessage.service', 'Service')}
                  </label>
                  <Select value={service || undefined} onValueChange={setService}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          integrationsLoading
                            ? t(
                                'pages.clients.modals.bulkSendMessage.loadingIntegrations',
                                'Loading integrations...'
                              )
                            : t(
                                'pages.clients.modals.bulkSendMessage.servicePlaceholder',
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
                            'pages.clients.modals.bulkSendMessage.noServices',
                            'No enabled integrations for this channel'
                          )}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-foreground mb-1.5 block text-sm font-light">
                    {t('pages.clients.modals.bulkSendMessage.draft', 'Draft')}
                  </label>
                  <Select
                    value={draftId}
                    onValueChange={handleDraftChange}
                    disabled={draftsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          draftsLoading
                            ? t(
                                'pages.clients.modals.bulkSendMessage.loadingDrafts',
                                'Loading drafts...'
                              )
                            : t(
                                'pages.clients.modals.bulkSendMessage.draftPlaceholder',
                                'Select a draft'
                              )
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_DRAFT_VALUE}>
                        {t(
                          'pages.clients.modals.bulkSendMessage.noDraft',
                          'No draft (custom message)'
                        )}
                      </SelectItem>
                      {drafts.map((draft) => (
                        <SelectItem key={draft.id} value={String(draft.id)}>
                          {draft.name}
                        </SelectItem>
                      ))}
                      {!draftsLoading && drafts.length === 0 && (
                        <SelectItem value="__none" disabled>
                          {t(
                            'pages.clients.modals.bulkSendMessage.noDrafts',
                            'No drafts available for this channel'
                          )}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                {channelSpec.showSubject && (
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
                  helperText={t(
                    'pages.clients.modals.bulkSendMessage.bodyHint',
                    'Edit the message before sending. Variables like {{client_name}} are filled per recipient at send time.'
                  )}
                />

                <MessagingVariablesPalette onInsert={handleInsertVariable} />

                {isMy2Viber && (
                  <ViberRichContentFields
                    addImage={viberAddImage}
                    onAddImageChange={setViberAddImage}
                    images={viberImages}
                    onImagesChange={setViberImages}
                    addButton={viberAddButton}
                    onAddButtonChange={setViberAddButton}
                    buttonName={viberButtonName}
                    onButtonNameChange={setViberButtonName}
                    buttonUrl={viberButtonUrl}
                    onButtonUrlChange={setViberButtonUrl}
                  />
                )}

                {body.trim().length > 0 && (
                  <div className="border-border bg-muted rounded-xl border p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-foreground text-sm font-medium">
                        {t('pages.clients.modals.bulkSendMessage.draftPreview', 'Message preview')}
                      </span>
                      {previewLabel && (
                        <span className="bg-card text-muted-foreground ring-border rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                          {previewLabel}
                        </span>
                      )}
                      <span className="bg-card text-muted-foreground ring-border rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                        {channel.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-3 text-xs">
                      {t(
                        'pages.clients.modals.bulkSendMessage.draftPreviewHint',
                        'Variables such as {{client_name}} and {{debt_amount}} are shown as written. Each recipient receives a message with values filled from their own client data at send time.'
                      )}
                    </p>
                    <div className="space-y-2 text-sm">
                      {channelSpec.showSubject && (
                        <div>
                          <span className="text-foreground font-medium">
                            {t('pages.clients.modals.bulkSendMessage.previewSubject', 'Subject')}:
                          </span>{' '}
                          <span className="text-muted-foreground font-mono">
                            {subject.trim() || '—'}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-foreground font-medium">
                          {t('pages.clients.modals.bulkSendMessage.previewBody', 'Message')}:
                        </span>
                        <pre className="text-foreground bg-card border-border mt-1 max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap">
                          {body.trim() || '—'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
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
          onClick={handleLaunch}
          className="w-full rounded-md"
          disabled={!canLaunch || isFormLoading}
          isLoading={createCampaignMutation.isPending || isResolvingRecipients}
        >
          {t('pages.clients.modals.bulkSendMessage.launch', 'Launch campaign')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default BulkSendMessageModal
