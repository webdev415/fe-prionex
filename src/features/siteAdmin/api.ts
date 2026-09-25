/**
 * Клиент ручек auth-service для админки сайта (контракт 17-40, часть a):
 *   GET  /api/v1/auth/settings/site-admin   — чей сайт (читает любой сотрудник)
 *   PUT  /api/v1/auth/settings/site-admin   — сменить владельца (manage_settings)
 *   POST /api/v1/auth/site-admin/handoff    — одноразовый ключ входа в админку
 */
import api from '@/lib/api'
import type { SiteAdminHandoff, SiteAdminSettings, UpdateSiteAdminSettingsInput } from './types'

export const SITE_ADMIN_SETTINGS_PATH = '/api/v1/auth/settings/site-admin'
export const SITE_ADMIN_HANDOFF_PATH = '/api/v1/auth/site-admin/handoff'

export async function getSiteAdminSettings(): Promise<SiteAdminSettings> {
  const response = await api.get<SiteAdminSettings>(SITE_ADMIN_SETTINGS_PATH)
  return response.data
}

export async function updateSiteAdminSettings(
  input: UpdateSiteAdminSettingsInput
): Promise<SiteAdminSettings> {
  const response = await api.put<SiteAdminSettings>(SITE_ADMIN_SETTINGS_PATH, input)
  return response.data
}

/** Тело пустое: кто входит и с какой ролью, сервер решает по JWT сотрудника. */
export async function requestSiteAdminHandoff(): Promise<SiteAdminHandoff> {
  const response = await api.post<SiteAdminHandoff>(SITE_ADMIN_HANDOFF_PATH)
  return response.data
}

export const siteAdminApi = {
  getSiteAdminSettings,
  updateSiteAdminSettings,
  requestSiteAdminHandoff,
}
