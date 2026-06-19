import { useEffect, useMemo, useRef, useState } from 'react'
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
import { cn } from '@/lib/utils'
import {
  MESSAGING_CHANNELS,
  MessagingVariablesPalette,
  ViberRichContentFields,
  buildDraftChannelOptions,
  insertMessagingVariableAtCursor,
  readDraftViberFormState,
  resetViberImages,
  viberPublicUrls,
  type MessagingTemplateFocusField,
  type MessagingViberImageAttachment,
  useCreateMessagingDraft,
  useMessagingDrafts,
  useUpdateMessagingDraft,
} from '@/features/messaging'
import type { MessagingChannel, MessagingDraft } from '@/features/messaging'
import { formatDateTime } from '@/lib/formatters'
import { DeleteDraftModal } from './DeleteDraftModal'
import { DraftViewModal } from './DraftViewModal'
import { MessagingDraftsTableSkeleton } from './components/MessagingDraftsPageSkeleton'

interface TableIconButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'danger'
  children: React.ReactNode
}

function TableIconButton({
  label,
  onClick,
  disabled,
  variant = 'default',
  children,
}: TableIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'focus-visible:ring-primary-500 inline-flex h-8 w-8 items-center justify-center rounded-md border bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'danger'
          ? 'border-red-200 text-red-600 hover:bg-red-50'
          : 'hover:border-primary-500 hover:text-primary-600 border-gray-300 text-gray-500'
      )}
    >
      {children}
    </button>
  )
}

// Per-channel form rules. Drives subject visibility, body limits / char
// counter, sender-name constraints, placeholders, and helper text.
interface ChannelSpec {
  showSubject: boolean
  subjectRequired: boolean
  bodyMaxLength: number
  // SMS-only segmentation thresholds; ignored for other channels.
  gsmSingleLimit?: number
  cyrillicSingleLimit?: number
  gsmConcatLimit?: number
  cyrillicConcatLimit?: number
  senderMaxLength: number
}

const CHANNEL_SPECS: Record<MessagingChannel, ChannelSpec> = {
  sms: {
    showSubject: false,
    subjectRequired: false,
    bodyMaxLength: 1071, // 7 SMS segments (153 chars each, GSM-7)
    gsmSingleLimit: 160,
    cyrillicSingleLimit: 70,
    gsmConcatLimit: 153,
    cyrillicConcatLimit: 67,
    senderMaxLength: 11,
  },
  viber: {
    showSubject: false,
    subjectRequired: false,
    bodyMaxLength: 1000,
    senderMaxLength: 20,
  },
  email: {
    showSubject: true,
    subjectRequired: true,
    bodyMaxLength: 50000,
    senderMaxLength: 100,
  },
}

// Crude but reliable Cyrillic / non-GSM detector: any code point above U+007F
// forces UCS-2 encoding on SMS, which slashes single-segment capacity 160 → 70.
const hasNonGsmChar = (text: string) => {
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 0x7f) return true
  }
  return false
}

