/**
 * Toaster Component
 *
 * Global toast notification system using Sonner.
 * Provides success, error, warning, and info notifications.
 */

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        style: {
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          color: '#111827',
        },
        className: 'toast',
      }}
    />
  )
}
