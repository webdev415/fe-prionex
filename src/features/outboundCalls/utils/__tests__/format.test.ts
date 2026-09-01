import { describe, expect, it } from 'vitest'
import {
  EMPTY,
  formatCount,
  formatDurationHms,
  formatPercent,
  operatorLabel,
  orgLabel,
} from '../format'

describe('formatDurationHms', () => {
  it('renders whole seconds as HH:MM:SS', () => {
    expect(formatDurationHms(0)).toBe('00:00:00')
    expect(formatDurationHms(59)).toBe('00:00:59')
    expect(formatDurationHms(60)).toBe('00:01:00')
    expect(formatDurationHms(4090)).toBe('01:08:10')
  })

  it('keeps counting past 24 hours instead of wrapping', () => {
    // The whole reason the backend sends seconds: the source card cast its sums
    // to `time`, which silently returns the remainder modulo a day (19 of 101
    // operators cross that line on a quarter-wide window). A Date-based
    // rendering would bring that bug back.
    expect(formatDurationHms(86_400)).toBe('24:00:00')
    expect(formatDurationHms(90_061)).toBe('25:01:01')
    expect(formatDurationHms(360_000)).toBe('100:00:00')
  })

  it('truncates a fractional second rather than rounding it up', () => {
    expect(formatDurationHms(59.9)).toBe('00:00:59')
  })

  it.each([
    ['null (a null average — the denominator was zero)', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a negative duration', -1],
  ])('renders "—" for %s', (_case, value) => {
    expect(formatDurationHms(value as number | null | undefined)).toBe(EMPTY)
  })
})

describe('formatPercent', () => {
  it('renders a 0..100 value with two decimals in the UI locale', () => {
    expect(formatPercent(25.69, 'en')).toBe('25.69%')
    expect(formatPercent(25.69, 'uk')).toBe('25,69%')
    expect(formatPercent(0, 'en')).toBe('0.00%')
    expect(formatPercent(100, 'en')).toBe('100.00%')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
  ])('renders "—" for %s', (_case, value) => {
    expect(formatPercent(value as number | null | undefined, 'en')).toBe(EMPTY)
  })
})

describe('formatCount', () => {
  it('groups counts in the UI locale and degrades missing values to "—"', () => {
    expect(formatCount(1288, 'en')).toBe('1,288')
    expect(formatCount(null, 'en')).toBe(EMPTY)
  })
})

describe('operatorLabel', () => {
  it('shows the name when the directory knows the seat', () => {
    expect(operatorLabel('Іваненко І. І.', '2060')).toBe('Іваненко І. І.')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a blank concatenation', '   '],
  ])('falls back to the extension for %s', (_case, fio) => {
    // The row stays even when the directory does not know the seat — dropping
    // it would shrink every total — so the extension has to name it.
    expect(operatorLabel(fio as string | null | undefined, '2060')).toBe('2060')
  })
})

describe('orgLabel', () => {
  it('shows the org value the directory holds', () => {
    expect(orgLabel('Стягнення')).toBe('Стягнення')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['whitespace', '   '],
  ])('renders the table placeholder for %s', (_case, value) => {
    // Same reason operatorLabel trims: an unfilled directory entry arrives as
    // whitespace, and an empty cell is not this table's "no answer".
    expect(orgLabel(value as string | null | undefined)).toBe('—')
  })
})
