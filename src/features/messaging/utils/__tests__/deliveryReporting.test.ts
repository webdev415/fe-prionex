import { describe, expect, it } from 'vitest'
import {
  isMessagingDelivered,
  messagingStatusForCallLogCard,
  serviceReportsDelivery,
} from '../recipientStatus'
import { KNOWN_MESSAGING_SERVICES } from '../../api/types'

describe('serviceReportsDelivery', () => {
  it('reports zadarma as having no delivery receipts', () => {
    expect(serviceReportsDelivery('zadarma')).toBe(false)
  })

  it('ignores casing and surrounding whitespace', () => {
    expect(serviceReportsDelivery('  ZaDaRmA ')).toBe(false)
  })

  it('keeps every Ukrainian provider reporting', () => {
    for (const service of ['turbosms', 'omnicell', 'vodafone_obm', 'my2_viber', 'intel_tele']) {
      expect(serviceReportsDelivery(service)).toBe(true)
    }
  })

  it('treats an unknown or missing service as reporting', () => {
    expect(serviceReportsDelivery(undefined)).toBe(true)
    expect(serviceReportsDelivery('')).toBe(true)
    expect(serviceReportsDelivery('some_future_provider')).toBe(true)
  })

  it('classifies every registered service exactly once', () => {
    const withoutReports = KNOWN_MESSAGING_SERVICES.filter(
      (service) => !serviceReportsDelivery(service)
    )
    expect(withoutReports).toEqual(['zadarma'])
  })
})

describe('status mapping is unchanged for providers that do report', () => {
  it('leaves a zadarma sent row as Sent rather than inventing a delivery', () => {
    expect(messagingStatusForCallLogCard('sent', 'zadarma')).toBe('Sent')
    expect(isMessagingDelivered('sent', 'zadarma')).toBe(false)
  })

  it('still honours a real zadarma delivered row if one ever arrives', () => {
    expect(messagingStatusForCallLogCard('delivered', 'zadarma')).toBe('Delivered')
    expect(isMessagingDelivered('delivered', 'zadarma')).toBe(true)
  })

  it('keeps the intel_tele SMTP-accept rule', () => {
    expect(messagingStatusForCallLogCard('sent', 'intel_tele')).toBe('Delivered')
  })

  it('keeps turbosms sent distinct from delivered', () => {
    expect(messagingStatusForCallLogCard('sent', 'turbosms')).toBe('Sent')
    expect(messagingStatusForCallLogCard('delivered', 'turbosms')).toBe('Delivered')
  })
})
