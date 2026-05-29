import type { MessagingClientHistoryItem } from '../api/types'

/** Recipient statuses stored by messaging-service (lowercase). */
export type MessagingRecipientStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'skipped'
  | string

function isIntelTeleSentAsDelivered(service: string | undefined, normalized: string): boolean {
  return (service || '').trim().toLowerCase() === 'intel_tele' && normalized === 'sent'
}

/**
 * Map API recipient status to CallLogCard / legacy SMS display labels.
 * ``sent`` means accepted by the provider but not yet confirmed delivered,
 * except Intel-Tele email (SMTP accept = delivered, no webhooks).
 */
export function messagingStatusForCallLogCard(
  status: string,
  service?: string
): 'Delivered' | 'Failed' | 'Pending' | 'Skipped' | 'Sent' {
  const normalized = (status || '').trim().toLowerCase()
  if (normalized === 'delivered' || isIntelTeleSentAsDelivered(service, normalized)) {
    return 'Delivered'
  }
  if (normalized === 'failed' || normalized === 'bounced') return 'Failed'
  if (normalized === 'skipped') return 'Skipped'
  if (normalized === 'sent') return 'Sent'
  return 'Pending'
}

export function isMessagingDelivered(status: string, service?: string): boolean {
  const normalized = (status || '').trim().toLowerCase()
  return normalized === 'delivered' || isIntelTeleSentAsDelivered(service, normalized)
}

export function isMessagingFailed(status: string): boolean {
  const normalized = (status || '').trim().toLowerCase()
  return normalized === 'failed' || normalized === 'bounced'
}

export function isMessagingPending(status: string): boolean {
  const normalized = (status || '').trim().toLowerCase()
  return normalized === 'pending' || normalized === 'queued'
}

export function isMessagingSkipped(status: string): boolean {
  return (status || '').trim().toLowerCase() === 'skipped'
}

export function countMessagingHistoryByOutcome(items: MessagingClientHistoryItem[]) {
  let delivered = 0
  let failed = 0
  let pending = 0
  let skipped = 0

  for (const item of items) {
    if (isMessagingDelivered(item.status, item.service)) delivered += 1
    else if (isMessagingFailed(item.status)) failed += 1
    else if (isMessagingSkipped(item.status)) skipped += 1
    else if (isMessagingPending(item.status)) pending += 1
  }

  return { delivered, failed, pending, skipped, total: items.length }
}
