/**
 * Shared contact-type icons for phone search indicators and Recommenders pills.
 * Icons reuse the phone-search contact-source set (User = client, Contact = recommender).
 */

import type { ReactElement } from 'react'
import { Icons } from '@/lib/icons'
import type { ContactSource } from '@/features/clients/api/types'

export function ContactSourceFilterIcon({
  source,
  size = 16,
  className,
}: {
  source: ContactSource
  size?: number
  className?: string
}): ReactElement {
  if (source === 'client') {
    return <Icons.User size={size} strokeWidth={2} className={className} />
  }
  return <Icons.Contact size={size} strokeWidth={2} className={className} />
}

/** Icon inside a Recommenders contact-type pill. */
export function ContactTypePillIcon({
  contactSource,
  isPhone,
  code,
  size = 12,
}: {
  contactSource?: ContactSource
  isPhone: boolean
  code: string | null | undefined
  size?: number
}): ReactElement {
  const c = (code ?? '').toLowerCase()
  if (!isPhone) {
    if (c.includes('email') || c.includes('mail')) {
      return <Icons.Mail size={size} strokeWidth={2} className="shrink-0" />
    }
    if (c.includes('address') || c.includes('registration') || c.includes('actual')) {
      return <Icons.Location01 size={size} strokeWidth={2} className="shrink-0" />
    }
    return <Icons.Contact size={size} strokeWidth={2} className="shrink-0" />
  }
  const source: ContactSource =
    contactSource ??
    (c.includes('third_party') || c.includes('verified') || c.includes('referrer')
      ? 'recommender'
      : 'client')
  return <ContactSourceFilterIcon source={source} size={size} className="shrink-0" />
}
