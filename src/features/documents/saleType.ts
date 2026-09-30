/**
 * Contract type a document template is limited to: `all` (any credit,
 * including a credit with no type) or one of the purchase types from
 * `@/features/sellers/saleType`. The server checks it after the activation
 * rule; a mismatch comes back as the `sale_type_mismatch` reason.
 *
 * Differs from `toSaleType` there: for a debt, anything outside the known set
 * is "no type" and prints as "—". For a template, a missing or unknown value
 * reads as `all` — but only for what the editor's Select shows. The editor
 * never writes that guess back: an unknown stored value (a type this screen
 * does not know yet) stays out of the update until the operator picks a type.
 *
 * Imported by its direct path, not through the `@/features/documents` barrel,
 * like `@/features/sellers/saleType`.
 */

import { SALE_TYPES } from '@/features/sellers/saleType'

export const DOCUMENT_TEMPLATE_SALE_TYPES = ['all', ...SALE_TYPES] as const

export type DocumentTemplateSaleType = (typeof DOCUMENT_TEMPLATE_SALE_TYPES)[number]

export function isTemplateSaleType(value: unknown): value is DocumentTemplateSaleType {
  return DOCUMENT_TEMPLATE_SALE_TYPES.some((saleType) => saleType === value)
}

/** The type the editor shows: `all` for a missing or unknown server value. */
export function templateSaleTypeOf(value: unknown): DocumentTemplateSaleType {
  return isTemplateSaleType(value) ? value : 'all'
}
