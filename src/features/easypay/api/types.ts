/**
 * Types for the public EasyPay payment portal (techno-finance.com "Factoring" tab).
 *
 * Mirrors the backend contract in
 * `api-prionex/services/payment/app/schemas/easypay.py`.
 *
 * NOTE: monetary fields (`remaining_debt_amount`, `max_payment_amount`,
 * `amount`) are serialized by Pydantic v2 as JSON **strings**, not numbers.
 * Parse them with `Number(...)` before doing arithmetic or formatting.
 */

/** Discriminator returned by POST /validate-credit. */
export type ValidateCreditStatus = 'open' | 'closed' | 'not_found'

export interface ValidateCreditRequest {
  tin: string
  contract_number: string
  /** Optional; backend falls back to EASYPAY_PROJECT_ID when omitted. */
  project_id?: number
}

export interface ValidateCreditOpenResponse {
  status: 'open'
  contract_number: string
  debt_id: number
  client_id: number
  client_name?: string | null
  /** Remaining debt (UAH) as a decimal string. */
  remaining_debt_amount: string
  /** Max amount payable online this session (UAH) as a decimal string. */
  max_payment_amount: string
}

export interface ValidateCreditClosedResponse {
  status: 'closed'
  contract_number: string
  debt_id: number
  client_id: number
}

export interface ValidateCreditNotFoundResponse {
  status: 'not_found'
}

export type ValidateCreditResponse =
  | ValidateCreditOpenResponse
  | ValidateCreditClosedResponse
  | ValidateCreditNotFoundResponse

export interface InitiatePaymentRequest {
  tin: string
  contract_number: string
  /** Amount in UAH. Sent as a string to preserve decimal precision. */
  amount: string
  project_id?: number
}

export interface InitiatePaymentResponse {
  order_id: string
  payment_id: number
  /** EasyPay checkout page to redirect the browser to. */
  redirect_url: string
  amount: string
}
