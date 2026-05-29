import type { TFunction } from 'i18next'

export type ContactTypeDirectoryRow = {
  id: number
  name: string
  code: string
  is_hidden: boolean
  sort_order: number
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

/** First active type by directory sort (add-contact default). */
export function pickDefaultActiveContactTypeId(types: ContactTypeDirectoryRow[]): number {
  const active = types
    .filter((ct) => !ct.is_hidden)
    .sort((a, b) =>
      a.sort_order !== b.sort_order
        ? a.sort_order - b.sort_order
        : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  return active[0]?.id ?? types[0]?.id ?? 7
}
