/**
 * Toaster Component
 *
 * Global toast notification system using Sonner.
 * Surfaces follow CSS theme tokens. Sonner's light/dark chrome follows
 * <html data-theme> via a DOM observer — no Zustand subscription, so theme
 * flips do not re-render the app shell.
 */

import { useEffect, useState } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { isDarkBase, type ThemeBase } from '@/theme/constants'

function readDocumentThemeMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  const base = document.documentElement.getAttribute('data-theme') as ThemeBase | null
  if (base && isDarkBase(base)) return 'dark'
  return 'light'
}

export function Toaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>(readDocumentThemeMode)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setTheme(readDocumentThemeMode())
    sync()

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.attributeName === 'data-theme')) sync()
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

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
