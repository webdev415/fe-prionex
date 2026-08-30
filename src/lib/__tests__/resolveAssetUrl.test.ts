/**
 * The API returns avatar paths without a host. An <img src> resolves those
 * against the page origin, which in development is the Vite server and in
 * production is whatever serves the bundle - neither of which holds the file.
 * The image then 404s and the avatar quietly falls back to initials, so the
 * failure looks like "the upload did not work" rather than a bad URL.
 */
import { describe, expect, it } from 'vitest'
import { API_BASE_URL, resolveAssetUrl } from '../api'

describe('resolveAssetUrl', () => {
  it('puts the API host in front of a server-relative path', () => {
    expect(resolveAssetUrl('/api/v1/users/avatars/1-a.png')).toBe(
      `${API_BASE_URL}/api/v1/users/avatars/1-a.png`
    )
  })

  it('leaves absolute urls untouched', () => {
    expect(resolveAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(resolveAssetUrl('//cdn.example.com/a.png')).toBe('//cdn.example.com/a.png')
    expect(resolveAssetUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })

  it('does not double the slash between host and path', () => {
    expect(resolveAssetUrl('/a.png')).not.toContain('online//')
  })

  it('returns undefined for no photo', () => {
    expect(resolveAssetUrl(null)).toBeUndefined()
    expect(resolveAssetUrl(undefined)).toBeUndefined()
    expect(resolveAssetUrl('')).toBeUndefined()
  })
})
