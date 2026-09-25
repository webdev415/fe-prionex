/**
 * HubRoleSelect - «Роль у чаті (HUB)» in the create/edit role forms (KAN-1476).
 *
 * Rendered only while the catalogue is enabled: with the choice switched off
 * or the catalogue unreachable there is nothing honest to offer, and a field
 * that is not shown cannot leak a value into the request either.
 */

import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/Label'
import {
  HUB_ROLE_NOT_SET,
  hubRoleChoices,
  type HubRoleCatalogView,
  type HubRoleLock,
} from '../hubRoles'

export const HUB_ROLE_FIELD_ID = 'hub_role'

interface HubRoleSelectProps {
  catalog: HubRoleCatalogView
  /** The select's value; `''` is "not set". */
  value: string
  onChange: (value: string) => void
  /** The value saved on the role, kept visible even when no longer offered. */
  stored?: string | null
  lock?: HubRoleLock
  disabled?: boolean
}

export function HubRoleSelect({
  catalog,
  value,
  onChange,
  stored = null,
  lock = null,
  disabled = false,
}: HubRoleSelectProps) {
  const { t } = useTranslation('common')

  if (catalog.status !== 'enabled') return null

  const choices = hubRoleChoices(catalog.options, stored)
  const lockNoteId = `${HUB_ROLE_FIELD_ID}-lock`

  return (
    <div>
      <Label htmlFor={HUB_ROLE_FIELD_ID}>
        {t('pages.roles.forms.hubRole', 'HUB chat role')}
        <span className="text-muted-foreground ml-1 text-sm font-light">
          {t('pages.roles.forms.optional')}
        </span>
      </Label>
      <select
        id={HUB_ROLE_FIELD_ID}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || lock !== null}
        aria-describedby={lock ? lockNoteId : undefined}
        className="text-foreground border-border bg-card flex h-[45px] w-full items-center rounded-lg border px-3 py-2 text-sm font-light shadow-none focus:ring-0 focus:outline-none disabled:opacity-50"
      >
        <option value="">{t(HUB_ROLE_NOT_SET.labelKey, HUB_ROLE_NOT_SET.fallback)}</option>
        {choices.map((choice) => (
          <option key={choice.code} value={choice.code} disabled={choice.disabled}>
            {choice.unavailable
              ? t('pages.roles.forms.hubRoleUnavailableOption', {
                  code: choice.code,
                  defaultValue: '{{code}} (not available for selection)',
                })
              : choice.label
                ? t(choice.label.labelKey, choice.label.fallback)
                : choice.code}
          </option>
        ))}
      </select>
      {lock && (
        <p id={lockNoteId} className="text-muted-foreground mt-1 text-sm">
          {lock === 'default'
            ? t(
                'pages.roles.forms.hubRoleLockedDefault',
                'A default role keeps the HUB chat role set by the system; it cannot be changed here.'
              )
            : // No reason is named: the catalogue says only "not yours to
              // choose now" - true for a non-HUB-admin looking at admin, and
              // for anybody (a HUB admin too) while impersonating.
              t(
                'pages.roles.forms.hubRoleLockedNotAssignable',
                'This value is not available for you to choose right now, so it cannot be changed here.'
              )}
        </p>
      )}
      <p className="text-muted-foreground mt-1 text-sm">
        {t(
          'pages.roles.forms.hubRoleHint',
          'Not set: HUB decides the rights by the role name; if HUB does not know the name, minimal rights (employee). Changes take effect in HUB within ~6 min without signing in again.'
        )}
      </p>
    </div>
  )
}
