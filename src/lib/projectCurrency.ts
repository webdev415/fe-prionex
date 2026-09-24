export type Currency = 'UAH' | 'EUR'

let active: Currency = 'UAH'

export function setActiveCurrency(currency: string | null | undefined): void {
  active = currency === 'EUR' ? 'EUR' : 'UAH'
}

export function activeCurrency(): Currency {
  return active
}

export function isEuroCurrency(currency: string | null | undefined = active): boolean {
  return currency === 'EUR'
}

export function currencySymbol(currency: string | null | undefined = active): string {
  return currency === 'EUR' ? '€' : '₴'
}

export function activeProjectCurrency(
  user:
    | { active_project_id?: string | null; projects?: Array<{ id: string; currency?: string }> }
    | null
    | undefined
): Currency {
  const project = user?.projects?.find((p) => p.id === user.active_project_id)
  return project?.currency === 'EUR' ? 'EUR' : 'UAH'
}
