import type {
  LetterDetail,
  LetterDisplayStatus,
  LetterListItem,
  LetterParameters,
  LetterProcessingStatus,
  LetterReplyContext,
  ThreadAttachment,
  ThreadMessage,
  ThreadMessageBodyFormat,
} from '@/pages/LawyerWorkplace/types'
import { looksLikeHtml } from '../utils/emailHtml'
import type {
  LegalAttachmentItem,
  LegalInboxItem,
  LegalLawyer,
  LegalLetterType,
  LegalMessageDetail,
  LegalThreadDetail,
  LegalThreadMessageItem,
} from './types'

export interface LegalClientLookup {
  id: number
  label: string
  name: string
  code: string
}

export interface LegalLookupContext {
  letterTypesById?: Map<string, LegalLetterType>
  lawyersByUserId?: Map<number, LegalLawyer>
  lawyersById?: Map<string, LegalLawyer>
  clientsById?: Map<number, LegalClientLookup>
  mailboxLabelById?: Map<string, string>
}

export function isLegalProcessingStatus(value: string): value is LetterProcessingStatus {
  return (
    value === 'new' ||
    value === 'in_progress' ||
    value === 'auto_processed' ||
    value === 'done' ||
    value === 'on_board' ||
    value === 'sent_to_kanban'
  )
}

export function mapProcessingStatusToDisplay(
  value: string,
  needsManualReview = false
): LetterDisplayStatus {
  if (value === 'done' || value === 'sent') return 'done'
  if (value === 'auto_processed') {
    return needsManualReview ? 'in_progress' : 'auto_processed'
  }
  if (value === 'in_progress' || value === 'sent_to_kanban' || value === 'on_board') {
    return 'in_progress'
  }
  return 'new'
}

export function isOutgoingMessageDirection(direction: string): boolean {
  return direction === 'outgoing' || direction === 'outbound'
}

export function isLetterParametersReadOnly(letter: {
  status: LetterDisplayStatus
  isUnprocessed: boolean
  direction?: string
}): boolean {
  if (letter.direction && isOutgoingMessageDirection(letter.direction)) {
    return true
  }
  if (letter.isUnprocessed) {
    return false
  }
  if (letter.status === 'new') {
    return false
  }
  return true
}

export function parseEmailAddress(from: string): { name: string; email: string } {
  const trimmed = from.trim()
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, ''),
      email: match[2].trim(),
    }
  }
  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0] ?? trimmed
    return { name: local, email: trimmed }
  }
  return { name: trimmed, email: trimmed }
}

