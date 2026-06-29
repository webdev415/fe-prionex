/**
 * useGuardedAction
 *
 * Returns a guard wrapper for click handlers. If the current user has
 * `permission`, the wrapper invokes `action()`. Otherwise it shows a
 * sonner warning toast and swallows the click.
 *
 * Used by the "show + warn-on-click" buttons (TA-interaction Edit + Delete
 * on the TA Chains tab, reassign triggers + the Submit "Assign" button
 * inside the modal) so users see the affordance even when they can't
 * act on it.
 *
 * Backend 403 enforcement is independent — the toast is a UX nicety,
 * not the security boundary.
 *
 * Visual: same sonner card style used elsewhere in the app
 * (`src/components/Toaster.tsx` — white card, bottom-right, with
 * `richColors` + `closeButton`), rendered via `toast.warning(...)`.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { Permission } from '@/constants/permissions'
import { useHasPermission } from '@/hooks'

export function useGuardedAction(
  permission: Permission,
  warningKey?: string
): (action: () => void) => void {
  const hasPermission = useHasPermission(permission)
  const { t } = useTranslation()

  return useCallback(
    (action: () => void) => {
      if (!hasPermission) {
        toast.warning(
          warningKey
            ? t(warningKey)
            : t('errors:permissions.required', {
                permission,
                defaultValue: "You don't have permission to do that ({{permission}})",
              })
        )
        return
      }
      action()
    },
    [hasPermission, permission, warningKey, t]
  )
}
