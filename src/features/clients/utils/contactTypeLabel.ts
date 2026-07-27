import type { TFunction } from 'i18next'

export type ContactTypeDirectoryRow = {
  id: number
  name: string
  code: string
  is_hidden: boolean
  sort_order: number
  is_phone?: boolean
}

/** Display label for a client_contact_types row (legacy codes + dynamic dir_*). */
export function contactTypeLabel(
  ct: { code: string; name: string },
  t: TFunction,
  language: string
): string {
  if (language === 'uk') {
    return ct.name
  }
  return String(t(`contactTypes.${ct.code}`, { defaultValue: ct.name }))
}

/** Sort contact types by directory order (sort_order asc, then name). */
export function compareContactTypesBySortOrder(
  a: ContactTypeDirectoryRow,
  b: ContactTypeDirectoryRow
): number {
  return a.sort_order !== b.sort_order
    ? a.sort_order - b.sort_order
    : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/**
 * Active types for one Recommenders section (Phones vs Others), ranked
 * independently — not mixed with the other section's sort sequence.
 */
export function contactTypesForSection<T extends ContactTypeDirectoryRow>(
  types: T[],
  isPhone: boolean,
  includeTypeId?: number | null
): T[] {
  return [...types]
    .filter(
      (ct) => (ct.is_phone ?? false) === isPhone && (!ct.is_hidden || ct.id === includeTypeId)
    )
    .sort(compareContactTypesBySortOrder)
}

/** First active type by directory sort (add-contact default). */
export function pickDefaultActiveContactTypeId(types: ContactTypeDirectoryRow[]): number {
  const active = types.filter((ct) => !ct.is_hidden).sort(compareContactTypesBySortOrder)
  return active[0]?.id ?? types[0]?.id ?? 7
}

/** Default type for a Phones or Others add-contact form. */
export function pickDefaultActiveContactTypeIdForSection(
  types: ContactTypeDirectoryRow[],
  isPhone: boolean
): number {
  const sectionTypes = contactTypesForSection(types, isPhone)
  return pickDefaultActiveContactTypeId(sectionTypes)
}
