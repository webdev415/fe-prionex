import type {
  LetterDetail,
  LetterListItem,
  LetterParameters,
  LetterProcessingStatus,
  LetterReplyContext,
  ThreadAttachment,
  ThreadMessage,
} from '@/pages/LawyerWorkplace/types'
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

const DONE_STATUSES: LetterProcessingStatus[] = ['sent_to_kanban', 'on_board', 'auto_processed']

export function isLegalProcessingStatus(value: string): value is LetterProcessingStatus {
  return (
    value === 'new' ||
    value === 'in_progress' ||
    value === 'on_board' ||
    value === 'sent_to_kanban' ||
    value === 'auto_processed'
  )
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

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function messageBody(item: { body_text: string | null; body_html: string | null }): string {
  if (item.body_text?.trim()) return item.body_text
  if (item.body_html?.trim()) return stripHtml(item.body_html)
  return ''
}

function messageTimestamp(item: {
  direction: string
  received_at: string | null
  sent_at: string | null
}): string {
  if (item.direction === 'outgoing') {
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
  context?: LegalLookupContext
): Pick<LetterListItem, 'clientId' | 'clientName' | 'clientCode'> {
  if (clientId == null) {
    return { clientId: null, clientName: null, clientCode: null }
  }
  const client = context?.clientsById?.get(clientId)
  if (!client) {
    return {
      clientId: String(clientId),
      clientName: null,
      clientCode: `CL-${clientId}`,
    }
  }
  return {
    clientId: String(clientId),
    clientName: client.name,
    clientCode: client.code,
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
  const base = receivedAt ? new Date(receivedAt) : new Date()
  const due = new Date(base)
  due.setDate(due.getDate() + (slaDays ?? 14))
  return due.toISOString().slice(0, 10)
}

function countConfirmedParameters(message: LegalMessageDetail): number {
  let count = 0
  if (message.suggested_letter_type_id) count += 1
  if (message.suggested_client_id != null) count += 1
  if (message.suggested_lawyer_user_id != null) count += 1
  return count
}

export function mapInboxItemToLetterListItem(
  item: LegalInboxItem,
  context?: LegalLookupContext
): LetterListItem {
  const { name, email } = parseEmailAddress(item.from_address)
  const letterType = resolveLetterType(item.suggested_letter_type_id, context)
  const client = resolveClient(item.suggested_client_id, context)
  const status = isLegalProcessingStatus(item.processing_status) ? item.processing_status : 'new'

  return {
    id: item.id,
    referenceId: item.id.slice(0, 8).toUpperCase(),
    senderName: name,
    senderEmail: email,
    receivedAt: item.received_at ?? new Date().toISOString(),
    subject: item.subject?.trim() || '(no subject)',
    mailbox: resolveMailboxLabel(
      item.mailbox_id,
      context?.mailboxLabelById?.get(item.mailbox_id ?? '')
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
  const { name, email } = parseEmailAddress(item.from_address)
  const direction = item.direction === 'outgoing' ? 'outgoing' : 'incoming'

  return {
    id: item.id,
    direction,
    senderName: name,
    senderEmail: email,
    toMailbox: options?.toMailbox,
    sentAt: messageTimestamp(item),
    body: messageBody(item),
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
  const letterTypeId = message.suggested_letter_type_id ?? ''
  const letterType = letterTypeId ? context?.letterTypesById?.get(letterTypeId) : undefined
  const client = resolveClient(message.suggested_client_id, context)
  const lawyer = message.suggested_lawyer_user_id
    ? context?.lawyersByUserId?.get(message.suggested_lawyer_user_id)
    : undefined

  const confirmedCount = countConfirmedParameters(message)
  const totalParameters = 4

  return {
    letterType: letterType?.slug ?? letterTypeId,
    clientId: client.clientId ?? '',
    clientLabel:
      client.clientCode && client.clientName
        ? `${client.clientCode} · ${client.clientName}`
        : (client.clientCode ?? ''),
    contractId: '',
    contractLabel: '',
    dueDate: computeDueDateIso(message.received_at, letterType?.sla_days),
    dueDateHint: '',
    lawyerId:
      lawyer?.id ??
      (message.suggested_lawyer_user_id != null ? String(message.suggested_lawyer_user_id) : ''),
    lawyerLabel: lawyer?.display_name ?? '',
    autoConfidence: message.auto_process_eligible ? 90 : 0,
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
      processing_status: message.processing_status,
      direction: message.direction,
      received_at: message.received_at,
      is_quarantined: message.is_quarantined,
      needs_manual_review: message.needs_manual_review,
      suggested_letter_type_id: message.suggested_letter_type_id,
      suggested_client_id: message.suggested_client_id,
      suggested_lawyer_user_id: message.suggested_lawyer_user_id,
      auto_process_eligible: message.auto_process_eligible,
    },
    context
  )

  const recipientEmail = message.to_addresses[0] ?? ''

  const threadMessages = (thread?.messages ?? [])
    .filter((item) => !item.is_quarantined)
    .map((item) => {
      const toMailbox =
        item.direction !== 'outgoing' && item.id === message.id ? recipientEmail : undefined
      const mapped = mapThreadMessageToUi(item, { toMailbox })
      if (item.id === message.id) {
        return {
          ...mapped,
          attachments: mapMessageAttachments(message.attachments),
        }
      }
      return mapped
    })

  return {
    ...listItem,
    recipientEmail,
    thread: threadMessages,
    parameters: buildLetterParameters(message, context),
    replyDraft,
    replyContext: buildReplyContext(message, thread),
  }
}

export function mapListItemToPreviewDetail(summary: LetterListItem, replyDraft = ''): LetterDetail {
  return {
    ...summary,
    recipientEmail: summary.mailbox,
    parameters: {
      letterType: summary.letterType ?? '',
      clientId: summary.clientId ?? '',
      clientLabel: summary.clientCode
        ? `${summary.clientCode}${summary.clientName ? ` · ${summary.clientName}` : ''}`.trim()
        : '',
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
        body: summary.subject,
      },
    ],
  }
}

export function clientLookupFromClient(client: {
  id: number
  first_name: string
  last_name: string
  legacy_id?: string | null
}): LegalClientLookup {
  const code = client.legacy_id?.trim() || `CL-${String(client.id).padStart(5, '0')}`
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
  return {
    id: client.id,
    code,
    name,
    label: name ? `${code} · ${name}` : code,
  }
}

export function filterInboxByMailboxTab(
  items: LetterListItem[],
  filter: 'all' | 'new' | 'in_progress' | 'done'
): LetterListItem[] {
  if (filter === 'all') return items
  if (filter === 'new') return items.filter((item) => item.status === 'new')
  if (filter === 'in_progress') return items.filter((item) => item.status === 'in_progress')
  return items.filter((item) => DONE_STATUSES.includes(item.status))
}

export function buildLegalLookupContext(
  letterTypes: LegalLetterType[] | undefined,
  lawyers: LegalLawyer[] | undefined,
  clients?: LegalClientLookup[]
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

  return { letterTypesById, lawyersByUserId, lawyersById, clientsById }
}
