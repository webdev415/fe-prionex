/**
 * Non-component helpers for contact-type visuals and Recommenders ordering.
 * Kept separate from JSX components so react-refresh/only-export-components stays clean.
 */

type SortableContact = {
  id: number
  contactTypeId: number | null
}

type TypeSortMeta = {
  sort_order: number
  name?: string
}

/**
 * Variant-5 pill tones by contact-type code (color customization is out of scope;
 * these match the approved mockup categories).
 */
export function contactTypePillToneClass(
  code: string | null | undefined,
  isPhone: boolean
): string {
  const c = (code ?? '').toLowerCase()
  if (c.includes('verified')) return 'border-[#cfe1f4] bg-[#e9f2fb] text-[#2f7dd1]'
  if (c.includes('third_party') || c.includes('third-party') || c.includes('referrer')) {
    return 'border-[#f0dcc0] bg-[#fbf1e3] text-[#b06a1d]'
  }
  if (c.includes('register')) return 'border-[#e4e7e4] bg-[#f2f4f2] text-[#6b7077]'
  if (!isPhone && (c.includes('email') || c.includes('mail'))) {
    return 'border-[#cfe1f4] bg-[#e9f2fb] text-[#2f7dd1]'
  }
  if (!isPhone && c.includes('actual')) {
    return 'border-[#f0dcc0] bg-[#fbf1e3] text-[#b06a1d]'
  }
  return 'border-[#d7ebc6] bg-[#ecf6e4] text-[#519a3d]'
}

/** Rank contacts within one section by that section's type sort_order, then id. */
export function sortContactsByTypeOrder<T extends SortableContact>(
  contacts: T[],
  contactTypesById: Map<number, TypeSortMeta>
): T[] {
  return [...contacts].sort((a, b) => {
    const ta = a.contactTypeId != null ? contactTypesById.get(a.contactTypeId) : undefined
    const tb = b.contactTypeId != null ? contactTypesById.get(b.contactTypeId) : undefined
    const sa = ta?.sort_order ?? Number.MAX_SAFE_INTEGER
    const sb = tb?.sort_order ?? Number.MAX_SAFE_INTEGER
    if (sa !== sb) return sa - sb
    const nameCmp = (ta?.name ?? '').localeCompare(tb?.name ?? '', undefined, {
      sensitivity: 'base',
    })
    if (nameCmp !== 0) return nameCmp
    return a.id - b.id
  })
}
