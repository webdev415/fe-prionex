/**
 * The mapper between the /me response and the store's user.
 *
 * It copies field by field, so anything added to the API response is silently
 * dropped until it is named here. That is invisible from the component side:
 * the upload succeeds, the toast says so, and the avatar never changes because
 * `user.avatar_url` was never carried across.
 */
import { describe, expect, it } from 'vitest'
import { mapBackendUserToUser } from '../mapBackendUser'
import type { CurrentUserResponse } from '@/types/api'

function response(overrides: Partial<CurrentUserResponse> = {}): CurrentUserResponse {
  return {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    first_name: 'System',
    last_name: 'Administrator',
    full_name: 'System Administrator',
    status: 'active',
    language: 'en',
    timezone: 'Europe/Kyiv',
    role: { id: 1, name: 'Admin' },
    active_project: { id: 1, name: 'Technofinance', code: 'TF' },
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as CurrentUserResponse
}

describe('mapBackendUserToUser', () => {
  it('carries the avatar through to the store', () => {
    const user = mapBackendUserToUser(response({ avatar_url: '/api/v1/users/avatars/1-a.png' }))

    expect(user.avatar_url).toBe('/api/v1/users/avatars/1-a.png')
  })

  it('carries the work format through to the store', () => {
    const user = mapBackendUserToUser(response({ work_format: 'remote' }))

    expect(user.work_format).toBe('remote')
  })

  it('reports no avatar as null rather than undefined', () => {
    const user = mapBackendUserToUser(response())

    expect(user.avatar_url).toBeNull()
    expect(user.work_format).toBeNull()
  })

  it('still maps the fields it always did', () => {
    const user = mapBackendUserToUser(response())

    expect(user.username).toBe('admin')
    expect(user.firstName).toBe('System')
    expect(user.timezone).toBe('Europe/Kyiv')
  })
})
