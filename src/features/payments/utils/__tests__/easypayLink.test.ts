import { describe, it, expect } from 'vitest'
import { canOfferEasyPayLink, easypayLinkAction } from '../easypayLink'

const row = (over: Partial<Parameters<typeof canOfferEasyPayLink>[0]> = {}) => ({
  easypayMethod: 'card',
  easypayLink: 'https://easypay.ua/ua/wp2/abc',
  status: 'pending',
  ...over,
})

describe('canOfferEasyPayLink', () => {
  it('offers the link on a pending EasyPay payment', () => {
    expect(canOfferEasyPayLink(row())).toBe(true)
  })

  it('withholds it from a payment that never went through EasyPay', () => {
    expect(canOfferEasyPayLink(row({ easypayMethod: null }))).toBe(false)
    expect(canOfferEasyPayLink(row({ easypayMethod: undefined }))).toBe(false)
  })

  it('withholds it once the payment has settled either way', () => {
    // Nothing left to pay, so a live checkout link would be a trap.
    expect(canOfferEasyPayLink(row({ status: 'verified' }))).toBe(false)
    expect(canOfferEasyPayLink(row({ status: 'cancelled' }))).toBe(false)
  })
})

describe('easypayLinkAction', () => {
  it('copies the stored link', () => {
    expect(easypayLinkAction(row())).toEqual({
      kind: 'copy',
      url: 'https://easypay.ua/ua/wp2/abc',
    })
  })

  it('reports a missing link rather than copying nothing', () => {
    // Reachable when the gateway call failed after the payment row was written.
    expect(easypayLinkAction(row({ easypayLink: null }))).toEqual({ kind: 'unavailable' })
    expect(easypayLinkAction(row({ easypayLink: undefined }))).toEqual({ kind: 'unavailable' })
    expect(easypayLinkAction(row({ easypayLink: '' }))).toEqual({ kind: 'unavailable' })
    expect(easypayLinkAction(row({ easypayLink: '   ' }))).toEqual({ kind: 'unavailable' })
  })
})
