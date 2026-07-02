/**
 * Action Analysis per-tab access levels (KAN-757).
 *
 * The 8 tab permissions carry an access-depth ceiling per role, configured
 * alongside the permission toggle in the role form and enforced server-side.
 * Values mirror the backend + the Action Analysis scope selector tokens.
 */

export type AccessLevel = 'my' | 'group' | 'department' | 'all'

export const DEFAULT_ACCESS_LEVEL: AccessLevel = 'all'

/** Backend permission names of the scope-aware Action Analysis tabs. */
export const TAB_ACCESS_PERMISSIONS: ReadonlySet<string> = new Set([
  'view_call_list',
  'view_interaction_history',
  'view_ta_history',
  'view_task_history',
  'view_payment_history',
  'view_click_tracking',
  'view_screen_time',
  'view_activity_heatmap',
])

export const ACCESS_LEVEL_OPTIONS: ReadonlyArray<{
  value: AccessLevel
  labelKey: string
  fallback: string
}> = [
  { value: 'my', labelKey: 'pages.roles.accessLevel.my', fallback: 'Only mine' },
  { value: 'group', labelKey: 'pages.roles.accessLevel.group', fallback: 'My group' },
  {
    value: 'department',
    labelKey: 'pages.roles.accessLevel.department',
    fallback: 'My department',
  },
  { value: 'all', labelKey: 'pages.roles.accessLevel.all', fallback: 'Entire project' },
]

export function isTabAccessPermission(permissionName: string): boolean {
  return TAB_ACCESS_PERMISSIONS.has(permissionName)
}
