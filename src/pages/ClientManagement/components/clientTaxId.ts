import type { Country } from '@/lib/projectCountry'

export const UA_TAX_ID_REGEX = /^\d{10}$/
export const ES_TAX_ID_REGEX = /^(\d{8}[A-Z]|[A-Z]\d{7}[A-Z0-9])$/

export function taxIdMatches(value: string, country: Country): boolean {
  const candidate = value.trim().toUpperCase()
  return (country === 'ES' ? ES_TAX_ID_REGEX : UA_TAX_ID_REGEX).test(candidate)
}

export function taxIdErrorKey(country: Country): string {
  return country === 'ES'
    ? 'pages.clients.editModal.taxIdInvalidEs'
    : 'pages.clients.editModal.taxIdInvalid'
}
