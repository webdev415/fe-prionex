/**
 * The project modals offer the currencies and countries of `PROJECT_CURRENCIES` /
 * `PROJECT_COUNTRIES`, while the money formatters know their own list in
 * `projectCurrency`. The two literals live apart on purpose (features do not
 * import lib's list), so this file is what keeps them in step: a currency the
 * modal can pick is one the formatters recognise, with a sign of its own and a
 * label and unit word in every language.
 */
import { afterEach, describe, expect, it } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import esCommon from '@/../public/locales/es/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import { PROJECT_COUNTRIES, PROJECT_CURRENCIES } from '@/features/projects/types'
import { activeCurrency, currencySymbol, setActiveCurrency } from '@/lib/projectCurrency'

const DICTIONARIES: Array<[string, unknown]> = [
  ['uk', ukCommon],
  ['en', enCommon],
  ['es', esCommon],
]

function textAt(dictionary: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      dictionary
    )
}

function missingTexts(paths: string[]): string[] {
  return DICTIONARIES.flatMap(([language, dictionary]) =>
    paths
      .filter((path) => {
        const text = textAt(dictionary, path)
        return typeof text !== 'string' || text.trim() === ''
      })
      .map((path) => `${language}: ${path}`)
  )
}

describe('project currencies and countries stay in step', () => {
  afterEach(() => {
    setActiveCurrency('UAH')
  })

  it('offers the Canadian dollar and Canada', () => {
    // Without these the checks below would pass over the old two-item lists.
    expect(PROJECT_CURRENCIES).toContain('CAD')
    expect(PROJECT_COUNTRIES).toContain('CA')
    expect(PROJECT_CURRENCIES.length).toBeGreaterThanOrEqual(3)
    expect(PROJECT_COUNTRIES.length).toBeGreaterThanOrEqual(3)
  })

  it('has every project currency recognised by the formatters, each with a sign of its own', () => {
    const problems: string[] = []
    for (const currency of PROJECT_CURRENCIES) {
      setActiveCurrency(currency)
      if (activeCurrency() !== currency) {
        problems.push(`project currency ${currency} is not recognised by the formatters`)
      }
    }
    PROJECT_CURRENCIES.forEach((a, index) => {
      for (const b of PROJECT_CURRENCIES.slice(index + 1)) {
        if (currencySymbol(a) === currencySymbol(b)) {
          problems.push(`currencies ${a} and ${b} share one sign`)
        }
      }
    })

    expect(problems).toEqual([])
  })

  it('names every project currency and its unit in every language', () => {
    const paths = PROJECT_CURRENCIES.flatMap((currency) => [
      `pages.projects.modals.currency.${currency}`,
      `components.currencyUnit.${currency}`,
    ])

    expect(missingTexts(paths)).toEqual([])
  })

  it('names every project country in every language', () => {
    const paths = PROJECT_COUNTRIES.map((country) => `pages.projects.modals.country.${country}`)

    expect(missingTexts(paths)).toEqual([])
  })
})
