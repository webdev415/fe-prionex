import type { MessagingChannel } from '../api/types'

const isValidPhone = (value: string | null | undefined): value is string =>
  !!value && !/^0+$/.test(value.trim())

export function collectClientPhones(
  phones: string[] | undefined,
  phonePrimary: string | null | undefined
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const phone of phones ?? []) {
    if (!isValidPhone(phone) || seen.has(phone)) continue
    seen.add(phone)
    result.push(phone)
  }

  if (isValidPhone(phonePrimary) && !seen.has(phonePrimary)) {
    result.unshift(phonePrimary)
  }

  return result
}

export function resolveDestinationPhone(phones: string[], preferredPhone?: string | null): string {
  if (isValidPhone(preferredPhone) && phones.includes(preferredPhone)) {
    return preferredPhone
  }
  if (isValidPhone(preferredPhone)) {
    return preferredPhone
  }
  return phones[0] ?? ''
}

export function getChannelDestinationLabel(channel: MessagingChannel): 'phone' | 'email' {
  return channel === 'email' ? 'email' : 'phone'
}
