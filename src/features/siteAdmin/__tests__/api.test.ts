/**
 * Адреса и тела ручек админки сайта — ровно по контракту 17-40.
 *
 * Фронт и auth-service (17-40a) пишутся параллельно; опечатка в пути здесь
 * дала бы 404 от шлюза, неотличимый снаружи от «ручки ещё нет».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ default: http }))

const { getSiteAdminSettings, updateSiteAdminSettings, requestSiteAdminHandoff } =
  await import('../api')

describe('siteAdmin api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('читает владельца сайта GET /api/v1/auth/settings/site-admin', async () => {
    http.get.mockResolvedValue({ data: { site_owner_project_id: 7 } })
    await expect(getSiteAdminSettings()).resolves.toEqual({ site_owner_project_id: 7 })
    expect(http.get).toHaveBeenCalledWith('/api/v1/auth/settings/site-admin')
  })

  it('меняет владельца PUT тем же адресом и телом только с id проекта', async () => {
    http.put.mockResolvedValue({ data: { site_owner_project_id: 9 } })
    await updateSiteAdminSettings({ site_owner_project_id: 9 })
    expect(http.put).toHaveBeenCalledWith('/api/v1/auth/settings/site-admin', {
      site_owner_project_id: 9,
    })
  })

  it('просит ключ входа POST /api/v1/auth/site-admin/handoff без тела', async () => {
    http.post.mockResolvedValue({
      data: { url: 'https://cms.example.test/admin/sso?t=k', expires_in: 60 },
    })
    await expect(requestSiteAdminHandoff()).resolves.toEqual({
      url: 'https://cms.example.test/admin/sso?t=k',
      expires_in: 60,
    })
    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post.mock.calls[0]).toEqual(['/api/v1/auth/site-admin/handoff'])
  })
})
