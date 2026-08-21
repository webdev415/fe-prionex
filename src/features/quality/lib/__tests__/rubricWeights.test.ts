/**
 * Rubric weight helpers. `sumCriteriaWeights` mirrors quality-service's
 * Σ = 100 rule; `makeUniqueKey` protects the criterion keys that join a
 * scorecard's stored scores to its template — a collision would silently
 * merge two criteria.
 */
import { describe, expect, it } from 'vitest'

import { isRubricWeightValid, makeUniqueKey, sumCriteriaWeights } from '../rubricWeights'
import type { Section } from '../../types'

function sections(...weights: number[][]): Section[] {
  return weights.map((group, gi) => ({
    key: `s${gi}`,
    name: `Section ${gi}`,
    criteria: group.map((weight, ci) => ({
      key: `s${gi}c${ci}`,
      name: `Criterion ${ci}`,
      scale: 'binary' as const,
      weight,
    })),
  }))
}

describe('sumCriteriaWeights', () => {
  it('adds up every criterion across every section', () => {
    expect(sumCriteriaWeights(sections([40, 10], [35, 15]))).toBe(100)
    expect(isRubricWeightValid(sections([40, 10], [35, 15]))).toBe(true)
  })

  it('is 0 for an empty rubric and rejects it', () => {
    expect(sumCriteriaWeights([])).toBe(0)
    expect(isRubricWeightValid([])).toBe(false)
  })

  it('ignores non-numeric weights rather than producing NaN', () => {
    const broken = sections([50])
    broken[0].criteria[0].weight = Number.NaN
    expect(sumCriteriaWeights(broken)).toBe(0)
  })

  it('rounds float drift so 100 stays comparable', () => {
    expect(sumCriteriaWeights(sections([33.33, 33.33, 33.34]))).toBe(100)
  })
})

describe('makeUniqueKey', () => {
  it('slugs the label', () => {
    expect(makeUniqueKey('Привітання / intro', new Set(), 'fallback')).toBe('intro')
    expect(makeUniqueKey('Active listening', new Set(), 'fallback')).toBe('active_listening')
  })

  it('falls back when the label has no usable characters', () => {
    expect(makeUniqueKey('Критерій', new Set(), 'section_1_c2')).toBe('section_1_c2')
  })

  it('suffixes on collision instead of reusing a taken key', () => {
    const taken = new Set(['greeting', 'greeting_2'])
    expect(makeUniqueKey('Greeting', taken, 'fallback')).toBe('greeting_3')
  })
})
