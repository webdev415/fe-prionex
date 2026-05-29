import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { intlLocaleForUiLanguage } from '@/lib/i18n'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
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
  MessagingVariablesPalette,
  ViberRichContentFields,
  buildViberContentForSend,
  readDraftViberFormState,
  resetViberImages,
  viberPublicUrls,
  downloadBlob,
  getMessagingServiceLabel,
  isMessagingIntegrationUsable,
  launchPermissionForChannel,
  useCreateMessagingCampaign,
  useMessagingDrafts,
  useMessagingIntegrations,
  insertMessagingVariableAtCursor,
  type MessagingChannel,
  type MessagingCsvParseResponse,
  type MessagingDraft,
  type MessagingTemplateFocusField,
  type MessagingViberImageAttachment,
} from '@/features/messaging'
import { messagingApi } from '@/features/messaging/api/messagingApi'
import { CHANNEL_SPECS } from '@/pages/MessagingDrafts/draftModalShared'
import { BulkSendMessageModalSkeleton } from '@/pages/ClientManagement/components/BulkSendMessageModalSkeleton'

const NO_DRAFT_VALUE = 'none'
const MAX_CSV_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

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

interface CsvCampaignLaunchModalProps {
  open: boolean
  onClose: () => void
  onLaunched?: () => void
}

