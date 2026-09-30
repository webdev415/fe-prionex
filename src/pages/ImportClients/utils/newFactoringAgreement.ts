/**
 * The "create new agreement" half of the import wizard, shared by both step-2
 * flows (simple CSV and vendor dump) so the two send the same body and read the
 * same refusal. Lives outside the step components because a component file may
 * not export an object constant (`react-refresh/only-export-components`); the
 * input's shape lives here with it, so nothing here imports from a step.
 */

import { DEFAULT_SALE_TYPE, toSaleType, type SaleType } from '@/features/sellers/saleType'
import { getErrorCode, isApiError } from '@/lib/errors'

/** Step 1's "create new agreement" form. */
export interface NewFactoringAgreementInput {
  agreement_number: string
  previous_lender: string
  contract_purchase_date: string
  reporting_date: string
  sale_type: SaleType
}

export const EMPTY_NEW_FACTORING_AGREEMENT: NewFactoringAgreementInput = {
  agreement_number: '',
  previous_lender: '',
  contract_purchase_date: '',
  reporting_date: '',
  sale_type: DEFAULT_SALE_TYPE,
}

/** `new_factoring_agreement_json` of `POST /api/v1/import/upload`. */
export function buildNewFactoringAgreementJson(newFa: NewFactoringAgreementInput): string {
  const payload: Record<string, string> = {
    agreement_number: newFa.agreement_number.trim(),
  }
  if (newFa.previous_lender.trim()) {
    payload.previous_lender = newFa.previous_lender.trim()
  }
  if (newFa.contract_purchase_date) {
    // The wizard stores contract_purchase_date as a UTC datetime ISO
    // string (consistent with the legacy top-level Purchase date
    // picker's format) but client-service's Pydantic schema expects
    // a plain YYYY-MM-DD date. Truncate the time portion here.
    payload.contract_purchase_date = newFa.contract_purchase_date.split('T')[0]
  }
  if (newFa.reporting_date) {
    payload.reporting_date = newFa.reporting_date.split('T')[0]
  }
  // Always sent, and safe with either server: an import-service before api
  // #563 parses this JSON and reads only the keys it knows, so it ignores
  // `sale_type`; from #563 on it passes the type to client-service (api #565).
  // The read paths still allow a server without the field — debts and
  // agreements that carry no type. Rollout order for PROD: api stories 1–2
  // ship before this or together with it, or the operator's choice is dropped.
  payload.sale_type = newFa.sale_type
  return JSON.stringify(payload)
}

/** Which new agreement an upload was sent for: the seller and the number as sent. */
export interface SaleTypeConflictTarget {
  sellerId: string
  agreementNumber: string
}

/**
 * Why the seller's agreement with that number cannot take the sent type
 * (`params.reason` of the 409):
 * - `stored_type` — the agreement already has another type;
 * - `debt_types` — it has no type, but its debts already carry another one;
 * - `foreign_project_debts` — it has no type, and its debts belong to another
 *   project;
 * - `service_caller` — it has no type, and a service token may not set one.
 */
export type SaleTypeConflictReason =
  | 'stored_type'
  | 'debt_types'
  | 'foreign_project_debts'
  | 'service_caller'

const SALE_TYPE_CONFLICT_REASONS: readonly SaleTypeConflictReason[] = [
  'stored_type',
  'debt_types',
  'foreign_project_debts',
  'service_caller',
]

export interface SaleTypeConflict extends SaleTypeConflictTarget {
  /** Type the seller's existing agreement with that number carries; null = not set. */
  existingSaleType: SaleType | null
  /** null = not sent (a server before the field) or a reason this screen does not know. */
  reason: SaleTypeConflictReason | null
}

/**
 * The upload's 409 `SALE_TYPE_CONFLICT`: the seller already has an agreement
 * with this number that cannot take the sent type. Any other refusal — a 409
 * without that code included — is null and keeps its usual path.
 *
 * `target` is what step 1 held when the upload was SENT. The answer can arrive
 * after the operator went back and changed the seller or the number, and step 1
 * shows the conflict only while both still match.
 */
export function parseSaleTypeConflict(
  error: unknown,
  target: SaleTypeConflictTarget
): SaleTypeConflict | null {
  if (!isApiError(error) || error.response?.status !== 409) return null
  if (getErrorCode(error) !== 'SALE_TYPE_CONFLICT') return null
  const params = (error.response.data as { params?: unknown }).params
  const fields: Record<string, unknown> =
    params && typeof params === 'object' ? (params as Record<string, unknown>) : {}
  return {
    existingSaleType: toSaleType(fields.existing_sale_type),
    reason: SALE_TYPE_CONFLICT_REASONS.find((reason) => reason === fields.reason) ?? null,
    sellerId: target.sellerId,
    agreementNumber: target.agreementNumber.trim(),
  }
}
