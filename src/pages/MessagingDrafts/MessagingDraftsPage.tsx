import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
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
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'
import {
  MESSAGING_CHANNELS,
  useCreateMessagingDraft,
  useDeleteMessagingDraft,
  useMessagingDrafts,
  usePreviewMessagingDraft,
  useUpdateMessagingDraft,
} from '@/features/messaging'
import type { MessagingChannel, MessagingDraft } from '@/features/messaging'

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

interface DraftFormModalProps {
  draft: MessagingDraft | null
  open: boolean
  onClose: () => void
}

function DraftFormModal({ draft, open, onClose }: DraftFormModalProps) {
  const { t } = useTranslation('common')
  const createDraftMutation = useCreateMessagingDraft()
  const updateDraftMutation = useUpdateMessagingDraft()
  const isEditing = Boolean(draft)

  const [name, setName] = useState('')
  const [channel, setChannel] = useState<MessagingChannel>('sms')
  const [senderName, setSenderName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return

    setName(draft?.name ?? '')
    setChannel(draft?.channel ?? 'sms')
    setSenderName(draft?.sender_name ?? '')
    setSubject(draft?.subject ?? '')
    setBody(draft?.body ?? '')
  }, [draft, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const isPending = createDraftMutation.isPending || updateDraftMutation.isPending
  const requiresSubject = channel === 'email'
  const canSubmit = name.trim() && body.trim() && (!requiresSubject || subject.trim())

  const handleSubmit = async () => {
    if (!canSubmit) return

    const payload = {
      name: name.trim(),
      channel,
      sender_name: senderName.trim() || null,
      subject: subject.trim() || null,
      body: body.trim(),
      available_variables: null,
    }

    if (isEditing && draft) {
      await updateDraftMutation.mutateAsync({ draftId: draft.id, payload })
    } else {
      await createDraftMutation.mutateAsync(payload)
    }

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
        title={
          isEditing
            ? t('pages.messagingDrafts.editTitle', 'Edit draft')
            : t('pages.messagingDrafts.createTitle', 'Create draft')
        }
      />
      <ModalContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label={t('pages.messagingDrafts.form.name', 'Draft name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('pages.messagingDrafts.form.namePlaceholder', 'Payment reminder')}
          />
          <div>
            <label className="text-dark-500 mb-1.5 block text-sm font-light">
              {t('pages.messagingDrafts.form.channel', 'Channel')}
            </label>
            <Select
              value={channel}
              onValueChange={(value) => setChannel(value as MessagingChannel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESSAGING_CHANNELS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            label={t('pages.messagingDrafts.form.senderName', 'Sender name')}
            value={senderName}
            onChange={(event) => setSenderName(event.target.value)}
            placeholder={t('pages.messagingDrafts.form.senderNamePlaceholder', 'CRM Prionex')}
          />
          <Input
            label={t('pages.messagingDrafts.form.subject', 'Subject')}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t(
              'pages.messagingDrafts.form.subjectPlaceholder',
              'Reminder about your account'
            )}
            helperText={
              requiresSubject
                ? t(
                    'pages.messagingDrafts.form.subjectRequired',
                    'Subject is required for email drafts'
                  )
                : t(
                    'pages.messagingDrafts.form.subjectOptional',
                    'Optional for SMS and Viber drafts'
                  )
            }
          />
        </div>

        <div className="mt-4">
          <Textarea
            label={t('pages.messagingDrafts.form.body', 'Message body')}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t(
              'pages.messagingDrafts.form.bodyPlaceholder',
              'Hello {{first_name}}, this is a reminder about your account.'
            )}
            textareaSize="lg"
          />
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <div className="text-dark-500 font-medium">
            {t('pages.messagingDrafts.availableVariables', 'Common variables')}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['{{first_name}}', '{{last_name}}', '{{full_name}}', '{{phone}}', '{{email}}'].map(
              (variable) => (
                <code
                  key={variable}
                  className="text-dark-500 rounded bg-gray-100 px-2 py-1 text-xs"
                >
                  {variable}
                </code>
              )
            )}
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} size="sm">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          size="sm"
          disabled={!canSubmit || isPending}
          isLoading={isPending}
        >
          {isEditing ? t('actions.save', 'Save') : t('actions.create', 'Create')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

interface DraftPreviewModalProps {
  draft: MessagingDraft | null
  open: boolean
  onClose: () => void
}

function DraftPreviewModal({ draft, open, onClose }: DraftPreviewModalProps) {
  const { t } = useTranslation('common')
  const previewDraftMutation = usePreviewMessagingDraft()
  const [variablesJson, setVariablesJson] = useState('{\n  "first_name": "Alice"\n}')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setVariablesJson('{\n  "first_name": "Alice"\n}')
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const previewResult = previewDraftMutation.data

  const handlePreview = async () => {
    if (!draft) return

    let parsed: Record<string, unknown> = {}
    try {
      parsed = variablesJson.trim() ? (JSON.parse(variablesJson) as Record<string, unknown>) : {}
    } catch {
      previewDraftMutation.reset()
      throw new Error('Invalid JSON')
    }

    await previewDraftMutation.mutateAsync({
      draftId: draft.id,
      variables: parsed,
    })
  }

  const handleRunPreview = async () => {
    try {
      await handlePreview()
    } catch {
      // Keep the UX simple for now: invalid JSON is shown inline.
    }
  }

  let variablesError = ''
  try {
    if (variablesJson.trim()) {
      JSON.parse(variablesJson)
    }
  } catch {
    variablesError = t('pages.messagingDrafts.preview.invalidJson', 'Variables must be valid JSON')
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl">
      <ModalHeader
        title={
          draft
            ? t('pages.messagingDrafts.preview.titleWithName', {
                name: draft.name,
                defaultValue: draft.name,
              })
            : t('pages.messagingDrafts.preview.title', 'Preview draft')
        }
      />
      <ModalContent>
        <div className="space-y-4">
          <Textarea
            label={t('pages.messagingDrafts.preview.variables', 'Preview variables (JSON)')}
            value={variablesJson}
            onChange={(event) => setVariablesJson(event.target.value)}
            textareaSize="md"
            error={variablesError}
          />

          {previewResult && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <div className="text-dark-500 text-sm font-medium">
                  {t('pages.messagingDrafts.preview.renderedSubject', 'Rendered subject')}
                </div>
                <div className="mt-1 text-sm text-gray-600">{previewResult.subject || '-'}</div>
              </div>

              <div>
                <div className="text-dark-500 text-sm font-medium">
                  {t('pages.messagingDrafts.preview.renderedBody', 'Rendered body')}
                </div>
                <pre className="text-dark-500 mt-1 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
                  {previewResult.body}
                </pre>
              </div>

              <div>
                <div className="text-dark-500 text-sm font-medium">
                  {t('pages.messagingDrafts.preview.missingVariables', 'Missing variables')}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {previewResult.missing_variables.length > 0
                    ? previewResult.missing_variables.join(', ')
                    : t('pages.messagingDrafts.preview.noneMissing', 'None')}
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} size="sm">
          {t('actions.close', 'Close')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleRunPreview}
          size="sm"
          disabled={!draft || !!variablesError || previewDraftMutation.isPending}
          isLoading={previewDraftMutation.isPending}
        >
          {t('pages.messagingDrafts.preview.action', 'Render preview')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export function MessagingDraftsPage() {
  const { t } = useTranslation('common')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingDraft, setEditingDraft] = useState<MessagingDraft | null>(null)
  const [previewDraft, setPreviewDraft] = useState<MessagingDraft | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: drafts = [], isLoading } = useMessagingDrafts(
    channelFilter === 'all' ? undefined : (channelFilter as MessagingChannel)
  )
  const deleteDraftMutation = useDeleteMessagingDraft()

  const filteredDrafts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return drafts

    return drafts.filter((draft) => {
      return (
        draft.name.toLowerCase().includes(query) ||
        draft.body.toLowerCase().includes(query) ||
        (draft.subject || '').toLowerCase().includes(query)
      )
    })
  }, [drafts, searchQuery])

  const columns = useMemo<Column<MessagingDraft>[]>(
    () => [
      {
        key: 'name',
        header: t('pages.messagingDrafts.table.name', 'Draft'),
        align: 'left',
      },
      {
        key: 'channel',
        header: t('pages.messagingDrafts.table.channel', 'Channel'),
        align: 'left',
        render: (draft) => draft.channel.toUpperCase(),
      },
      {
        key: 'sender_name',
        header: t('pages.messagingDrafts.table.senderName', 'Sender'),
        align: 'left',
        render: (draft) => draft.sender_name || '-',
      },
      {
        key: 'updated_at',
        header: t('pages.messagingDrafts.table.updatedAt', 'Updated'),
        align: 'left',
        render: (draft) => formatDateTime(draft.updated_at ?? draft.created_at),
      },
      {
        key: 'actions',
        header: t('pages.messagingDrafts.table.actions', 'Actions'),
        align: 'center',
        render: (draft) => (
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setPreviewDraft(draft)}
            >
              {t('pages.messagingDrafts.actions.preview', 'Preview')}
            </Button>
            <PermissionGuard permission={PERMISSIONS.MESSAGING.MANAGE_DRAFTS}>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setEditingDraft(draft)}
              >
                {t('actions.edit', 'Edit')}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="xs"
                onClick={() => deleteDraftMutation.mutate(draft.id)}
                disabled={deleteDraftMutation.isPending}
              >
                {t('actions.delete', 'Delete')}
              </Button>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [deleteDraftMutation, t]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('navigation.messagingDrafts', 'Message Drafts')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t(
              'pages.messagingDrafts.description',
              'Manage reusable message bodies for SMS, Viber, and email campaigns.'
            )}
          </p>
        </div>
        <PermissionGuard permission={PERMISSIONS.MESSAGING.MANAGE_DRAFTS}>
          <Button type="button" variant="primary" onClick={() => setShowCreateModal(true)}>
            {t('pages.messagingDrafts.actions.newDraft', 'New draft')}
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/70 bg-white/60 p-4 md:grid-cols-2">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t('pages.messagingDrafts.filters.search', 'Search draft name or content')}
        />
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger>
            <SelectValue placeholder={t('pages.messagingDrafts.filters.channel', 'Channel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('pages.messagingDrafts.filters.allChannels', 'All channels')}
            </SelectItem>
            {MESSAGING_CHANNELS.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channel.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-white/70 bg-white/60 p-4">
        {isLoading ? (
          <div className="py-8 text-sm text-gray-500">{t('status.loading', 'Loading...')}</div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredDrafts}
            emptyMessage={t('pages.messagingDrafts.empty', 'No drafts matched the current filters')}
          />
        )}
      </div>

      <DraftFormModal
        draft={null}
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      <DraftFormModal
        draft={editingDraft}
        open={editingDraft !== null}
        onClose={() => setEditingDraft(null)}
      />
      <DraftPreviewModal
        draft={previewDraft}
        open={previewDraft !== null}
        onClose={() => setPreviewDraft(null)}
      />
    </div>
  )
}

export default MessagingDraftsPage
