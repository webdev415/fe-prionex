import { describe, expect, it } from 'vitest'

import { formatMessagingHistoryDestination } from './formatMessagingDestination'

const t = ((key: string) => {
  const map: Record<string, string> = {
    'pages.clients.messageHistory.destinationOwner.client': 'Client',
    'pages.clients.messageHistory.destinationOwner.referrer': 'Referrer',
  }
  return map[key] ?? key
}) as never

const contactTypesById = new Map([
  [29, { code: 'mobile', name: 'Мобільний' }],
  [28, { code: 'referrer', name: 'Поручитель' }],
])

describe('formatMessagingHistoryDestination', () => {
  it('uses contact type name when destination_contact_type_id is set', () => {
    const out = formatMessagingHistoryDestination(
      {
        channel: 'viber',
        destination: '380981150735',
        destination_owner: 'client',
        destination_contact_type_id: 29,
      },
      { t, language: 'uk', contactTypesById }
    )
    expect(out.destination).toBe('380981150735')
    expect(out.ownerSuffix).toBe('Мобільний')
  })

  it('omits owner bucket suffix for email without contact type', () => {
    const out = formatMessagingHistoryDestination(
      {
        channel: 'email',
        destination: 'user@example.com',
        destination_owner: 'client',
        destination_contact_type_id: null,
      },
      { t, language: 'en', contactTypesById }
    )
    expect(out.destination).toBe('user@example.com')
    expect(out.ownerSuffix).toBeUndefined()
  })

  it('falls back to owner bucket for sms when contact type id missing', () => {
    const out = formatMessagingHistoryDestination(
      {
        channel: 'sms',
        destination: '380950174084',
        destination_owner: 'referrer',
      },
      { t, language: 'en', contactTypesById }
    )
    expect(out.ownerSuffix).toBe('Referrer')
  })
})
