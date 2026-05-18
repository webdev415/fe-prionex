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
  isMessagingIntegrationUsable,
  useCreateMessagingCampaign,
  useMessagingDrafts,
  useMessagingIntegrations,
  usePreviewMessagingRecipients,
  getMessagingServiceLabel,
} from '@/features/messaging'
import type { MessagingChannel } from '@/features/messaging'

interface BulkSendMessageModalProps {
  open: boolean
  clientIds: number[]
  selectedClients: Array<{
    id: number
    fullName: string
    priority: 'Critical' | 'High' | 'Medium' | 'Low'
    score: number
    debt: string
  }>
  totalSelectedCount: number
  allClientsSelectedAcrossPages?: boolean
  onClose: () => void
  onLaunched?: () => void
}

const formatDateStamp = () =>
  new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date())

export function BulkSendMessageModal({
  open,
  clientIds,
  selectedClients,
  totalSelectedCount,
  allClientsSelectedAcrossPages = false,
  onClose,
  onLaunched,
}: BulkSendMessageModalProps) {
  const { t } = useTranslation('common')
  const [campaignName, setCampaignName] = useState('')
  const [channel, setChannel] = useState<MessagingChannel>('sms')
  const [service, setService] = useState('')
  const [draftId, setDraftId] = useState('')
  const [notes, setNotes] = useState('')

  const { data: integrations = [], isLoading: integrationsLoading } = useMessagingIntegrations(open)
  const { data: drafts = [], isLoading: draftsLoading } = useMessagingDrafts(channel)
  const previewRecipientsMutation = usePreviewMessagingRecipients()
  const createCampaignMutation = useCreateMessagingCampaign()
  const availableChannels = useMemo(
    () =>
      MESSAGING_CHANNELS.filter((item) =>
        integrations.some((integration) => isMessagingIntegrationUsable(integration, item))
      ),
    [integrations]
  )

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (availableChannels.length === 0) return
    if (!availableChannels.includes(channel)) {
      setChannel(availableChannels[0])
    }
  }, [availableChannels, channel, open])

  useEffect(() => {
    if (!open) return

    setCampaignName(`Bulk ${channel.toUpperCase()} campaign - ${formatDateStamp()}`)
    setNotes('')
  }, [channel, open])

  useEffect(() => {
    if (!open) return

    const availableService =
      integrations.find((integration) => isMessagingIntegrationUsable(integration, channel))
        ?.service ?? ''
    setService(availableService)
  }, [channel, integrations, open])

  useEffect(() => {
    if (!open) return

    const availableDraftId = drafts[0]?.id ? String(drafts[0].id) : ''
    setDraftId(availableDraftId)
  }, [drafts, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const availableIntegrations = useMemo(
    () => integrations.filter((integration) => isMessagingIntegrationUsable(integration, channel)),
    [channel, integrations]
  )

  const previewClients = selectedClients.slice(0, 5)
  const remainingCount = Math.max(totalSelectedCount - previewClients.length, 0)
  const exactRowSelectionOnly = allClientsSelectedAcrossPages

  const canPreview =
    !exactRowSelectionOnly &&
    clientIds.length > 0 &&
    !previewRecipientsMutation.isPending &&
    !!channel
  const canLaunch =
    canPreview &&
    campaignName.trim().length > 0 &&
    !!service &&
    !!draftId &&
    !createCampaignMutation.isPending

  const handlePreview = async () => {
    if (!canPreview) return

    await previewRecipientsMutation.mutateAsync({
      channel,
      selectionPayload: {
        mode: 'ids',
        ids: clientIds,
      },
    })
  }

  const handleLaunch = async () => {
    if (!canLaunch) return

    await createCampaignMutation.mutateAsync({
      name: campaignName.trim(),
      channel,
      service,
      draft_id: Number(draftId),
      selection_payload: {
        mode: 'ids',
        ids: clientIds,
      },
      override_variables: notes.trim() ? { notes: notes.trim() } : {},
      source: 'bulk',
    })

    onLaunched?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.MailSend01 size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.bulkSendMessage.title', {
          count: totalSelectedCount,
          defaultValue: `Send message to ${totalSelectedCount} clients`,
        })}
      />
      <ModalContent>
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-dark-500 text-sm font-medium">
              {t(
                'pages.clients.modals.bulkSendMessage.selectedClients',
                'Selected clients preview'
              )}
            </div>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              {previewClients.map((client) => (
                <div
                  key={client.id}
                  className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3"
                >
                  <span className="text-dark-500 font-medium">
                    {client.fullName} (#{client.id})
                  </span>
                  <span>{client.priority}</span>
                  <span>{client.debt}</span>
                </div>
              ))}
              {remainingCount > 0 && (
                <div className="text-xs text-gray-500">
                  {t('pages.clients.modals.bulkSendMessage.andMore', {
                    count: remainingCount,
                    defaultValue: `and ${remainingCount} more clients`,
                  })}
                </div>
              )}
            </div>
          </div>

          {exactRowSelectionOnly && (
            <div className="border-warning-300 bg-warning-50 text-warning-800 rounded-xl border p-4 text-sm">
              {t(
                'pages.clients.modals.bulkSendMessage.crossPageWarning',
                'Bulk messaging currently supports explicit row selections. Please select the exact client rows you want to message instead of using select-all across pages.'
              )}
            </div>
          )}

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
              <label className="text-dark-500 mb-1.5 block text-sm font-light">
                {t('pages.clients.modals.bulkSendMessage.channel', 'Channel')}
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
                        'pages.clients.modals.bulkSendMessage.noChannels',
                        'No enabled channels are available'
                      )}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-dark-500 mb-1.5 block text-sm font-light">
                {t('pages.clients.modals.bulkSendMessage.service', 'Service')}
              </label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'pages.clients.modals.bulkSendMessage.servicePlaceholder',
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
                        'pages.clients.modals.bulkSendMessage.noServices',
                        'No enabled integrations for this channel'
                      )}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-dark-500 mb-1.5 block text-sm font-light">
                {t('pages.clients.modals.bulkSendMessage.draft', 'Draft')}
              </label>
              <Select value={draftId} onValueChange={setDraftId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      'pages.clients.modals.bulkSendMessage.draftPlaceholder',
                      draftsLoading ? 'Loading drafts...' : 'Select a draft'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {drafts.length > 0 ? (
                    drafts.map((draft) => (
                      <SelectItem key={draft.id} value={String(draft.id)}>
                        {draft.name}
                      </SelectItem>
                    ))
                  ) : (
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

          <Textarea
            label={t('pages.clients.modals.bulkSendMessage.notes', 'Internal notes (optional)')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            textareaSize="md"
            helperText={t(
              'pages.clients.modals.bulkSendMessage.notesHint',
              'These notes are stored as campaign override metadata and are not shown to recipients.'
            )}
          />

          {previewRecipientsMutation.data && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Total', previewRecipientsMutation.data.total],
                  ['Eligible', previewRecipientsMutation.data.eligible],
                  ['Skipped', previewRecipientsMutation.data.skipped],
                  [
                    'Sample',
                    Array.isArray(previewRecipientsMutation.data.sample)
                      ? previewRecipientsMutation.data.sample.length
                      : 0,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs tracking-wide text-gray-500 uppercase">{label}</div>
                    <div className="text-dark-500 mt-1 text-xl font-semibold">{value}</div>
                  </div>
                ))}
              </div>

              {Object.keys(previewRecipientsMutation.data.skipped_by_reason).length > 0 && (
                <div className="mt-4">
                  <div className="text-dark-500 text-sm font-medium">
                    {t('pages.clients.modals.bulkSendMessage.skippedReasons', 'Skipped reasons')}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(previewRecipientsMutation.data.skipped_by_reason).map(
                      ([reason, count]) => (
                        <span
                          key={reason}
                          className="text-dark-500 rounded-full bg-gray-100 px-3 py-1 text-xs"
                        >
                          {reason}: {count}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} size="sm">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          size="sm"
          disabled={!canPreview}
          isLoading={previewRecipientsMutation.isPending}
        >
          {t('pages.clients.modals.bulkSendMessage.preview', 'Preview recipients')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleLaunch}
          size="sm"
          disabled={!canLaunch}
          isLoading={createCampaignMutation.isPending}
        >
          {t('pages.clients.modals.bulkSendMessage.launch', 'Launch campaign')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default BulkSendMessageModal
