import { PERMISSIONS, type Permission } from '@/constants/permissions'
import type { MessagingChannel } from '../api/types'

const SEND_BY_CHANNEL: Record<MessagingChannel, Permission> = {
  sms: PERMISSIONS.MESSAGING.SEND_MESSAGE_SMS,
  viber: PERMISSIONS.MESSAGING.SEND_MESSAGE_VIBER,
  email: PERMISSIONS.MESSAGING.SEND_MESSAGE_EMAIL,
}

const LAUNCH_BY_CHANNEL: Record<MessagingChannel, Permission> = {
  sms: PERMISSIONS.MESSAGING.LAUNCH_CAMPAIGN_SMS,
  viber: PERMISSIONS.MESSAGING.LAUNCH_CAMPAIGN_VIBER,
  email: PERMISSIONS.MESSAGING.LAUNCH_CAMPAIGN_EMAIL,
}

export const ALL_MESSAGING_SEND_PERMISSIONS: Permission[] = Object.values(SEND_BY_CHANNEL)
export const ALL_MESSAGING_LAUNCH_PERMISSIONS: Permission[] = Object.values(LAUNCH_BY_CHANNEL)

export function sendPermissionForChannel(channel: MessagingChannel): Permission {
  return SEND_BY_CHANNEL[channel]
}

export function launchPermissionForChannel(channel: MessagingChannel): Permission {
  return LAUNCH_BY_CHANNEL[channel]
}

export const REFERRER_CONTACT_TYPE_ID = 28

export type DestinationOwner = 'client' | 'referrer' | 'work' | 'other'

export type ClientPhoneOption = {
  number: string
  contactTypeId?: number
  contactTypeCode?: string | null
  label?: string
}

export function resolveDestinationOwner(
  phone: string,
  options: ClientPhoneOption[],
  workPhone?: string | null
): DestinationOwner {
  const normalized = phone.trim()
  if (workPhone && workPhone.trim() === normalized) {
    return 'work'
  }
  const match = options.find((o) => o.number.trim() === normalized)
  if (!match) {
    return 'other'
  }
  if (match.contactTypeId === REFERRER_CONTACT_TYPE_ID || match.contactTypeCode === 'referrer') {
    return 'referrer'
  }
  return 'client'
}

export function destinationOwnerLabelKey(owner: string | null | undefined): string | null {
  if (!owner) return null
  switch (owner) {
    case 'client':
      return 'pages.clients.messageHistory.destinationOwner.client'
    case 'referrer':
      return 'pages.clients.messageHistory.destinationOwner.referrer'
    case 'work':
      return 'pages.clients.messageHistory.destinationOwner.work'
    case 'other':
      return 'pages.clients.messageHistory.destinationOwner.other'
    default:
      return null
  }
}
