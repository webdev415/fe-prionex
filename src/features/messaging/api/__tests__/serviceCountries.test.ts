import { describe, it, expect } from 'vitest'
import {
  KNOWN_MESSAGING_SERVICES,
  REQUIRED_CREDENTIAL_KEYS,
  SERVICE_COUNTRIES,
  isMessagingIntegrationUsable,
  serviceServesCountry,
  type MessagingIntegration,
  type MessagingService,
} from '../types'

function usable(service: string): MessagingIntegration {
  return {
    service,
    supported_channels: ['sms'],
    enabled_channels: ['sms'],
    status: 'configured',
    last_test_result: { ok: true },
    credentials_preview: Object.fromEntries(
      REQUIRED_CREDENTIAL_KEYS[service as MessagingService].map((key) => [key, '***1234'])
    ),
  } as unknown as MessagingIntegration
}

describe('serviceServesCountry', () => {
  it('keeps the Ukrainian gateways out of a Spanish project', () => {
    for (const service of ['turbosms', 'omnicell', 'vodafone_obm', 'my2_viber']) {
      expect(serviceServesCountry(service, 'ES')).toBe(false)
      expect(serviceServesCountry(service, 'UA')).toBe(true)
    }
  })

  it('offers Zadarma in Spain', () => {
    expect(serviceServesCountry('zadarma', 'ES')).toBe(true)
  })

  it('offers email in both, because it is not tied to a phone network', () => {
    expect(serviceServesCountry('intel_tele', 'UA')).toBe(true)
    expect(serviceServesCountry('intel_tele', 'ES')).toBe(true)
  })

  it('names a country for every known service', () => {
    for (const service of KNOWN_MESSAGING_SERVICES) {
      expect(SERVICE_COUNTRIES[service].length).toBeGreaterThan(0)
    }
  })
})

describe('isMessagingIntegrationUsable', () => {
  it('rejects a Ukrainian provider on a Spanish project', () => {
    expect(isMessagingIntegrationUsable(usable('turbosms'), 'sms', 'ES')).toBe(false)
  })

  it('accepts Zadarma on a Spanish project', () => {
    expect(isMessagingIntegrationUsable(usable('zadarma'), 'sms', 'ES')).toBe(true)
  })

  it('accepts a Ukrainian provider on a Ukrainian project', () => {
    expect(isMessagingIntegrationUsable(usable('turbosms'), 'sms', 'UA')).toBe(true)
  })

  it('does not filter by country when none is given', () => {
    expect(isMessagingIntegrationUsable(usable('turbosms'), 'sms')).toBe(true)
    expect(isMessagingIntegrationUsable(usable('zadarma'), 'sms')).toBe(true)
  })
})
