/**
 * Dialer feature constants (KAN-379).
 */

/**
 * Access groups that may operate a queue. Matches the values shown in the
 * supervisor Queue List "Access group" column and the add/edit modal
 * (design: supervisor-01 / supervisor-02).
 */
export const ACCESS_GROUPS = ['all_groups', 'supervisor', 'operator', 'administrator'] as const

export type AccessGroup = (typeof ACCESS_GROUPS)[number]

/**
 * Concrete, selectable access groups for the multi-select (design: supervisor-02).
 * Excludes the `all_groups` sentinel — an EMPTY `access_groups` array means
 * "All groups" (unrestricted), so `all_groups` is never stored as a value.
 */
export const ACCESS_GROUP_VALUES = ['supervisor', 'administrator', 'operator'] as const

/** i18n key suffix + fallback label per access group. */
export const ACCESS_GROUP_LABELS: Record<AccessGroup, string> = {
  all_groups: 'All groups',
  supervisor: 'Supervisor',
  operator: 'Operator',
  administrator: 'Administrator',
}
