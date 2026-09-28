/**
 * Every string the operator table, the calls modal and the contact-rate modal
 * ask for must exist in all three bundles, and the keys removed with the dead
 * filters (#1337) must be gone from all three.
 *
 * The components render KEYS in tests (react-i18next is mocked), so a key
 * missing from one locale would pass every other test. The keys are read out
 * of the source, so a `t()` call added later is covered automatically.
 */
import { describe, expect, it } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'
import esCommon from '@/../public/locales/es/common.json'
// Read as text, not imported as modules: this inspects what the source asks for.
import tableSource from '../components/AgentPerformanceTable.tsx?raw'
import callsModalSource from '../components/CallsMadeDetailModal.tsx?raw'
import contactRateModalSource from '../components/ContactRateDetailModal.tsx?raw'
import type { ContactRateOutcome } from '@/features/report'

const SOURCES = [tableSource, callsModalSource, contactRateModalSource]

/**
 * The contact-rate modal builds the outcome label with a template literal
 * (`contactRateModal.${key}`), which `usedKeys` cannot see — listed here. The
 * `Record` makes a new outcome key a type error until it is added.
 */
const OUTCOME_KEYS = Object.keys({
  answered: true,
  noAnswer: true,
  busy: true,
  failed: true,
  other: true,
} satisfies Record<ContactRateOutcome['key'], true>).map(
  (key) => `pages.reports.contactRateModal.${key}`
)
const BUNDLES = [
  ['en', enCommon],
  ['uk', ukCommon],
  ['es', esCommon],
] as const

/** Literal keys passed to `t()`. Template literals and variables are skipped. */
function usedKeys(): string[] {
  const keys = new Set<string>()
  for (const src of SOURCES) {
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9._]+)'/g)) keys.add(m[1])
  }
  return [...keys].sort()
}

function lookup(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      bundle
    )
}

describe('reports dashboard strings', () => {
  it('finds the keys it is meant to check', () => {
    // Guards the regex itself: an empty list would make the checks below vacuous.
    const keys = usedKeys()
    expect(keys.length).toBeGreaterThan(20)
    expect(keys).toContain('pages.reports.filters.period')
    expect(keys).toContain('pages.reports.callsMadeModal.operatorsSum')
    expect(keys).toContain('pages.reports.contactRateModal.notEnoughCallsToRank')
  })

  it.each(BUNDLES)('every key used exists as a string in %s', (_lang, bundle) => {
    const missing = [...usedKeys(), ...OUTCOME_KEYS].filter(
      (key) => typeof lookup(bundle, key) !== 'string'
    )
    expect(missing).toEqual([])
  })

  it('uses the agreed Ukrainian wording for the new contact-rate strings', () => {
    expect(lookup(ukCommon, 'pages.reports.contactRateModal.other')).toBe('Інше')
    expect(lookup(ukCommon, 'pages.reports.contactRateModal.notEnoughCallsToRank')).toBe(
      'Недостатньо дзвінків для порівняння операторів'
    )
  })

  it.each(BUNDLES)('the removed filter keys are gone from %s', (_lang, bundle) => {
    for (const key of [
      'pages.reports.filters.clientPhone',
      'pages.reports.filters.typePhoneNumber',
      'pages.reports.filters.dateOfSale',
    ]) {
      expect(lookup(bundle, key)).toBeUndefined()
    }
  })
})
