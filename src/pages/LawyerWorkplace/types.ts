export type LawyerWorkplaceTab = 'inbox' | 'kanban' | 'documents' | 'settings'

export type IncomingMailboxFilter = 'all' | 'new' | 'in_progress' | 'done'

export type IncomingFolder = 'inbox' | 'quarantine' | 'sent'

export type LetterDisplayStatus = 'new' | 'in_progress' | 'auto_processed' | 'done'

export type LetterProcessingStatus = LetterDisplayStatus | 'on_board' | 'sent_to_kanban'

export interface LetterListItem {
  id: string
  referenceId: string
  senderName: string
  senderEmail: string
  /** External party email for routing display (may differ from senderEmail on Sent rows). */
  routeFromEmail: string
  routeToEmail: string
  direction: 'incoming' | 'outgoing'
  receivedAt: string
  subject: string
  mailbox: string
  letterType: string | null
  letterTypeLabel: string | null
  clientId: string | null
  clientName: string | null
  clientCode: string | null
  status: LetterDisplayStatus
  isUnprocessed: boolean
}

export interface ThreadAttachment {
  id: string
  filename: string
  sizeLabel: string
  mimeType: string
}

export type ThreadMessageBodyFormat = 'text' | 'html'

export interface ThreadMessage {
  id: string
  direction: 'incoming' | 'outgoing'
  senderName: string
  senderEmail: string
  /** The mailbox the message was sent to (shows "to X" in header) */
  toMailbox?: string
  /** OAuth / relay label, e.g. "via Gmail (OAuth2)" */
  viaLabel?: string
  sentAt: string
  dateGroupLabel?: string
  body: string
  bodyFormat: ThreadMessageBodyFormat
  attachments?: ThreadAttachment[]
}

export interface LetterParameters {
  letterType: string
  clientId: string
  clientLabel: string
  clientLockedByEmail: boolean
  clientProjectId: number | null
  contractId: string
  contractLabel: string
  dueDate: string
  dueDateHint: string
  lawyerId: string
  lawyerLabel: string
  autoConfidence: number
  confirmedCount: number
  totalParameters: number
}

export interface LetterDetail extends LetterListItem {
  recipientEmail: string
  thread: ThreadMessage[]
  parameters: LetterParameters
  replyDraft: string
  replyContext: LetterReplyContext
  legalTaskId?: number | null
  confirmedLetterTypeId?: string | null
  suggestedLetterTypeId?: string | null
  processingStatus?: string
  updatedAt?: string | null
}

export interface LetterReplyContext {
  threadId: string
  mailboxId: string | null
  inReplyToMessageId: string
  clientId: number | null
  assignedUserId: number | null
}
