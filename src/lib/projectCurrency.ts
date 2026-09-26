export type Currency = 'UAH' | 'EUR' | 'CAD'

const SIGNS: Record<Currency, string> = { UAH: '₴', EUR: '€', CAD: 'CA$' }

let active: Currency = 'UAH'

/** The project currency a code names; anything the screens do not know stays hryvnia. */
export function knownCurrency(currency: string | null | undefined): Currency {
  return currency === 'EUR' || currency === 'CAD' ? currency : 'UAH'
}

export function setActiveCurrency(currency: string | null | undefined): void {
  active = knownCurrency(currency)
}

export function activeCurrency(): Currency {
  return active
}

export function isEuroCurrency(currency: string | null | undefined = active): boolean {
  return currency === 'EUR'
}

export function currencySymbol(currency: string | null | undefined = active): string {
  return SIGNS[knownCurrency(currency)]
}

export function activeProjectCurrency(
  user:
    | {
        active_project_id?: string | null
        active_project_currency?: string
        projects?: Array<{ id: string; currency?: string }>
      }
    | null
    | undefined
): Currency {
  const project = user?.projects?.find((p) => p.id === user.active_project_id)
  return knownCurrency(project?.currency ?? user?.active_project_currency)
}