const getSmsSegmentInfo = (body: string, spec: ChannelSpec) => {
  if (!spec.gsmSingleLimit || !spec.cyrillicSingleLimit) return null
  const cyrillic = hasNonGsmChar(body)
  const single = cyrillic ? spec.cyrillicSingleLimit : spec.gsmSingleLimit
  const concat = cyrillic
    ? (spec.cyrillicConcatLimit ?? spec.cyrillicSingleLimit)
    : (spec.gsmConcatLimit ?? spec.gsmSingleLimit)
  const length = body.length
  const segments = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / concat)
  return { cyrillic, single, concat, segments }
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
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [viberAddImage, setViberAddImage] = useState(false)
  const [viberImages, setViberImages] = useState<MessagingViberImageAttachment[]>([])
  const [viberAddButton, setViberAddButton] = useState(false)
  const [viberButtonName, setViberButtonName] = useState('')
  const [viberButtonUrl, setViberButtonUrl] = useState('')

  // Track which text field was focused last so the variable palette knows
  // where to insert the chosen variable.
  const subjectRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const lastFocusedRef = useRef<MessagingTemplateFocusField>('body')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return

    setName(draft?.name ?? '')
    setChannel(draft?.channel ?? 'sms')
    setSubject(draft?.subject ?? '')
    setBody(draft?.body ?? '')
    const viberForm = readDraftViberFormState(draft)
    setViberAddImage(viberForm.addImage)
    setViberImages(viberForm.images)
    setViberAddButton(viberForm.addButton)
    setViberButtonName(viberForm.buttonName)
    setViberButtonUrl(viberForm.buttonUrl)
    lastFocusedRef.current = 'body'
  }, [draft, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const spec = CHANNEL_SPECS[channel]

  // When the user switches a draft from email → SMS/Viber, the previously
  // entered subject becomes meaningless. Clearing it here keeps the saved
  // payload aligned with what the user sees and avoids surfacing stale data
  // if they later flip back to email.
  const handleChannelChange = (next: MessagingChannel) => {
    if (next === channel) return
    setChannel(next)
    if (!CHANNEL_SPECS[next].showSubject) {
      setSubject('')
    }
    if (next !== 'viber') {
      setViberAddImage(false)
      setViberImages((prev) => resetViberImages(prev))
      setViberAddButton(false)
      setViberButtonName('')
      setViberButtonUrl('')
    }
  }

  const isPending = createDraftMutation.isPending || updateDraftMutation.isPending
  const viberImageUploading = viberImages.some((image) => image.uploading)
  const trimmedName = name.trim()
  const trimmedBody = body.trim()
  const trimmedSubject = subject.trim()

  const smsSegments = channel === 'sms' ? getSmsSegmentInfo(body, spec) : null
  // SMS counter uses one-part limits (160 GSM-7 / 70 UCS-2), not multi-part totals.
  const bodyCharLimit = channel === 'sms' && smsSegments ? smsSegments.single : spec.bodyMaxLength
  const bodyTooShort = trimmedBody.length === 0
  const bodyTooLong = body.length > bodyCharLimit

  const subjectInvalid = spec.subjectRequired && !trimmedSubject

  const canSubmit =
    !!trimmedName &&
    !!trimmedBody &&
    !subjectInvalid &&
    !bodyTooLong &&
    !viberImageUploading &&
    !isPending

  const handleSubmit = async () => {
    if (!canSubmit) return

    const channelOptions = buildDraftChannelOptions(channel, {
      urlImages: viberPublicUrls(viberImages),
      buttonName: viberButtonName,
      buttonUrl: viberButtonUrl,
    })

    const payload = {
      name: trimmedName,
      channel,
      sender_name: null,
      subject: spec.showSubject ? trimmedSubject || null : null,
      body: trimmedBody,
      available_variables: null,
      channel_options: channelOptions,
    }

    if (isEditing && draft) {
      await updateDraftMutation.mutateAsync({ draftId: draft.id, payload })
    } else {
      await createDraftMutation.mutateAsync(payload)
    }

    onClose()
  }

  const insertVariableAtCursor = (variableName: string) => {
    insertMessagingVariableAtCursor({
      variableName,
      subject,
      body,
      setSubject,
      setBody,
      showSubject: spec.showSubject,
      subjectRef,
      bodyRef,
      lastFocusedRef,
    })
  }

  const bodyError = bodyTooShort
    ? t('pages.messagingDrafts.form.bodyRequired', {
        defaultValue: 'Message body is required.',
      })
    : bodyTooLong
      ? t('pages.messagingDrafts.form.bodyTooLong', {
          max: bodyCharLimit,
          channel: channel.toUpperCase(),
          defaultValue: `Body exceeds the ${bodyCharLimit}-character limit for ${channel.toUpperCase()}.`,
        })
      : undefined

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.BubbleChatEdit size={18} className="text-dark-500" strokeWidth={1.5} />
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
            label={`${t('pages.messagingDrafts.form.name', 'Draft name')} *`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('pages.messagingDrafts.form.namePlaceholder', 'Payment reminder')}
          />
          <div>
            <label className="text-dark-500 mb-1.5 block text-sm font-light">
              {t('pages.messagingDrafts.form.channel', 'Channel')}{' '}
              <span className="text-error-500">*</span>
            </label>
            <Select
              value={channel}
              onValueChange={(value) => handleChannelChange(value as MessagingChannel)}
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

          {spec.showSubject && (
            <Input
              ref={subjectRef}
              label={`${t('pages.messagingDrafts.form.subject', 'Subject')} *`}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              onFocus={() => {
                lastFocusedRef.current = 'subject'
              }}
              placeholder={t(
                'pages.messagingDrafts.form.subjectPlaceholder',
                'Reminder about your account'
              )}
              maxLength={500}
              error={
                subjectInvalid
                  ? t('pages.messagingDrafts.form.subjectRequiredError', {
                      defaultValue: 'Subject is required for email drafts.',
                    })
                  : undefined
              }
            />
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="draft-body" className="text-dark-500 text-sm font-light">
              {t('pages.messagingDrafts.form.body', 'Message body')}{' '}
              <span className="text-error-500">*</span>
            </label>
            <span className="shrink-0 text-xs text-gray-500 tabular-nums">
              {t('pages.messagingDrafts.form.charCount', {
                count: body.length,
                max: bodyCharLimit,
                defaultValue: `${body.length} / ${bodyCharLimit}`,
              })}
            </span>
          </div>
          <Textarea
            id="draft-body"
            ref={bodyRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onFocus={() => {
              lastFocusedRef.current = 'body'
            }}
            placeholder={
              channel === 'sms'
                ? t(
                    'pages.messagingDrafts.form.bodyPlaceholderSms',
                    'Hi {{client_name}}, your payment of {{debt_amount}} UAH is due on {{due_date}}. — CRM Prionex'
                  )
                : channel === 'viber'
                  ? t(
                      'pages.messagingDrafts.form.bodyPlaceholderViber',
                      'Hi {{client_name}}, your payment of {{debt_amount}} UAH is due on {{due_date}}. Tap reply to confirm.'
                    )
                  : t(
                      'pages.messagingDrafts.form.bodyPlaceholderEmail',
                      'Dear {{client_name}},\n\nThis is a reminder that your payment of {{debt_amount}} UAH for contract {{contract_number}} is due on {{due_date}}.\n\nBest regards,\nCRM Prionex'
                    )
            }
            textareaSize="lg"
            error={bodyError}
          />
        </div>

        <MessagingVariablesPalette className="mt-4" onInsert={insertVariableAtCursor} />

        {channel === 'viber' && (
          <ViberRichContentFields
            className="mt-4"
            imageRemovalMode="template-editor"
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
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="w-full rounded-md">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          className="w-full rounded-md"
          disabled={!canSubmit}
          isLoading={isPending}
        >
          {isEditing ? t('actions.save', 'Save') : t('actions.create', 'Create')}
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
  const [viewDraft, setViewDraft] = useState<MessagingDraft | null>(null)
  const [deleteDraft, setDeleteDraft] = useState<MessagingDraft | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: drafts = [], isLoading } = useMessagingDrafts(
    channelFilter === 'all' ? undefined : (channelFilter as MessagingChannel)
  )

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
        key: 'updated_at',
        header: t('pages.messagingDrafts.table.updatedAt', 'Updated'),
        align: 'left',
        render: (draft) => formatDateTime(draft.updated_at ?? draft.created_at ?? undefined),
      },
      {
        key: 'actions',
        header: t('pages.messagingDrafts.table.actions', 'Actions'),
        align: 'center',
        render: (draft) => (
          <div className="flex items-center justify-center gap-2">
            <TableIconButton
              label={t('pages.messagingDrafts.actions.view', 'View draft')}
              onClick={() => setViewDraft(draft)}
            >
              <Icons.View size={16} strokeWidth={1.5} />
            </TableIconButton>
            <PermissionGuard permission={PERMISSIONS.MESSAGING.MANAGE_DRAFTS}>
              <TableIconButton
                label={t('actions.edit', 'Edit')}
                onClick={() => setEditingDraft(draft)}
              >
                <Icons.PencilEdit size={16} strokeWidth={1.5} />
              </TableIconButton>
              <TableIconButton
                label={t('actions.delete', 'Delete')}
                variant="danger"
                onClick={() => setDeleteDraft(draft)}
              >
                <Icons.Delete size={16} strokeWidth={1.5} />
              </TableIconButton>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    [t]
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
          <MessagingDraftsTableSkeleton />
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
      <DraftViewModal
        draft={viewDraft}
        open={viewDraft !== null}
        onClose={() => setViewDraft(null)}
      />
      <DeleteDraftModal
        draft={deleteDraft}
        open={deleteDraft !== null}
        onClose={() => setDeleteDraft(null)}
      />
    </div>
  )
}

export default MessagingDraftsPage