export function CsvCampaignLaunchModal({ open, onClose, onLaunched }: CsvCampaignLaunchModalProps) {
  const { t } = useTranslation('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const [parseResult, setParseResult] = useState<MessagingCsvParseResponse | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
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

  const hasViberRich =
    isMy2Viber &&
    ((viberAddImage && viberPublicUrls(viberImages).length > 0) ||
      (viberAddButton && viberButtonName.trim() && viberButtonUrl.trim()))

  const hasMessageContent =
    (body.trim().length > 0 || hasViberRich) &&
    (!channelSpec.subjectRequired || subject.trim().length > 0)

  const canLaunch =
    !!parseResult &&
    parseResult.eligible > 0 &&
    campaignName.trim().length > 0 &&
    !!service &&
    hasMessageContent &&
    !createCampaignMutation.isPending &&
    !isParsing

  const isFormLoading = integrationsLoading || draftsLoading

  useEffect(() => {
    if (!open) return
    if (availableChannels.length && !availableChannels.includes(channel)) {
      setChannel(availableChannels[0])
    }
  }, [availableChannels, channel, open])

  useEffect(() => {
    if (!open) return
    const options = availableIntegrations.map((i) => i.service)
    if (options.length && (!service || !options.includes(service))) {
      setService(options[0])
    }
  }, [availableIntegrations, open, service])

  useEffect(() => {
    if (!open) return
    const date = formatCampaignDateStamp(i18n.language)
    setCampaignName(
      t('pages.messagingCampaigns.csvLaunch.defaultName', {
        channel: channel.toUpperCase(),
        date,
        defaultValue: `CSV ${channel.toUpperCase()} campaign — ${date}`,
      })
    )
  }, [channel, open, t])

  useEffect(() => {
    if (!open) {
      setParseResult(null)
      setBody('')
      setSubject('')
      setDraftId(NO_DRAFT_VALUE)
      setContentTouched(false)
      setViberAddImage(false)
      setViberImages((prev) => resetViberImages(prev))
      setViberAddButton(false)
      setViberButtonName('')
      setViberButtonUrl('')
      setUploadedFileName(null)
      setDragActive(false)
      lastFocusedRef.current = 'body'
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setParseResult(null)
    setUploadedFileName(null)
    setDraftId(NO_DRAFT_VALUE)
    setContentTouched(false)
    resetCustomMessageFields({ setBody, setSubject })
    setViberAddImage(false)
    setViberImages((prev) => resetViberImages(prev))
    setViberAddButton(false)
    setViberButtonName('')
    setViberButtonUrl('')
  }, [channel, open])

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

  const serviceLabel = useCallback(
    (key: string) =>
      t(`pages.messagingIntegrations.services.${key}`, getMessagingServiceLabel(key)),
    [t]
  )

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

  const uploadP = 'pages.messagingCampaigns.csvLaunch.upload'

  const validateCsvFile = useCallback(
    (file: File): string | null => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        return t(`${uploadP}.errors.onlyCsv`, 'Only CSV files are supported.')
      }
      if (file.size > MAX_CSV_FILE_BYTES) {
        return t(`${uploadP}.errors.fileTooLarge`, {
          defaultValue: 'File exceeds maximum size of 10 MB ({{size}} MB).',
          size: (file.size / (1024 * 1024)).toFixed(1),
        })
      }
      return null
    },
    [t, uploadP]
  )

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true)
    try {
      const blob = await messagingApi.downloadCampaignCsvTemplate(channel)
      downloadBlob(blob, `campaign-${channel}-template.csv`)
    } catch {
      toast.error(
        t('pages.messagingCampaigns.csvLaunch.templateFailed', 'Could not download template')
      )
    } finally {
      setIsDownloadingTemplate(false)
    }
  }

  const processCsvFile = useCallback(
    async (file: File) => {
      const error = validateCsvFile(file)
      if (error) {
        toast.error(error)
        return
      }
      setIsParsing(true)
      setParseResult(null)
      setUploadedFileName(file.name)
      try {
        const result = await messagingApi.parseCampaignCsv(channel, file)
        setParseResult(result)
      } catch (parseError) {
        console.error('parse csv failed', parseError)
        setParseResult(null)
        setUploadedFileName(null)
        toast.error(getErrorMessage(parseError))
      } finally {
        setIsParsing(false)
      }
    },
    [channel, validateCsvFile]
  )

  const handleDrag = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (isParsing) return
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true)
      } else if (e.type === 'dragleave') {
        setDragActive(false)
      }
    },
    [isParsing]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (isParsing) return
      const file = e.dataTransfer.files?.[0]
      if (file) void processCsvFile(file)
    },
    [isParsing, processCsvFile]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void processCsvFile(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [processCsvFile]
  )

  const handleLaunch = async () => {
    if (!canLaunch || !parseResult) return
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
          mode: 'csv',
          upload_id: parseResult.upload_id,
        },
        source: 'csv',
        viber_content: viberContent,
      })
      onLaunched?.()
      onClose()
    } catch (error) {
      console.error('csv campaign launch failed', error)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.MailSend01 size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.messagingCampaigns.csvLaunch.title', 'Launch campaign from CSV')}
      />

      <ModalContent>
        <p className="text-sm text-gray-600">
          {t(
            'pages.messagingCampaigns.csvLaunch.subtitle',
            'Upload recipients, compose the message, and launch.'
          )}
        </p>
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label={t('pages.clients.modals.bulkSendMessage.campaignName', 'Campaign name')}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />

            <div>
              <label className="text-dark-500 mb-1.5 block text-sm font-light">
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
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-dark-500 text-lg font-medium">
                  {t(`${uploadP}.sectionTitle`, 'Upload CSV File')}
                </h3>
                <p className="text-sm text-gray-600">
                  {channel === 'email'
                    ? t(
                        `${uploadP}.descriptionEmail`,
                        'CSV with client_id, email, and name columns (exact order)'
                      )
                    : t(
                        `${uploadP}.descriptionPhone`,
                        'CSV with client_id, phone, and name columns (exact order)'
                      )}
                </p>
              </div>
              <Button
                type="button"
                variant="white-secondary"
                size="sm"
                onClick={() => void handleDownloadTemplate()}
                disabled={isDownloadingTemplate}
                leftIcon={
                  isDownloadingTemplate ? (
                    <Icons.Spinner className="h-4 w-4" />
                  ) : (
                    <Icons.Download size={16} />
                  )
                }
              >
                {isDownloadingTemplate
                  ? t(`${uploadP}.downloading`, 'Downloading…')
                  : t(`${uploadP}.downloadTemplate`, 'Download Template')}
              </Button>
            </div>

            <div
              role="button"
              tabIndex={isParsing ? -1 : 0}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !isParsing && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (isParsing) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              className={`focus:ring-secondary-500 relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                dragActive
                  ? 'border-secondary-500 bg-secondary-50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              } ${isParsing ? 'pointer-events-none opacity-50' : ''}`}
            >
              {isParsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Icons.Spinner className="h-8 w-8" />
                  <p className="text-sm text-gray-600">
                    {t(`${uploadP}.validating`, 'Validating CSV…')}
                  </p>
                </div>
              ) : (
                <>
                  <Icons.CloudDownload size={40} className="text-gray-400" />
                  <p className="text-dark-500 mt-2 text-sm">
                    <span className="text-secondary-700 font-medium">
                      {t(`${uploadP}.clickToUpload`, 'Click to upload')}
                    </span>{' '}
                    {t(`${uploadP}.orDragAndDrop`, 'or drag and drop')}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t(`${uploadP}.constraints`, {
                      defaultValue: 'CSV only, max 10 MB, max {{max}} rows',
                      max: BULK_MESSAGING_RECIPIENT_CAP.toLocaleString(),
                    })}
                  </p>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={isParsing}
              />
            </div>

            {uploadedFileName && !isParsing && (
              <p className="text-dark-500 text-sm">
                {t(`${uploadP}.selectedFile`, {
                  defaultValue: 'Selected file: {{name}}',
                  name: uploadedFileName,
                })}
              </p>
            )}

            {parseResult && (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-sm text-gray-700">
                  {t('pages.messagingCampaigns.csvLaunch.parseSummary', {
                    eligible: parseResult.eligible,
                    total: parseResult.total,
                    skipped: parseResult.skipped,
                    defaultValue: '{{eligible}} of {{total}} valid ({{skipped}} skipped)',
                  })}
                </p>
                {parseResult.sample?.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {parseResult.sample.map((row) => (
                      <li key={row.row_number}>
                        #{row.client_id} · {row.destination}
                        {row.name ? ` · ${row.name}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>

          {isFormLoading ? (
            <BulkSendMessageModalSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-dark-500 mb-1.5 block text-sm font-light">
                    {t('pages.clients.modals.bulkSendMessage.service', 'Service')}
                  </label>
                  <Select value={service || undefined} onValueChange={setService}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          'pages.clients.modals.bulkSendMessage.servicePlaceholder',
                          'Select a service'
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableIntegrations.map((integration) => (
                        <SelectItem key={integration.service} value={integration.service}>
                          {serviceLabel(integration.service)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-dark-500 mb-1.5 block text-sm font-light">
                    {t('pages.clients.modals.bulkSendMessage.draft', 'Draft')}
                  </label>
                  <Select
                    value={draftId}
                    onValueChange={handleDraftChange}
                    disabled={draftsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          'pages.clients.modals.bulkSendMessage.draftPlaceholder',
                          'Select a draft'
                        )}
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
                    onChange={(e) => {
                      setSubject(e.target.value)
                      setContentTouched(true)
                    }}
                    onFocus={() => {
                      lastFocusedRef.current = 'subject'
                    }}
                    required={channelSpec.subjectRequired}
                  />
                )}

                <Textarea
                  ref={bodyRef}
                  label={t('pages.clients.modals.sendMessage.body', 'Message body')}
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value)
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
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-dark-500 text-sm font-medium">
                        {t('pages.clients.modals.bulkSendMessage.draftPreview', 'Message preview')}
                      </span>
                      {previewLabel && (
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 ring-inset">
                          {previewLabel}
                        </span>
                      )}
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 ring-inset">
                        {channel.toUpperCase()}
                      </span>
                    </div>
                    <pre className="text-dark-500 max-h-48 overflow-auto rounded-lg bg-white p-3 font-mono text-xs whitespace-pre-wrap">
                      {body.trim() || '—'}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="w-full rounded-md">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canLaunch || isFormLoading}
          onClick={() => void handleLaunch()}
          className="w-full rounded-md"
          isLoading={createCampaignMutation.isPending}
          leftIcon={<Icons.MailSend01 size={16} />}
        >
          {t('pages.messagingCampaigns.csvLaunch.launch', 'Launch campaign')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CsvCampaignLaunchModal
