import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildLoginUrlWithReturn, safeReturnUrl } from '../safeReturnUrl'

describe('safeReturnUrl', () => {
  describe('valid inputs', () => {
    it('passes simple internal paths', () => {
      expect(safeReturnUrl('/dashboard')).toBe('/dashboard')
      expect(safeReturnUrl('/dashboard/clients/123')).toBe('/dashboard/clients/123')
    })

    it('preserves query strings', () => {
      expect(safeReturnUrl('/dashboard?employee=7522')).toBe('/dashboard?employee=7522')
      expect(safeReturnUrl('/clients?tab=tasks&page=3')).toBe('/clients?tab=tasks&page=3')
    })

    it('preserves hash fragments', () => {
      expect(safeReturnUrl('/dashboard#section')).toBe('/dashboard#section')
    })

    it('allows paths that share a prefix with blocked ones', () => {
      // /login-history is NOT blocked by /login (no trailing slash matched)
      expect(safeReturnUrl('/login-history')).toBe('/login-history')
      expect(safeReturnUrl('/change-passwords')).toBe('/change-passwords')
    })
  })

  describe('null / empty / wrong-type inputs', () => {
    it('returns default for null', () => {
      expect(safeReturnUrl(null)).toBe('/dashboard')
    })
    it('returns default for undefined', () => {
      expect(safeReturnUrl(undefined)).toBe('/dashboard')
    })
    it('returns default for empty string', () => {
      expect(safeReturnUrl('')).toBe('/dashboard')
    })
    it('returns default for non-string (defense in depth)', () => {
      // @ts-expect-error — intentionally wrong type
      expect(safeReturnUrl(123)).toBe('/dashboard')
      // @ts-expect-error — intentionally wrong type
      expect(safeReturnUrl({})).toBe('/dashboard')
    })
  })

  describe('open-redirect attacks', () => {
    it('rejects external https URL', () => {
      expect(safeReturnUrl('https://evil.com')).toBe('/dashboard')
    })
    it('rejects external http URL', () => {
      expect(safeReturnUrl('http://evil.com')).toBe('/dashboard')
    })
    it('rejects protocol-relative URL (//host)', () => {
      expect(safeReturnUrl('//evil.com')).toBe('/dashboard')
      expect(safeReturnUrl('//evil.com/path')).toBe('/dashboard')
    })
    it('rejects javascript: scheme', () => {
      expect(safeReturnUrl('javascript:alert(1)')).toBe('/dashboard')
    })
    it('rejects data: scheme', () => {
      expect(safeReturnUrl('data:text/html,<script>...</script>')).toBe('/dashboard')
    })
    it('rejects backslash trick', () => {
      expect(safeReturnUrl('/\\evil.com')).toBe('/dashboard')
    })
    it('rejects scheme buried in path-like input', () => {
      expect(safeReturnUrl('/javascript:alert(1)')).toBe('/dashboard')
      expect(safeReturnUrl('/foo:bar')).toBe('/dashboard')
    })
    it('rejects path that does not start with /', () => {
      expect(safeReturnUrl('dashboard')).toBe('/dashboard')
      expect(safeReturnUrl('clients/123')).toBe('/dashboard')
    })
  })

  describe('loop prevention', () => {
    it('rejects /login itself', () => {
      expect(safeReturnUrl('/login')).toBe('/dashboard')
    })
    it('rejects /login subpath', () => {
      expect(safeReturnUrl('/login/whatever')).toBe('/dashboard')
    })
    it('rejects /change-password', () => {
      expect(safeReturnUrl('/change-password')).toBe('/dashboard')
    })
    it('rejects /change-password subpath', () => {
      expect(safeReturnUrl('/change-password/reset')).toBe('/dashboard')
    })
  })
})

describe('buildLoginUrlWithReturn', () => {
  let originalLocation: Location

  beforeEach(() => {
    originalLocation = window.location
  })
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    })
  })

  function mockLocation(pathname: string, search = ''): void {
    Object.defineProperty(window, 'location', {
      value: { pathname, search },
      writable: true,
    })
  }

  it('appends encoded pathname + search', () => {
    mockLocation('/dashboard/clients/123', '?tab=tasks')
    expect(buildLoginUrlWithReturn()).toBe(
      '/login?returnUrl=' + encodeURIComponent('/dashboard/clients/123?tab=tasks')
    )
  })

  it('includes pathname only when no search', () => {
    mockLocation('/dashboard')
    expect(buildLoginUrlWithReturn()).toBe('/login?returnUrl=' + encodeURIComponent('/dashboard'))
  })

  it('skips capture when already on /login', () => {
    mockLocation('/login')
    expect(buildLoginUrlWithReturn()).toBe('/login')
  })

  it('skips capture when on /login subpath', () => {
    mockLocation('/login/sso')
    expect(buildLoginUrlWithReturn()).toBe('/login')
  })

  it('skips capture when on /change-password', () => {
    mockLocation('/change-password')
    expect(buildLoginUrlWithReturn()).toBe('/login')
  })

  it('captures /login-history correctly (not blocked)', () => {
    mockLocation('/login-history')
    expect(buildLoginUrlWithReturn()).toBe(
      '/login?returnUrl=' + encodeURIComponent('/login-history')
    )
  })
})
