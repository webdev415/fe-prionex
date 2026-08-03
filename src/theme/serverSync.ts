import { authApi } from '@/features/auth/api/authApi'
import type { ThemePreference } from '@/theme/constants'

let syncTimer: ReturnType<typeof setTimeout> | null = null
let suppressServerSync = false

export function setThemeServerSyncSuppressed(suppressed: boolean): void {
  suppressServerSync = suppressed
}

/** Debounced PATCH /users/me with theme_base + theme_accent. */
export function scheduleThemePreferenceSync(preference: ThemePreference): void {
  if (suppressServerSync) return
  if (typeof window === 'undefined') return

  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    try {
      if (!window.localStorage.getItem('prionex_token')) return
    } catch {
      return
    }
    void authApi
      .updateMyProfile({
        theme_base: preference.base,
        theme_accent: preference.accent,
      })
      .catch(() => {
        // Unauthenticated / network errors: keep local theme; retry on next change.
      })
  }, 400)
}
