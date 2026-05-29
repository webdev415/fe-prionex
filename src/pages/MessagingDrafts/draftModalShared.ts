import type { MessagingChannel, MessagingDraft } from '@/features/messaging'

export const CHANNEL_SPECS: Record<
  MessagingChannel,
  {
    showSubject: boolean
    subjectRequired: boolean
    senderMaxLength: number
    bodyMaxLength: number
  }
> = {
  sms: {
    showSubject: false,
    subjectRequired: false,
    senderMaxLength: 11,
    bodyMaxLength: 1071,
  },
  viber: {
    showSubject: false,
    subjectRequired: false,
    senderMaxLength: 20,
    bodyMaxLength: 1000,
  },
  email: {
    showSubject: true,
    subjectRequired: true,
    senderMaxLength: 100,
    bodyMaxLength: 50000,
  },
}

export function extractDraftVariables(draft: MessagingDraft): string[] {
  const stored = draft.available_variables ?? []
  if (stored.length > 0) return stored

  const text = `${draft.body}\n${draft.subject ?? ''}`
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g
  const seen: string[] = []
  for (const match of text.matchAll(re)) {
    const name = match[1]
    if (!seen.includes(name)) seen.push(name)
  }
  return seen
}
