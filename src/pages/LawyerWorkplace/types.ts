export type LawyerWorkplaceTab = 'inbox' | 'kanban' | 'documents' | 'settings'

export type IncomingMailboxFilter = 'all' | 'new' | 'in_progress' | 'done'

export type IncomingFolder = 'inbox' | 'quarantine' | 'sent'

export type LetterProcessingStatus =
  | 'new'
  | 'in_progress'
  | 'on_board'
  | 'sent_to_kanban'
  | 'auto_processed'

export interface LetterListItem {
  id: string
  referenceId: string
  senderName: string
  senderEmail: string
  receivedAt: string
  subject: string
  mailbox: string
  letterType: string | null
  letterTypeLabel: string | null
  clientId: string | null
  clientName: string | null
  clientCode: string | null
  status: LetterProcessingStatus
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
}

export interface LetterReplyContext {
  threadId: string
  mailboxId: string | null
  inReplyToMessageId: string
  clientId: number | null
  assignedUserId: number | null
}
