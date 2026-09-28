import api from '@/lib/api'
import type {
  AppApprovalClient,
  AppApprovalConfig,
  AppApprovalPoll,
  AppApprovalPollRequest,
  AppApprovalQrPayload,
  AppApprovalQrStart,
  AppApprovalStart,
  AppApprovalStartRequest,
} from '../types'

/**
 * The browser side of the sign-in confirmed on the bound phone (Epic 19 API-3,
 * and the QR mode of API-6). All routes are public (no JWT) and live under
 * `/auth/`, so the shared client neither retries them nor turns a 401 into a
 * sign-out.
 *
 * `browser_secret` and `qr_payload` travel only in these bodies: never in a
 * URL, a query key, storage or a log line.
 */
export const loginApprovalApi = {
  /** 200 while the stand has the feature on; 404 (or any error) = no buttons. */
  config: () =>
    api.get<AppApprovalConfig>('/api/v1/auth/app-login/config').then((response) => response.data),

  /** 202 `{request_id, browser_secret, number, expires_in, poll_interval_ms}`. */
  start: (body: AppApprovalStartRequest) =>
    api
      .post<AppApprovalStart>('/api/v1/auth/app-login/start', body)
      .then((response) => response.data),

  poll: (body: AppApprovalPollRequest) =>
    api
      .post<AppApprovalPoll>('/api/v1/auth/app-login/poll', body)
      .then((response) => response.data),

  /** «Скасувати» — always 204 on the server. */
  cancel: (body: AppApprovalPollRequest) =>
    api.post('/api/v1/auth/app-login/cancel', body).then(() => undefined),

  /** QR mode, no login: 202 with the first QR; the route exists only while `config.qr`. */
  startQr: (body: { client: AppApprovalClient }) =>
    api
      .post<AppApprovalQrStart>('/api/v1/auth/app-login/qr', body)
      .then((response) => response.data),

  /** The next QR of a request no phone scanned yet (the previous one stays valid until its end). */
  refreshQr: (body: AppApprovalPollRequest) =>
    api
      .post<AppApprovalQrPayload>('/api/v1/auth/app-login/qr/refresh', body)
      .then((response) => response.data),
}

export default loginApprovalApi
