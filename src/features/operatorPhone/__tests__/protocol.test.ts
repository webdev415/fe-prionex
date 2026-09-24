import { describe, expect, it } from 'vitest'

import {
  MSG_CALL_ANSWERED,
  MSG_CALL_ENDED,
  MSG_READY_FOR_TOKEN,
  MSG_ROUTED_CALL,
  MSG_STATUS,
  MSG_TOKEN_EXPIRED,
  parsePhoneMessage,
} from '../protocol'

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

  describe('routed call', () => {
    it('accepts a full payload from the dialer', () => {
      expect(
        parsePhoneMessage({
          type: MSG_ROUTED_CALL,
          call: {
            call_id: 'c-1',
            client_id: 218882,
            client_name: 'Олена Коваленко',
            phone: '380501234567',
            campaign_id: 44,
          },
        })
      ).toEqual({
        type: MSG_ROUTED_CALL,
        call: {
          call_id: 'c-1',
          client_id: 218882,
          client_name: 'Олена Коваленко',
          phone: '380501234567',
          campaign_id: 44,
        },
      })
    })

    it('normalises missing context to null rather than dropping the call', () => {
      // The dialer omits client context for a number that was uploaded without
      // one. The operator still has to be able to take the call.
      expect(parsePhoneMessage({ type: MSG_ROUTED_CALL, call: { call_id: 'c-2' } })).toEqual({
        type: MSG_ROUTED_CALL,
        call: {
          call_id: 'c-2',
          client_id: null,
          client_name: null,
          phone: null,
          campaign_id: null,
        },
      })
    })

    it('keys the lifecycle messages on call_id', () => {
      expect(parsePhoneMessage({ type: MSG_CALL_ANSWERED, call_id: 'c-1' })).toEqual({
        type: MSG_CALL_ANSWERED,
        call_id: 'c-1',
      })
      expect(parsePhoneMessage({ type: MSG_CALL_ENDED, call_id: 'c-1' })).toEqual({
        type: MSG_CALL_ENDED,
        call_id: 'c-1',
      })
    })

    it('drops a lifecycle message with no call_id rather than guessing', () => {
      // An unkeyed 'ended' would tear down whichever call is on screen, which
      // could be the next one already.
      expect(parsePhoneMessage({ type: MSG_CALL_ENDED })).toBeNull()
      expect(parsePhoneMessage({ type: MSG_CALL_ENDED, call_id: '' })).toBeNull()
      expect(parsePhoneMessage({ type: MSG_CALL_ANSWERED, call_id: 3 })).toBeNull()
    })

    it('rejects a call with no usable id', () => {
      // call_id keys the modal and the accept — without one there is nothing to
      // answer, and a blank-keyed prompt would sit there uncloseable.
      expect(parsePhoneMessage({ type: MSG_ROUTED_CALL, call: { call_id: '' } })).toBeNull()
      expect(parsePhoneMessage({ type: MSG_ROUTED_CALL, call: { call_id: 7 } })).toBeNull()
      expect(parsePhoneMessage({ type: MSG_ROUTED_CALL })).toBeNull()
    })
  })
})
