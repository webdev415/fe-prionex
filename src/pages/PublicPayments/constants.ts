/**
 * Hard cap on a single online payment via the EasyPay portal.
 * Mirrors the backend `EASYPAY_MAX_AMOUNT_UAH` (see payment-service config).
 * The backend also returns a per-session `max_payment_amount` (min of this
 * cap and the remaining debt) which the UI uses as the effective ceiling.
 */
export const EASYPAY_MAX_AMOUNT_UAH = 29999
