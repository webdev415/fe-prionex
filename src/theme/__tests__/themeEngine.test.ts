import { beforeEach, describe, expect, it } from 'vitest'
import { applyThemeToDocument, getDocumentTheme } from '@/theme/applyTheme'
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  isThemeAccent,
  isThemeBase,
} from '@/theme/constants'
import { readThemePreference, writeThemePreference } from '@/theme/storage'
import { useThemeStore } from '@/stores/themeStore'

describe('theme constants', () => {
  it('accepts known bases and accents', () => {
    expect(isThemeBase('light-classic')).toBe(true)
    expect(isThemeBase('neon')).toBe(false)
    expect(isThemeAccent('violet')).toBe(true)
    expect(isThemeAccent('lime')).toBe(false)
  })
})

describe('theme storage', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-accent')
  })

  it('returns defaults when empty', () => {
    expect(readThemePreference()).toEqual(DEFAULT_THEME_PREFERENCE)
  })

  it('round-trips a valid preference', () => {
    writeThemePreference({
      base: 'ultra-dark',
      accent: 'purple',
      lastLightBase: 'high-contrast-light',
      lastDarkBase: 'ultra-dark',
    })
    expect(readThemePreference()).toEqual({
      base: 'ultra-dark',
      accent: 'purple',
      lastLightBase: 'high-contrast-light',
      lastDarkBase: 'ultra-dark',
    })
  })

  it('sanitizes corrupt storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ base: 'nope', accent: 12 }))
    expect(readThemePreference()).toEqual(DEFAULT_THEME_PREFERENCE)
  })
})

describe('applyThemeToDocument', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-accent')
    document.documentElement.style.colorScheme = ''
  })

  it('sets data attributes and color-scheme', () => {
    applyThemeToDocument({ base: 'neutral-dim', accent: 'cyan' })
    expect(getDocumentTheme()).toEqual({ base: 'neutral-dim', accent: 'cyan' })
    expect(document.documentElement.style.colorScheme).toBe('dark')

    applyThemeToDocument({ base: 'light-classic', accent: 'teal' })
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})

describe('useThemeStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({ ...DEFAULT_THEME_PREFERENCE })
    applyThemeToDocument(DEFAULT_THEME_PREFERENCE)
  })

  it('setBase persists and applies', () => {
    useThemeStore.getState().setBase('high-contrast-light')
    expect(useThemeStore.getState().base).toBe('high-contrast-light')
    expect(useThemeStore.getState().lastLightBase).toBe('high-contrast-light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast-light')
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!).base).toBe('high-contrast-light')
  })

  it('setAccent does not change base', () => {
    useThemeStore.getState().setBase('neutral-dim')
    useThemeStore.getState().setAccent('rose')
    expect(useThemeStore.getState().base).toBe('neutral-dim')
    expect(useThemeStore.getState().accent).toBe('rose')
    expect(document.documentElement.getAttribute('data-accent')).toBe('rose')
  })

  it('toggleLightDark remembers last light and dark bases', () => {
    useThemeStore.getState().setBase('high-contrast-light')
    useThemeStore.getState().setBase('ultra-dark')
    useThemeStore.getState().toggleLightDark()
    expect(useThemeStore.getState().base).toBe('high-contrast-light')
    useThemeStore.getState().toggleLightDark()
    expect(useThemeStore.getState().base).toBe('ultra-dark')
  })
})
