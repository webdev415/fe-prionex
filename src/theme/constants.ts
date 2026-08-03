/**
 * Theme engine contracts (Figma: 4 base themes × 11 accents).
 * DOM: <html data-theme="…" data-accent="…">
 */

export const THEME_STORAGE_KEY = 'prionex_theme'

export const THEME_BASES = [
  'light-classic',
  'neutral-dim',
  'ultra-dark',
  'high-contrast-light',
] as const

export type ThemeBase = (typeof THEME_BASES)[number]

export const THEME_ACCENTS = [
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'orange',
  'amber',
] as const

export type ThemeAccent = (typeof THEME_ACCENTS)[number]

export const LIGHT_BASES: readonly ThemeBase[] = ['light-classic', 'high-contrast-light']
export const DARK_BASES: readonly ThemeBase[] = ['neutral-dim', 'ultra-dark']

export const DEFAULT_THEME_BASE: ThemeBase = 'light-classic'
export const DEFAULT_THEME_ACCENT: ThemeAccent = 'teal'
export const DEFAULT_LAST_LIGHT_BASE: ThemeBase = 'light-classic'
export const DEFAULT_LAST_DARK_BASE: ThemeBase = 'neutral-dim'

export interface ThemePreference {
  base: ThemeBase
  accent: ThemeAccent
  /** Remembered when switching away from a light base via header toggle. */
  lastLightBase: ThemeBase
  /** Remembered when switching away from a dark base via header toggle. */
  lastDarkBase: ThemeBase
}

export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  base: DEFAULT_THEME_BASE,
  accent: DEFAULT_THEME_ACCENT,
  lastLightBase: DEFAULT_LAST_LIGHT_BASE,
  lastDarkBase: DEFAULT_LAST_DARK_BASE,
}

export function isThemeBase(value: unknown): value is ThemeBase {
  return typeof value === 'string' && (THEME_BASES as readonly string[]).includes(value)
}

export function isThemeAccent(value: unknown): value is ThemeAccent {
  return typeof value === 'string' && (THEME_ACCENTS as readonly string[]).includes(value)
}

export function isLightBase(base: ThemeBase): boolean {
  return (LIGHT_BASES as readonly ThemeBase[]).includes(base)
}

export function isDarkBase(base: ThemeBase): boolean {
  return (DARK_BASES as readonly ThemeBase[]).includes(base)
}
