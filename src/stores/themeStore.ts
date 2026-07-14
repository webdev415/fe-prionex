import { create } from 'zustand'
import { applyThemeToDocument } from '@/theme/applyTheme'
import {
  DEFAULT_THEME_PREFERENCE,
  isDarkBase,
  isLightBase,
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
}))

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
