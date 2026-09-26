import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import {
  appLoginErrorMessage,
  findNewDevice,
  formatCountdown,
  formatPairingCode,
  isFeatureAvailable,
  isFeatureOffError,
  passwordRefusalMessage,
  platformLabel,
  refusalCode,
  safePairingUrl,
} from '../lib/pairing'
import type { AppLoginDevice } from '../types'

function device(id: string, label = 'iPhone'): AppLoginDevice {
  return { id, label, platform: 'ios', created_at: '2026-09-26T10:00:00Z' }
}

function httpError(status: number, data: unknown = {}): AxiosError {
  const headers = new AxiosHeaders()
  return new AxiosError('fail', 'ERR_BAD_REQUEST', { headers }, null, {
    status,
    statusText: '',
    headers: {},
    config: { headers },
    data,
  })
}

describe('formatPairingCode', () => {
  it('splits the 8 Crockford characters into two groups of four', () => {
    expect(formatPairingCode('abcdefgh')).toBe('ABCD-EFGH')
  })

  it('accepts a code the API already grouped', () => {
    expect(formatPairingCode('ABCD-EFGH')).toBe('ABCD-EFGH')
  })

  it('leaves a code of another length as given rather than guessing', () => {
    expect(formatPairingCode('ABC')).toBe('ABC')
  })
})

describe('safePairingUrl', () => {
  it('passes the API deep link through as is', () => {
    expect(safePairingUrl('prionexhub://app-login/pair?c=ABCDEFGH&e=development')).toBe(
      'prionexhub://app-login/pair?c=ABCDEFGH&e=development'
    )
  })

  it('drops anything that is not the phone deep link (it lands in an href)', () => {
    expect(safePairingUrl('javascript:alert(1)')).toBeNull()
    expect(safePairingUrl('https://evil.example/pair?c=ABCDEFGH')).toBeNull()
    expect(safePairingUrl('prionexhub://other/path?c=1')).toBeNull()
    expect(safePairingUrl(undefined)).toBeNull()
    expect(safePairingUrl(null)).toBeNull()
  })
})

describe('formatCountdown', () => {
  it('renders minutes and zero-padded seconds', () => {
    expect(formatCountdown(300)).toBe('5:00')
    expect(formatCountdown(65)).toBe('1:05')
  })

  it('never goes negative', () => {
    expect(formatCountdown(-4)).toBe('0:00')
  })
})

describe('feature availability', () => {
  it('is on only when the API says feature_available=true', () => {
    expect(isFeatureAvailable({ feature_available: true })).toBe(true)
    expect(isFeatureAvailable({ feature_available: false })).toBe(false)
    expect(isFeatureAvailable(undefined)).toBe(false)
  })

  it('treats 404 (flag off) as the feature being off, other errors as errors', () => {
    expect(isFeatureOffError(httpError(404))).toBe(true)
    expect(isFeatureOffError(httpError(500))).toBe(false)
    expect(isFeatureOffError(new Error('x'))).toBe(false)
  })
})

describe('findNewDevice', () => {
  it('finds the device that was not bound when the code was issued', () => {
    const baseline = new Set(['a'])
    const found = findNewDevice(baseline, {
      feature_available: true,
      devices: [device('a'), device('b', 'Pixel')],
    })
    expect(found?.id).toBe('b')
  })

  it('compares by id, so an unbind in the meantime does not hide the new phone', () => {
    const baseline = new Set(['a', 'b'])
    const found = findNewDevice(baseline, {
      feature_available: true,
      devices: [device('c')],
    })
    expect(found?.id).toBe('c')
  })

  it('returns null while the phone has not enrolled', () => {
    expect(
      findNewDevice(new Set(['a']), { feature_available: true, devices: [device('a')] })
    ).toBeNull()
  })
})

describe('platformLabel', () => {
  it('names the platforms', () => {
    expect(platformLabel('ios')).toBe('iOS')
    expect(platformLabel('android')).toBe('Android')
    expect(platformLabel('other')).toBe('other')
  })
})

describe('passwordRefusalMessage', () => {
  it('reads a plain string detail', () => {
    expect(passwordRefusalMessage(httpError(401, { detail: 'Invalid password' }), 'x')).toBe(
      'Invalid password'
    )
  })

  it('reads the {code, message} detail the 2FA routes use', () => {
    const error = httpError(401, {
      detail: { code: 'INVALID_TWO_FACTOR_CODE', message: 'Invalid or expired code' },
    })
    expect(passwordRefusalMessage(error, 'x')).toBe('Invalid or expired code')
  })

  it('falls back instead of the generic «sign in again» for a bare 401', () => {
    expect(passwordRefusalMessage(httpError(401), 'Wrong password or code')).toBe(
      'Wrong password or code'
    )
    expect(passwordRefusalMessage(new Error('boom'), 'fallback')).toBe('fallback')
  })
})

describe('app-login refusal codes (the API answers {detail: {code, message}})', () => {
  const wrongPassword = () =>
    httpError(401, { detail: { code: 'INVALID_CREDENTIALS', message: 'Invalid password' } })

  it('reads the code', () => {
    expect(refusalCode(wrongPassword())).toBe('INVALID_CREDENTIALS')
    expect(refusalCode(httpError(401, { detail: 'x', code: 'FLAT' }))).toBe('FLAT')
    expect(refusalCode(httpError(401))).toBeNull()
    expect(refusalCode(new Error('x'))).toBeNull()
  })

  it('a known code wins over the English server text', () => {
    const byCode = { INVALID_CREDENTIALS: 'Невірний пароль' }
    expect(passwordRefusalMessage(wrongPassword(), 'fallback', byCode)).toBe('Невірний пароль')
  })

  it('an unknown code still shows the server message', () => {
    expect(passwordRefusalMessage(wrongPassword(), 'fallback', { OTHER: 'x' })).toBe(
      'Invalid password'
    )
  })

  it('appLoginErrorMessage reads the nested message instead of «Resource not found.»', () => {
    const notFound = httpError(404, {
      detail: { code: 'DEVICE_NOT_FOUND', message: 'Phone not found' },
    })
    expect(appLoginErrorMessage(notFound, 'fallback')).toBe('Phone not found')
  })
})
