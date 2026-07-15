/**
 * Toaster Component
 *
 * Global toast notification system using Sonner.
 * Surfaces follow the active data-theme (light / dark bases).
 */

import { Toaster as SonnerToaster } from 'sonner'
import { useThemeStore } from '@/stores/themeStore'
import { isDarkBase } from '@/theme/constants'

export function Toaster() {
  const base = useThemeStore((s) => s.base)
  const theme = isDarkBase(base) ? 'dark' : 'light'

  return (
    <SonnerToaster
      position="bottom-right"
      theme={theme}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
        },
        className: 'toast',
      }}
    />
  )
}
