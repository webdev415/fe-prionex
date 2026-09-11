import type { MessagingChannel, MessagingDraft } from '@/features/messaging'

/**
 * SMS bodies are capped differently depending on where they are typed, and the
 * two numbers are deliberate rather than drift.
 *
 * A draft is capped at 350 (KAN-1101). The cap used to be recalculated on every
 * keystroke as the single-segment capacity, so one character above U+007F
 * dropped it from 160 to 70 and made ordinary Cyrillic templates unsaveable.
 * 350 replaced that: flat, content-independent, and a client-side product rule
 * rather than a limit the backend imposes. Checked while implementing KAN-1101
 * (api-prionex services/messaging: schemas/draft.py declares body with
 * min_length only, models/messaging_draft.py stores it as Text), so if the API
 * ever adds a maximum below 350 this cap stops being the binding one.
 *
 * The ad-hoc send and campaign composers keep 1071 (seven GSM-7 segments), the
 * limit they have always had. Lowering them to 350 would take away message
 * length that works today, which KAN-1101 did not ask for; raising drafts to
 * 1071 would undo the product decision. Change either only on purpose.
 */
export const SMS_DRAFT_BODY_MAX_LENGTH = 350
export const SMS_COMPOSER_BODY_MAX_LENGTH = 1071

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
    bodyMaxLength: SMS_COMPOSER_BODY_MAX_LENGTH,
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
