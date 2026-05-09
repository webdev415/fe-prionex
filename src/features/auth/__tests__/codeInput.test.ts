import { describe, it, expect } from 'vitest'
import { normalizeTwoFactorInput, looksLikeBackupCode } from '../codeInput'

describe('normalizeTwoFactorInput', () => {
  it('trims surrounding ASCII whitespace', () => {
    expect(normalizeTwoFactorInput('  2dea-e3d1  ')).toBe('2dea-e3d1')
  })

  it('lowercases hex characters', () => {
    expect(normalizeTwoFactorInput('2DEA-E3D1')).toBe('2dea-e3d1')
  })

  it('strips internal ASCII whitespace inserted by clipboard breaks', () => {
    expect(normalizeTwoFactorInput('2dea -e3d1')).toBe('2dea-e3d1')
    expect(normalizeTwoFactorInput('2dea\t-\ne3d1')).toBe('2dea-e3d1')
  })

  it('strips zero-width characters (U+200B–U+200D and BOM)', () => {
    const zwsp = '​'
    const zwnj = '‌'
    const zwj = '‍'
    const bom = '﻿'
    expect(normalizeTwoFactorInput(`2dea${zwsp}-${zwnj}e3d1`)).toBe('2dea-e3d1')
    expect(normalizeTwoFactorInput(`${bom}2dea-e3d1${zwj}`)).toBe('2dea-e3d1')
  })

  it('preserves the dash and hex characters', () => {
    expect(normalizeTwoFactorInput('abcd-1234')).toBe('abcd-1234')
  })

  it('passes a 6-digit TOTP through unchanged', () => {
    expect(normalizeTwoFactorInput('123456')).toBe('123456')
  })

  it('unifies smart-dash variants back to ASCII hyphen', () => {
    // U+2013 EN DASH, U+2014 EM DASH, U+2010 HYPHEN, U+2212 MINUS SIGN.
    expect(normalizeTwoFactorInput('2dea–e3d1')).toBe('2dea-e3d1')
    expect(normalizeTwoFactorInput('2dea—e3d1')).toBe('2dea-e3d1')
    expect(normalizeTwoFactorInput('2dea‐e3d1')).toBe('2dea-e3d1')
    expect(normalizeTwoFactorInput('2dea−e3d1')).toBe('2dea-e3d1')
  })
})

describe('looksLikeBackupCode', () => {
  it('returns false for a bare 6-digit TOTP', () => {
    expect(looksLikeBackupCode('123456')).toBe(false)
  })

  it('returns true for a dashed backup code', () => {
    expect(looksLikeBackupCode('2dea-e3d1')).toBe(true)
  })

  it('returns true for empty input (cannot be a 6-digit TOTP)', () => {
    expect(looksLikeBackupCode('')).toBe(true)
  })

  it('returns true for 7+ digit input (still not a TOTP)', () => {
    expect(looksLikeBackupCode('1234567')).toBe(true)
  })
})