export function formatAttachmentSize(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function mapMessageContent(item: { body_text: string | null; body_html: string | null }): {
  body: string
  bodyFormat: ThreadMessageBodyFormat
} {
  const text = item.body_text?.trim() ?? ''
  const html = item.body_html?.trim() ?? ''

  // Prefer sanitized HTML from the backend when available.
  if (html) {
    return { body: html, bodyFormat: 'html' }
  }
  // Some senders put HTML markup in the text/plain part.
  if (text && looksLikeHtml(text)) {
    return { body: text, bodyFormat: 'html' }
  }
  if (text) {
    return { body: text, bodyFormat: 'text' }
  }
  return { body: '', bodyFormat: 'text' }
}

function isOutgoingDirection(direction: string): boolean {
  return isOutgoingMessageDirection(direction)
}

function normalizeEmailAddress(address: string | null | undefined): string {
  if (!address?.trim()) return ''
  const { email } = parseEmailAddress(address)
  return email.trim() || address.trim()
}

function resolveCorrespondenceRoute(
  item: {
    direction: string
    from_address: string
    to_addresses?: string[]
    mailbox_id?: string | null
    mailbox_email?: string | null
  },
  context?: LegalLookupContext
): { routeFromEmail: string; routeToEmail: string } {
  const mailboxEmail = resolveMailboxLabel(
    item.mailbox_id,
    item.mailbox_email ?? context?.mailboxLabelById?.get(item.mailbox_id ?? '')
  )
  const counterpartyFromDisplay = normalizeEmailAddress(item.from_address)
  const counterpartyTo = normalizeEmailAddress(item.to_addresses?.[0]) || counterpartyFromDisplay

  if (isOutgoingDirection(item.direction)) {
    return {
      routeFromEmail: mailboxEmail,
      routeToEmail: counterpartyTo,
    }
  }

  return {
    routeFromEmail: counterpartyFromDisplay,
    routeToEmail: mailboxEmail,
  }
}

function messageTimestamp(item: {
  direction: string
  received_at: string | null
  sent_at: string | null
}): string {
  if (isOutgoingDirection(item.direction)) {
    return item.sent_at ?? item.received_at ?? new Date().toISOString()
  }
  return item.received_at ?? item.sent_at ?? new Date().toISOString()
}

function mapAttachment(item: LegalAttachmentItem): ThreadAttachment {
  const sizeLabel = formatAttachmentSize(item.size_bytes)
  return {
    id: item.id,
    filename: item.filename,
    sizeLabel,
    mimeType: item.content_type ?? 'application/octet-stream',
  }
}

function resolveLetterType(
  letterTypeId: string | null | undefined,
  context?: LegalLookupContext
): { slug: string | null; label: string | null } {
  if (!letterTypeId) return { slug: null, label: null }
  const letterType = context?.letterTypesById?.get(letterTypeId)
  if (!letterType) return { slug: letterTypeId, label: letterTypeId }
  return { slug: letterType.slug, label: letterType.name }
}

function resolveClient(
  clientId: number | null | undefined,
  context?: LegalLookupContext,
  clientNameOverride?: string | null
): Pick<LetterListItem, 'clientId' | 'clientName' | 'clientCode'> {
  if (clientId == null) {
    return { clientId: null, clientName: null, clientCode: null }
  }
  const code = `CL-${clientId}`
  if (clientNameOverride?.trim()) {
    return {
      clientId: String(clientId),
      clientName: clientNameOverride.trim(),
      clientCode: code,
    }
  }
  const client = context?.clientsById?.get(clientId)
  if (!client) {
    return {
      clientId: String(clientId),
      clientName: null,
      clientCode: code,
    }
  }
  return {
    clientId: String(clientId),
    clientName: client.name,
    clientCode: code,
  }
}

function resolveMailboxLabel(
  mailboxId: string | null | undefined,
  fallback?: string | null
): string {
  if (fallback?.trim()) return fallback
  if (!mailboxId) return ''
  return mailboxId
}

function computeDueDateIso(receivedAt: string | null, slaDays: number | undefined): string {
  // Only compute when a letter type SLA is known — never invent a default
  // due date for unclassified messages.
  if (slaDays == null || !Number.isFinite(slaDays) || slaDays <= 0) {
    return ''
  }
  const base = receivedAt ? new Date(receivedAt) : new Date()
  const due = new Date(base)
  due.setDate(due.getDate() + slaDays)
  return due.toISOString().slice(0, 10)
}

function countConfirmedParameters(
  message: LegalMessageDetail,
  dueDateIso: string | null | undefined
): number {
  let count = 0
  if (message.suggested_letter_type_id) count += 1
  if (message.suggested_client_id != null) count += 1
  if (message.suggested_lawyer_user_id != null) count += 1
  if (dueDateIso) count += 1
  return count
}

function resolveInboxSenderTitle(
  item: Pick<LegalInboxItem, 'from_address' | 'suggested_client_id' | 'suggested_client_name'>,
  context?: LegalLookupContext
): { senderName: string; senderEmail: string } {
  const { email } = parseEmailAddress(item.from_address)
  const senderEmail = email.trim() || item.from_address.trim()

  if (item.suggested_client_id != null) {
    const clientName =
      item.suggested_client_name?.trim() ||
      context?.clientsById?.get(item.suggested_client_id)?.name ||
      null
    if (clientName) {
      return { senderName: clientName, senderEmail }
    }
  }

  return { senderName: senderEmail, senderEmail }
}

export function mapInboxItemToLetterListItem(
  item: LegalInboxItem,
  context?: LegalLookupContext
): LetterListItem {
  const { senderName, senderEmail } = resolveInboxSenderTitle(item, context)
  const letterType = resolveLetterType(item.suggested_letter_type_id, context)
  const client = resolveClient(item.suggested_client_id, context, item.suggested_client_name)
  const status = mapProcessingStatusToDisplay(item.processing_status, item.needs_manual_review)
  const { routeFromEmail, routeToEmail } = resolveCorrespondenceRoute(item, context)
  const direction: LetterListItem['direction'] = isOutgoingDirection(item.direction)
    ? 'outgoing'
    : 'incoming'

  return {
    id: item.id,
    referenceId: item.id.slice(0, 8).toUpperCase(),
    senderName,
    senderEmail,
    routeFromEmail,
    routeToEmail,
    direction,
    receivedAt: item.received_at ?? new Date().toISOString(),
    subject: item.subject?.trim() || '(no subject)',
    mailbox: resolveMailboxLabel(
      item.mailbox_id,
      item.mailbox_email ?? context?.mailboxLabelById?.get(item.mailbox_id ?? '')
    ),
    letterType: letterType.slug,
    letterTypeLabel: letterType.label,
    ...client,
    status,
    isUnprocessed: item.needs_manual_review,
  }
}

export function mapThreadMessageToUi(
  item: LegalThreadMessageItem,
  options?: { toMailbox?: string }
): ThreadMessage {
  const { email } = parseEmailAddress(item.from_address)
  const senderEmail = email.trim() || item.from_address.trim()
  const direction = isOutgoingDirection(item.direction) ? 'outgoing' : 'incoming'

  return {
    id: item.id,
    direction,
    // Default to the sender's email address. A client name is layered on by
    // the caller when the sender resolves to a known client — see
    // mapMessageToLetterDetail.
    senderName: senderEmail,
    senderEmail,
    toMailbox: options?.toMailbox,
    sentAt: messageTimestamp(item),
    ...mapMessageContent(item),
  }
}

function buildReplyContext(
  message: LegalMessageDetail,
  thread: LegalThreadDetail | undefined
): LetterReplyContext {
  const threadMessages = thread?.messages ?? []
  const lastMessageId = threadMessages.at(-1)?.id ?? message.id
  return {
    threadId: message.thread_id,
    mailboxId: message.mailbox_id,
    inReplyToMessageId: lastMessageId,
    clientId: message.suggested_client_id,
    assignedUserId: message.suggested_lawyer_user_id,
  }
}

export function mapMessageAttachments(
  attachments: LegalAttachmentItem[] | undefined
): ThreadAttachment[] {
  return (attachments ?? []).filter((item) => !item.is_quarantined).map(mapAttachment)
}

export function buildLetterParameters(
  message: LegalMessageDetail,
  context?: LegalLookupContext
): LetterParameters {
  const letterTypeId = message.confirmed_letter_type_id ?? message.suggested_letter_type_id ?? ''
  const letterType = letterTypeId ? context?.letterTypesById?.get(letterTypeId) : undefined
  const client = resolveClient(message.suggested_client_id, context, message.suggested_client_name)
  const lawyer = message.suggested_lawyer_user_id
    ? context?.lawyersByUserId?.get(message.suggested_lawyer_user_id)
    : undefined

  const slaDueDate = letterType ? computeDueDateIso(message.received_at, letterType.sla_days) : ''
  const dueDate =
    message.suggested_due_date != null && message.suggested_due_date !== ''
      ? message.suggested_due_date.slice(0, 10)
      : slaDueDate
  const confirmedCount = countConfirmedParameters(message, dueDate)
  const totalParameters = 4
  const contractLabel =
    message.confirmed_contract_number?.trim() || message.suggested_contract_number?.trim() || ''

  return {
    letterType: letterType?.slug ?? letterTypeId,
    clientId: client.clientId ?? '',
    clientLabel:
      client.clientCode && client.clientName
        ? `${client.clientCode} · ${client.clientName}`
        : (client.clientCode ?? ''),
    clientLockedByEmail: message.suggested_client_source === 'sender_email',
    clientProjectId: message.suggested_client_project_id ?? null,
    contractId: contractLabel,
    contractLabel,
    dueDate,
    dueDateHint: '',
    lawyerId:
      lawyer?.id ??
      (message.suggested_lawyer_user_id != null ? String(message.suggested_lawyer_user_id) : ''),
    lawyerLabel: lawyer?.display_name ?? '',
    autoConfidence: 0,
    confirmedCount,
    totalParameters,
  }
}

export function mapMessageToLetterDetail(
  message: LegalMessageDetail,
  thread: LegalThreadDetail | undefined,
  context?: LegalLookupContext,
  replyDraft = ''
): LetterDetail {
  const listItem = mapInboxItemToLetterListItem(
    {
      id: message.id,
      thread_id: message.thread_id,
      mailbox_id: message.mailbox_id,
      subject: message.subject,
      from_address: message.from_address,
      to_addresses: message.to_addresses,
      processing_status: message.processing_status,
      direction: message.direction,
      received_at: message.received_at,
      is_quarantined: message.is_quarantined,
      needs_manual_review: message.needs_manual_review,
      suggested_letter_type_id: message.suggested_letter_type_id,
      suggested_client_id: message.suggested_client_id,
      suggested_client_source: message.suggested_client_source,
      suggested_client_name: message.suggested_client_name,
      suggested_client_project_id: message.suggested_client_project_id,
      suggested_lawyer_user_id: message.suggested_lawyer_user_id,
      auto_process_eligible: message.auto_process_eligible,
    },
    context
  )

  const recipientEmail = listItem.routeToEmail

  const threadMessages = (thread?.messages ?? [])
    .filter((item) => !item.is_quarantined)
    .map((item) => {
      const toMailbox =
        item.to_addresses?.[0]?.trim() ||
        (!isOutgoingDirection(item.direction) && item.id === message.id
          ? recipientEmail
          : undefined)
      const attachmentSource =
        item.attachments ?? (item.id === message.id ? message.attachments : undefined)
      const mapped = mapThreadMessageToUi(item, { toMailbox })
      // Mirror the inbox list: when the thread message is the same incoming sender,
      // reuse the resolved client display name from the list item mapper.
      const senderName =
        mapped.direction === 'incoming' &&
        mapped.senderEmail.trim().toLowerCase() === listItem.senderEmail.trim().toLowerCase()
          ? listItem.senderName
          : mapped.senderName
      return {
        ...mapped,
        senderName,
        attachments: mapMessageAttachments(attachmentSource),
      }
    })

  return {
    ...listItem,
    recipientEmail,
    thread: threadMessages,
    parameters: buildLetterParameters(message, context),
    replyDraft,
    replyContext: buildReplyContext(message, thread),
    legalTaskId: message.legal_task_id ?? null,
    confirmedLetterTypeId: message.confirmed_letter_type_id ?? null,
    suggestedLetterTypeId: message.suggested_letter_type_id ?? null,
    processingStatus: message.processing_status,
    updatedAt: message.updated_at ?? null,
    sourceMailboxDisabled: Boolean(message.source_mailbox_disabled),
  }
}

export function mapListItemToPreviewDetail(summary: LetterListItem, replyDraft = ''): LetterDetail {
  return {
    ...summary,
    recipientEmail: summary.routeToEmail,
    parameters: {
      letterType: summary.letterType ?? '',
      clientId: summary.clientId ?? '',
      clientLabel: summary.clientCode
        ? `${summary.clientCode}${summary.clientName ? ` · ${summary.clientName}` : ''}`.trim()
        : '',
      clientLockedByEmail: false,
      clientProjectId: null,
      contractId: '',
      contractLabel: '',
      dueDate: '',
      dueDateHint: '',
      lawyerId: '',
      lawyerLabel: '',
      autoConfidence: 0,
      confirmedCount: 0,
      totalParameters: 4,
    },
    replyDraft,
    replyContext: {
      threadId: '',
      mailboxId: null,
      inReplyToMessageId: summary.id,
      clientId: summary.clientId ? Number(summary.clientId) || null : null,
      assignedUserId: null,
    },
    thread: [
      {
        id: `${summary.id}-preview`,
        direction: 'incoming',
        senderName: summary.senderName,
        senderEmail: summary.senderEmail,
        toMailbox: summary.mailbox,
        sentAt: summary.receivedAt,
        body: '',
        bodyFormat: 'text',
      },
    ],
  }
}

export function clientLookupFromClient(client: {
  id: number
  first_name: string
  last_name: string
}): LegalClientLookup {
  const code = `CL-${client.id}`
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
  return {
    id: client.id,
    code,
    name,
    label: name ? `${code} · ${name}` : code,
  }
}

export function clientLookupFromLegalSearchItem(client: {
  id: number
  first_name: string
  last_name: string
}): LegalClientLookup {
  return clientLookupFromClient(client)
}

export function filterInboxByMailboxTab(
  items: LetterListItem[],
  filter: 'all' | 'new' | 'in_progress' | 'done'
): LetterListItem[] {
  if (filter === 'all') return items
  if (filter === 'new') return items.filter((item) => item.status === 'new')
  if (filter === 'in_progress') return items.filter((item) => item.status === 'in_progress')
  return items.filter((item) => item.status === 'done')
}

export function buildLegalLookupContext(
  letterTypes: LegalLetterType[] | undefined,
  lawyers: LegalLawyer[] | undefined,
  clients?: LegalClientLookup[],
  mailboxes?: Array<{ id: string; email: string }>
): LegalLookupContext {
  const letterTypesById = new Map<string, LegalLetterType>()
  for (const letterType of letterTypes ?? []) {
    letterTypesById.set(letterType.id, letterType)
  }

  const lawyersByUserId = new Map<number, LegalLawyer>()
  const lawyersById = new Map<string, LegalLawyer>()
  for (const lawyer of lawyers ?? []) {
    lawyersByUserId.set(lawyer.user_id, lawyer)
    lawyersById.set(lawyer.id, lawyer)
  }

  const clientsById = new Map<number, LegalClientLookup>()
  for (const client of clients ?? []) {
    clientsById.set(client.id, client)
  }

  const mailboxLabelById = new Map<string, string>()
  for (const mailbox of mailboxes ?? []) {
    if (mailbox.email?.trim()) {
      mailboxLabelById.set(mailbox.id, mailbox.email.trim())
    }
  }

  return { letterTypesById, lawyersByUserId, lawyersById, clientsById, mailboxLabelById }
}
