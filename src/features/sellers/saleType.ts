/**
 * Contract type a debt was bought under — the `sale_type` of a factoring
 * agreement (the "sale") and of every debt loaded into it: factoring, or
 * cession (assignment of the claim). One boundary splits them, the same one
 * client-service applies: purchases before 30.07.2026 are factoring, from
 * 30.07.2026 on — cession.
 *
 * One rule for every screen: anything outside the known set — the field
 * missing because client-service is not rolled out yet, `null`, a stray
 * string — is "no type" and prints as "—", never as a guessed label.
 *
 * Imported by its direct path, not through the `@/features/sellers` barrel:
 * tests that mock the barrel wholesale would otherwise blank these out.
 */

export const SALE_TYPES = ['factoring', 'cession'] as const

export type SaleType = (typeof SALE_TYPES)[number]

/** What the import form preselects for a new sale. */
export const DEFAULT_SALE_TYPE: SaleType = 'cession'

/**
 * First purchase date (YYYY-MM-DD) bought under cession. Repeats client-service
 * `sale_type_policy.CESSION_FROM` — change both together.
 */
export const CESSION_FROM = '2026-07-30'

export function toSaleType(value: unknown): SaleType | null {
  return SALE_TYPES.find((saleType) => saleType === value) ?? null
}

/** `common` key of the type's label, or null when the value is not a known type. */
export function saleTypeLabelKey(value: unknown): string | null {
  const saleType = toSaleType(value)
  return saleType ? `saleType.values.${saleType}` : null
}

/**
 * The type a purchase on this date would carry by the boundary. Takes a
 * YYYY-MM-DD date or an ISO datetime (only its date part is read); null for
 * an empty value.
 */
export function saleTypeByPurchaseDate(date: string): SaleType | null {
  const day = date.split('T')[0]
  if (!day) return null
  return day < CESSION_FROM ? 'factoring' : 'cession'
}
