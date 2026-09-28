import api from '@/lib/api'
import type {
  AppLoginDisableRequest,
  AppLoginEnableRequest,
  AppLoginPairing,
  AppLoginStatus,
} from '../types'

/**
 * The status read is an optional panel, not the page: an unreachable
 * auth-service must not hold the profile up with the client's transient
 * retries, and a feature that is off answers 404 and simply hides.
 */
const OPTIONAL_READ = { _noTransientRetry: true } as Parameters<typeof api.get>[1]

/**
 * Enable/disable re-check the password. If the API answers a wrong password
 * with 401, the global interceptor would read it as an expired session and
 * sign the person out mid-form; the modal shows the refusal instead.
 */
const PASSWORD_CHECK = { _skipAuthRedirect: true } as Parameters<typeof api.post>[2]

export const appLoginApi = {
  myStatus: () =>
    api
      .get<AppLoginStatus>('/api/v1/users/me/app-login', OPTIONAL_READ)
      .then((response) => response.data),

  enable: (data: AppLoginEnableRequest) =>
    api
      .post<AppLoginPairing>('/api/v1/users/me/app-login/enable', data, PASSWORD_CHECK)
      .then((response) => response.data),

  disable: (data: AppLoginDisableRequest) =>
    api.post('/api/v1/users/me/app-login/disable', data, PASSWORD_CHECK).then(() => undefined),

  revokeMyDevice: (deviceId: string) =>
    api
      .delete(`/api/v1/users/me/app-login/devices/${encodeURIComponent(deviceId)}`)
      .then(() => undefined),

  adminStatus: (userId: number) =>
    api
      .get<AppLoginStatus>(`/api/v1/admin/users/${userId}/app-login`, OPTIONAL_READ)
      .then((response) => response.data),

  adminRevokeAll: (userId: number) =>
    api.post(`/api/v1/admin/users/${userId}/app-login/revoke-all`).then(() => undefined),
}

export default appLoginApi
