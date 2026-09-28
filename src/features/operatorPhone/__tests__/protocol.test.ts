import { describe, expect, it } from 'vitest'

import { MSG_READY_FOR_TOKEN, MSG_STATUS, MSG_TOKEN_EXPIRED, parsePhoneMessage } from '../protocol'

describe('parsePhoneMessage', () => {
  it('parses ready-for-token and token-expired', () => {
    expect(parsePhoneMessage({ type: MSG_READY_FOR_TOKEN })).toEqual({
      type: MSG_READY_FOR_TOKEN,
    })
    expect(parsePhoneMessage({ type: MSG_TOKEN_EXPIRED })).toEqual({
      type: MSG_TOKEN_EXPIRED,
    })
  })

  it('parses a status message with aor', () => {
    expect(
      parsePhoneMessage({ type: MSG_STATUS, status: 'ready', aor: 'operator-c22-u63' })
    ).toEqual({ type: MSG_STATUS, status: 'ready', aor: 'operator-c22-u63' })
  })

  it('rejects an unknown status value', () => {
    expect(parsePhoneMessage({ type: MSG_STATUS, status: 'exploded' })).toBeNull()
  })

  it('drops a non-string aor', () => {
    expect(parsePhoneMessage({ type: MSG_STATUS, status: 'connecting', aor: 5 })).toEqual({
      type: MSG_STATUS,
      status: 'connecting',
      aor: undefined,
    })
  })

  it('rejects non-object payloads and unknown types', () => {
    expect(parsePhoneMessage(null)).toBeNull()
    expect(parsePhoneMessage('nope')).toBeNull()
    expect(parsePhoneMessage({ type: 'something-else' })).toBeNull()
  })
})
