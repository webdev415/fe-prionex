import { create } from 'zustand'
import { applyThemeToDocument } from '@/theme/applyTheme'
import {
  DEFAULT_THEME_PREFERENCE,
  isDarkBase,
  isLightBase,
  isThemeAccent,
  isThemeBase,
  THEME_STORAGE_KEY,
  type ThemeAccent,
  type ThemeBase,
  type ThemePreference,
} from '@/theme/constants'
import { readThemePreference, writeThemePreference } from '@/theme/storage'

interface ThemeState extends ThemePreference {
  setBase: (base: ThemeBase) => void
  setAccent: (accent: ThemeAccent) => void
  setPreference: (partial: Partial<ThemePreference>) => void
  /** Flip between last light base and last dark base; accent unchanged. */
  toggleLightDark: () => void
  /** Re-read localStorage and re-apply (e.g. after cross-tab sync). */
  hydrateFromStorage: () => void
  /** Apply theme_base / theme_accent from GET /users/me (overwrites localStorage). */
  hydrateFromServer: (themeBase?: string | null, themeAccent?: string | null) => void
}

function persistAndApply(preference: ThemePreference): ThemePreference {
  writeThemePreference(preference)
  applyThemeToDocument(preference)
  return preference
}

function withRememberedBases(next: ThemePreference, previous: ThemePreference): ThemePreference {
  const lastLightBase = isLightBase(next.base) ? next.base : previous.lastLightBase
  const lastDarkBase = isDarkBase(next.base) ? next.base : previous.lastDarkBase
  return { ...next, lastLightBase, lastDarkBase }
}

const initial = readThemePreference()
applyThemeToDocument(initial)

export const useThemeStore = create<ThemeState>((set) => ({
  ...initial,

  setBase: (base) => {
    set((state) => {
      const next = withRememberedBases({ ...state, base }, state)
      return persistAndApply(next)
    })
  },

  setAccent: (accent) => {
    set((state) => persistAndApply({ ...state, accent }))
  },

  setPreference: (partial) => {
    set((state) => {
      const merged: ThemePreference = {
        base: partial.base ?? state.base,
        accent: partial.accent ?? state.accent,
        lastLightBase: partial.lastLightBase ?? state.lastLightBase,
        lastDarkBase: partial.lastDarkBase ?? state.lastDarkBase,
      }
      return persistAndApply(withRememberedBases(merged, state))
    })
  },

  toggleLightDark: () => {
    set((state) => {
      if (isLightBase(state.base)) {
        return persistAndApply({
          ...state,
          lastLightBase: state.base,
          base: state.lastDarkBase,
        })
      }
      if (isDarkBase(state.base)) {
        return persistAndApply({
          ...state,
          lastDarkBase: state.base,
          base: state.lastLightBase,
        })
      }
      return persistAndApply({ ...state, base: DEFAULT_THEME_PREFERENCE.base })
    })
  },

  hydrateFromStorage: () => {
    const preference = readThemePreference()
    applyThemeToDocument(preference)
    set(preference)
  },

  hydrateFromServer: (themeBase, themeAccent) => {
    const partial: Partial<ThemePreference> = {}
    if (isThemeBase(themeBase)) {
      partial.base = themeBase
      if (isLightBase(themeBase)) partial.lastLightBase = themeBase
      if (isDarkBase(themeBase)) partial.lastDarkBase = themeBase
    }
    if (isThemeAccent(themeAccent)) {
      partial.accent = themeAccent
    }
    if (!partial.base && !partial.accent) return

    set((state) => {
      const merged: ThemePreference = {
        base: partial.base ?? state.base,
        accent: partial.accent ?? state.accent,
        lastLightBase: partial.lastLightBase ?? state.lastLightBase,
        lastDarkBase: partial.lastDarkBase ?? state.lastDarkBase,
      }
      return persistAndApply(withRememberedBases(merged, state))
    })
  },
}))

/**
 * Apply theme from GET /users/me (mirrors language hydration).
 * Server wins for base/accent; last light/dark memory stays local when still valid.
 */
export function applyPersistedThemeFromServer(
  themeBase: string | null | undefined,
  themeAccent: string | null | undefined
): void {
  useThemeStore.getState().hydrateFromServer(themeBase, themeAccent)
}

/** Cross-tab sync: another tab changed prionex_theme. */
export function setupThemeStorageListener(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    useThemeStore.getState().hydrateFromStorage()
  }

  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
