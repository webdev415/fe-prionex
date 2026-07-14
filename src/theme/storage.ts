import {
  DEFAULT_THEME_PREFERENCE,
  isThemeAccent,
  isThemeBase,
  isLightBase,
  isDarkBase,
  THEME_STORAGE_KEY,
  type ThemePreference,
  type ThemeBase,
} from './constants'

function sanitizePreference(raw: Partial<ThemePreference> | null | undefined): ThemePreference {
  const base = isThemeBase(raw?.base) ? raw.base : DEFAULT_THEME_PREFERENCE.base
  const accent = isThemeAccent(raw?.accent) ? raw.accent : DEFAULT_THEME_PREFERENCE.accent

  let lastLightBase: ThemeBase = DEFAULT_THEME_PREFERENCE.lastLightBase
  if (isThemeBase(raw?.lastLightBase) && isLightBase(raw.lastLightBase)) {
    lastLightBase = raw.lastLightBase
  } else if (isLightBase(base)) {
    lastLightBase = base
  }

  let lastDarkBase: ThemeBase = DEFAULT_THEME_PREFERENCE.lastDarkBase
  if (isThemeBase(raw?.lastDarkBase) && isDarkBase(raw.lastDarkBase)) {
    lastDarkBase = raw.lastDarkBase
  } else if (isDarkBase(base)) {
    lastDarkBase = base
  }

  return { base, accent, lastLightBase, lastDarkBase }
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_THEME_PREFERENCE }
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (!stored) return { ...DEFAULT_THEME_PREFERENCE }
    return sanitizePreference(JSON.parse(stored) as Partial<ThemePreference>)
  } catch {
    return { ...DEFAULT_THEME_PREFERENCE }
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(sanitizePreference(preference)))
  } catch {
    // Ignore quota / private-mode failures — DOM attrs still apply for the session.
  }
}
