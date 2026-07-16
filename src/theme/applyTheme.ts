import type { ThemeAccent, ThemeBase, ThemePreference } from './constants'
import { isDarkBase } from './constants'

const THEME_SWITCHING_CLASS = 'theme-switching'

let clearSwitchingRaf = 0
let clearSwitchingTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Suppress CSS transitions/animations for one paint cycle so flipping
 * data-theme / data-accent does not animate every color across the tree.
 */
function beginThemeSwitch(root: HTMLElement): void {
  root.classList.add(THEME_SWITCHING_CLASS)

  if (clearSwitchingRaf) {
    cancelAnimationFrame(clearSwitchingRaf)
    clearSwitchingRaf = 0
  }
  if (clearSwitchingTimer) {
    clearTimeout(clearSwitchingTimer)
    clearSwitchingTimer = null
  }

  // Double rAF: wait until the browser has applied + painted new tokens.
  clearSwitchingRaf = requestAnimationFrame(() => {
    clearSwitchingRaf = requestAnimationFrame(() => {
      clearSwitchingRaf = 0
      clearSwitchingTimer = setTimeout(() => {
        clearSwitchingTimer = null
        root.classList.remove(THEME_SWITCHING_CLASS)
      }, 50)
    })
  })
}

/**
 * Apply theme attributes on <html>. Safe to call from the FOUC boot script
 * path (via duplicated inline JS) and from the Zustand store.
 */
export function applyThemeToDocument(preference: Pick<ThemePreference, 'base' | 'accent'>): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  const nextScheme = isDarkBase(preference.base as ThemeBase) ? 'dark' : 'light'
  const unchanged =
    root.getAttribute('data-theme') === preference.base &&
    root.getAttribute('data-accent') === preference.accent &&
    root.style.colorScheme === nextScheme

  if (unchanged) return

  beginThemeSwitch(root)
  root.setAttribute('data-theme', preference.base)
  root.setAttribute('data-accent', preference.accent)
  root.style.colorScheme = nextScheme
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
