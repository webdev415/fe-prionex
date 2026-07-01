import type { TFunction } from 'i18next'

import { contactTypeLabel } from '@/features/clients/utils/contactTypeLabel'

import type { MessagingChannel } from '../api/types'
import { destinationOwnerLabelKey } from './messagingPermissions'

export type MessagingDestinationDisplay = {
  destination: string
  /** Shown after destination as ``· label`` (contact type name or owner bucket). */
  ownerSuffix?: string
}

type ContactTypeRow = { code: string; name: string }

/**
 * Format destination line for message history cards and the detail modal.
 *
 * Prefers ``destination_contact_type_id`` (e.g. "Mobile") over coarse
 * ``destination_owner`` buckets ("client" / "referrer"). Email omits the
 * owner bucket when no contact type is stored.
 */
export function formatMessagingHistoryDestination(
  item: {
    destination?: string | null
    destination_owner?: string | null
    destination_contact_type_id?: number | null
    channel: MessagingChannel
  },
  ctx: {
    t: TFunction
    language: string
    contactTypesById: Map<number, ContactTypeRow>
  }
): MessagingDestinationDisplay {
  const destination = (item.destination ?? '').trim() || '-'

  const typeId = item.destination_contact_type_id
  if (typeId != null) {
    const ct = ctx.contactTypesById.get(typeId)
    if (ct) {
      return {
        destination,
        ownerSuffix: contactTypeLabel(ct, ctx.t, ctx.language),
      }
    }
  }

  if (item.channel === 'email') {
    return { destination }
  }

  if (item.channel === 'sms' || item.channel === 'viber') {
    const key = destinationOwnerLabelKey(item.destination_owner)
    if (key) {
      return {
        destination,
        ownerSuffix: ctx.t(key),
      }
    }
  }

  return { destination }
}
