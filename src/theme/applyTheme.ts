import type { ThemeAccent, ThemeBase, ThemePreference } from './constants'
import { isDarkBase } from './constants'

/**
 * Apply theme attributes on <html>. Safe to call from the FOUC boot script
 * path (via duplicated inline JS) and from the Zustand store.
 */
export function applyThemeToDocument(preference: Pick<ThemePreference, 'base' | 'accent'>): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', preference.base)
  root.setAttribute('data-accent', preference.accent)
  root.style.colorScheme = isDarkBase(preference.base as ThemeBase) ? 'dark' : 'light'
}

export function getDocumentTheme(): { base: ThemeBase | null; accent: ThemeAccent | null } {
  if (typeof document === 'undefined') {
    return { base: null, accent: null }
  }
  return {
    base: document.documentElement.getAttribute('data-theme') as ThemeBase | null,
    accent: document.documentElement.getAttribute('data-accent') as ThemeAccent | null,
  }
}
