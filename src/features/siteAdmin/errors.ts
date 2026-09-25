/**
 * Отказ ручек админки сайта → слово, которым его назовут человеку.
 *
 * auth-service (17-40a) отдаёт `{"detail": "<slug>", "code": "<UPPER_CODE>"}`:
 *   503 site_admin_not_configured    / SITE_ADMIN_NOT_CONFIGURED;
 *   409 site_owner_not_set           / SITE_OWNER_NOT_SET;
 *   403 site_admin_access_denied     / SITE_ADMIN_ACCESS_DENIED;
 *   403 site_owner_change_denied     / SITE_OWNER_CHANGE_DENIED     (только PUT);
 *   404 site_owner_project_not_found / SITE_OWNER_PROJECT_NOT_FOUND (только PUT).
 *
 * Признак — ВЕРХНИЙ `code` корня тела. `detail` для этого не годится: перехватчик
 * `lib/api.ts` (`localizeCodedDetail`) подменяет его переводом кода из
 * `errors.json`, и slug в нём живёт лишь до тех пор, пока перевода нет. Slug
 * (строкой в `detail` или в `detail.code`) остаётся запасным признаком — для
 * ответа, пришедшего мимо перехватчика или без `code`.
 *
 * 409 однозначен по статусу. 403 — два разных отказа: выдача ключа (нет права
 * на контент сайта) и смена владельца (правило PUT 17-40a r2), их различает
 * код. 503 тоже не однозначен: его же отдаёт шлюз, когда auth-service лежит,
 * и сказать в этом случае «админка не настроена» значило бы послать человека
 * чинить не то. Поэтому «не настроено» — только при коде.
 */
import axios from 'axios'
import { getErrorCode } from '@/lib/errors'
import type { SiteAdminErrorKind } from './types'

/** Коды реестра auth-service (`shared/utils/error_codes.py`), как их шлёт сервер. */
export const SITE_ADMIN_NOT_CONFIGURED_CODE = 'SITE_ADMIN_NOT_CONFIGURED'
export const SITE_OWNER_NOT_SET_CODE = 'SITE_OWNER_NOT_SET'
export const SITE_ADMIN_ACCESS_DENIED_CODE = 'SITE_ADMIN_ACCESS_DENIED'
export const SITE_OWNER_CHANGE_DENIED_CODE = 'SITE_OWNER_CHANGE_DENIED'
export const SITE_OWNER_PROJECT_NOT_FOUND_CODE = 'SITE_OWNER_PROJECT_NOT_FOUND'

/** Имена из контракта истории 17-40 — лежат в `detail`, пока его не перевели. */
export const SITE_ADMIN_NOT_CONFIGURED = 'site_admin_not_configured'
export const SITE_OWNER_NOT_SET = 'site_owner_not_set'
export const SITE_ADMIN_ACCESS_DENIED = 'site_admin_access_denied'
export const SITE_OWNER_CHANGE_DENIED = 'site_owner_change_denied'
export const SITE_OWNER_PROJECT_NOT_FOUND = 'site_owner_project_not_found'

/** Все пять кодов `SITE_*` реестра — для словаря `errors.json` и его стража. */
export const SITE_ADMIN_ERROR_CODES = [
  SITE_ADMIN_NOT_CONFIGURED_CODE,
  SITE_OWNER_NOT_SET_CODE,
  SITE_ADMIN_ACCESS_DENIED_CODE,
  SITE_OWNER_CHANGE_DENIED_CODE,
  SITE_OWNER_PROJECT_NOT_FOUND_CODE,
] as const

function carriesSlug(data: unknown, slug: string): boolean {
  if (!data || typeof data !== 'object') return data === slug
  const record = data as Record<string, unknown>
  if (record.code === slug) return true
  const detail = record.detail
  if (detail === slug) return true
  if (detail && typeof detail === 'object') {
    return (detail as Record<string, unknown>).code === slug
  }
  return false
}

/** Код по верхнему `code`, иначе по slug — одна проверка на обе формы. */
function carries(error: unknown, code: string, slug: string): boolean {
  if (getErrorCode(error) === code) return true
  return axios.isAxiosError(error) && carriesSlug(error.response?.data, slug)
}

export function siteAdminErrorKind(error: unknown): SiteAdminErrorKind {
  if (!axios.isAxiosError(error)) return 'failed'
  const status = error.response?.status
  // Перехватчик не уводит на вход по 401 под `/auth/` (там живёт и сам логин),
  // а обе ручки лежат под `/api/v1/auth/`: повтор тут не поможет — только вход.
  if (status === 401) return 'session_expired'
  if (status === 403) {
    // Отказ смены владельца — не «нет права на контент сайта»: повтор и
    // просьба выдать право тут не помогут, помогает только тот, кому правило
    // PUT разрешает смену.
    return carries(error, SITE_OWNER_CHANGE_DENIED_CODE, SITE_OWNER_CHANGE_DENIED)
      ? 'owner_change_denied'
      : 'forbidden'
  }
  if (status === 409) return 'owner_not_set'
  if (status === 404) {
    return carries(error, SITE_OWNER_PROJECT_NOT_FOUND_CODE, SITE_OWNER_PROJECT_NOT_FOUND)
      ? 'owner_project_gone'
      : 'failed'
  }
  if (status === 503) {
    return carries(error, SITE_ADMIN_NOT_CONFIGURED_CODE, SITE_ADMIN_NOT_CONFIGURED)
      ? 'not_configured'
      : 'unavailable'
  }
  return 'failed'
}
