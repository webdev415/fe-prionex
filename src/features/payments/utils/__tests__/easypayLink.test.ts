import { describe, it, expect, vi, afterEach } from 'vitest'
import { canOfferEasyPayLink, copyToClipboard, easypayLinkAction } from '../easypayLink'

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

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports success when the write goes through', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyToClipboard('https://easypay.ua/x')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://easypay.ua/x')
  })

  it('reports failure when the browser refuses the write', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    await expect(copyToClipboard('https://easypay.ua/x')).resolves.toBe(false)
  })

  it('reports failure rather than throwing when there is no clipboard', async () => {
    // Plain http: the API is absent and calling writeText on it throws
    // synchronously, which no rejection handler catches. Returning false is
    // the whole point -- in the save flow that throw escaped inside the
    // mutation's onSuccess and took the modal-close with it.
    vi.stubGlobal('navigator', {})

    await expect(copyToClipboard('https://easypay.ua/x')).resolves.toBe(false)
  })

  it('reports failure when clipboard exists but writeText does not', async () => {
    vi.stubGlobal('navigator', { clipboard: {} })

    await expect(copyToClipboard('https://easypay.ua/x')).resolves.toBe(false)
  })
})
