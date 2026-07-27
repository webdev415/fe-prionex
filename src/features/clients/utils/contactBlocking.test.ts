import { describe, expect, it } from 'vitest'
import {
  isCallBlocked,
  isMessageBlocked,
  callBlockReason,
  messageBlockReason,
  type ContactBlockingFlags,
} from './contactBlocking'

const flags = (over: Partial<ContactBlockingFlags> = {}): ContactBlockingFlags => ({
  blocks_calls: false,
  blocks_sms: false,
  blocks_spam: false,
  reasons: [],
  ...over,
})

describe('isCallBlocked', () => {
  it('is true only when blocks_calls is set', () => {
    expect(isCallBlocked(flags({ blocks_calls: true }))).toBe(true)
    expect(isCallBlocked(flags({ blocks_sms: true, blocks_spam: true }))).toBe(false)
  })

  it('is false for missing blocking data', () => {
    expect(isCallBlocked(null)).toBe(false)
    expect(isCallBlocked(undefined)).toBe(false)
  })
})

describe('isMessageBlocked', () => {
  it('is true when blocks_sms OR blocks_spam is set', () => {
    expect(isMessageBlocked(flags({ blocks_sms: true }))).toBe(true)
    expect(isMessageBlocked(flags({ blocks_spam: true }))).toBe(true)
    expect(isMessageBlocked(flags({ blocks_sms: true, blocks_spam: true }))).toBe(true)
  })

  it('is false when neither message flag is set', () => {
    expect(isMessageBlocked(flags({ blocks_calls: true }))).toBe(false)
    expect(isMessageBlocked(flags())).toBe(false)
    expect(isMessageBlocked(null)).toBe(false)
  })
})

describe('callBlockReason', () => {
  it('names only the call-blocking tag(s)', () => {
    const reason = callBlockReason(
      flags({
        blocks_calls: true,
        reasons: ['Calls blocked: Do Not Call', 'SMS blocked: Do Not SMS'],
      })
    )
    expect(reason).toBe('Calls blocked: Do Not Call')
  })

  it('is empty when nothing blocks calls', () => {
    expect(callBlockReason(flags({ blocks_sms: true, reasons: ['SMS blocked: Do Not SMS'] }))).toBe(
      ''
    )
  })
})

describe('messageBlockReason', () => {
  it('names both SMS- and Spam-blocking tags', () => {
    const reason = messageBlockReason(
      flags({
        blocks_sms: true,
        blocks_spam: true,
        reasons: [
          'Calls blocked: Do Not Call',
          'SMS blocked: Do Not SMS',
          'Spam blocked: Do Not Spam',
        ],
      })
    )
    expect(reason).toBe('SMS blocked: Do Not SMS; Spam blocked: Do Not Spam')
  })

  it('is empty when nothing blocks messages', () => {
    expect(
      messageBlockReason(flags({ blocks_calls: true, reasons: ['Calls blocked: Do Not Call'] }))
    ).toBe('')
  })
})
