/**
 * HTTP client for the public EasyPay payment portal.
 *
 * This is a DEDICATED axios instance — it intentionally does NOT reuse the
 * shared `@/lib/api` client because that one:
 *   - attaches the CRM Bearer token, and
 *   - redirects the browser to /login on any 401.
 * The payment portal is public (no CRM session); it authenticates to Prionex
 * with a static portal API key sent in the `X-Payment-Portal-Key` header.
 *
 * The key is injected at build time via `VITE_EASYPAY_PORTAL_API_KEY`. The
 * portal endpoints only expose credit *validation* and payment *initiation*
 * (both scoped to a single project) — no read access to CRM data — so the key
 * is safe to ship in the public bundle for this integration.
 */
import axios, { type AxiosError } from 'axios'
import { API_BASE_URL } from '@/lib/api'
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  ValidateCreditRequest,
  ValidateCreditResponse,
} from './types'

const PORTAL_API_KEY = import.meta.env.VITE_EASYPAY_PORTAL_API_KEY ?? ''

const EASYPAY_BASE = '/api/v1/payments/easypay'

const easypayHttp = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(PORTAL_API_KEY ? { 'X-Payment-Portal-Key': PORTAL_API_KEY } : {}),
  },
  // Public page: never send CRM cookies/credentials with these requests.
  withCredentials: false,
  timeout: 30000,
})

/** Error thrown when the backend rejects a portal request with a 4xx/5xx. */
export class EasyPayApiError extends Error {
  readonly status?: number
  readonly detail?: string

  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'EasyPayApiError'
    this.status = status
    this.detail = detail
  }
}

function toApiError(error: unknown): EasyPayApiError {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ detail?: string }>
    const status = axiosErr.response?.status
    const detail = axiosErr.response?.data?.detail
    return new EasyPayApiError(detail || axiosErr.message, status, detail)
  }
  return new EasyPayApiError(error instanceof Error ? error.message : 'Unknown error')
}

export const easypayApi = {
  /** Validate a TIN + credit agreement number. Returns open / closed / not_found. */
  async validateCredit(payload: ValidateCreditRequest): Promise<ValidateCreditResponse> {
    try {
      const { data } = await easypayHttp.post<ValidateCreditResponse>(
        `${EASYPAY_BASE}/validate-credit`,
        payload
      )
      return data
    } catch (error) {
      throw toApiError(error)
    }
  },

  /** Create a pending payment + EasyPay checkout session; returns the redirect URL. */
  async initiatePayment(payload: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    try {
      const { data } = await easypayHttp.post<InitiatePaymentResponse>(
        `${EASYPAY_BASE}/initiate`,
        payload
      )
      return data
    } catch (error) {
      throw toApiError(error)
    }
  },
}

/** Exposed for tests to assert the configured base path. */
export const __EASYPAY_BASE = EASYPAY_BASE
