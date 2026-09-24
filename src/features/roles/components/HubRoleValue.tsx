/**
 * HubRoleValue - a role's HUB chat role as read-only text (KAN-1476), for the
 * role view and the roles table.
 */

import { useTranslation } from 'react-i18next'
import { HUB_ROLE_NOT_SET, describeHubRole, type HubRoleCatalogStatus } from '../hubRoles'

interface HubRoleValueProps {
  code: string | null | undefined
  status: HubRoleCatalogStatus
}

export function HubRoleValue({ code, status }: HubRoleValueProps) {
  const { t } = useTranslation('common')
  const display = describeHubRole(code, status)

  if (display.kind === 'notSet') {
    return <span>{t(HUB_ROLE_NOT_SET.labelKey, HUB_ROLE_NOT_SET.fallback)}</span>
  }
  if (display.kind === 'known') {
    return <span>{t(display.label.labelKey, display.label.fallback)}</span>
  }
  return (
    <span>
      <span>{display.code}</span>
      {display.catalogUnavailable && (
        <span className="text-muted-foreground ml-1 text-xs font-light">
          ({t('pages.roles.forms.hubRoleCatalogUnavailable', 'HUB catalogue unavailable')})
        </span>
      )}
    </span>
  )
}
