/**
 * Page-level scope selector for Action Analysis → Calls (KAN-506).
 *
 * The scope value lives on the URL (`?scope=…`) and applies to every Calls
 * sub-tab: it drives the effective `user_ids[]` filter each sub-tab sends to
 * its backend. Tab-level employee / department pickers continue to exist but
 * become refinements within the active scope (see `useScopedUserIds`).
 */

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { useAuthStore } from '@/stores/authStore'

export type ActionAnalysisScope = 'my' | 'group' | 'department' | 'all'

export const ACTION_ANALYSIS_SCOPES: readonly ActionAnalysisScope[] = [
  'my',
  'group',
  'department',
  'all',
]

/**
 * What the URL means when no `scope` param is present.
 *
 * Set to `'all'` (less-narrowing) so legacy shareable URLs predating KAN-506
 * don't silently shrink to "my actions only" on first read. New navigations
 * always write the param explicitly, so the only path that hits this default
 * is a brand-new visit with an un-set scope.
 */
export const LEGACY_URL_DEFAULT_SCOPE: ActionAnalysisScope = 'all'

export function isActionAnalysisScope(v: string | null): v is ActionAnalysisScope {
  return v != null && (ACTION_ANALYSIS_SCOPES as readonly string[]).includes(v)
}

export function readScope(params: URLSearchParams): ActionAnalysisScope {
  const raw = params.get('scope')
  return isActionAnalysisScope(raw) ? raw : LEGACY_URL_DEFAULT_SCOPE
}

export function writeScope(base: URLSearchParams, scope: ActionAnalysisScope): URLSearchParams {
  const next = new URLSearchParams(base)
  next.set('scope', scope)
  return next
}

export interface ScopedUserIds {
  scope: ActionAnalysisScope
  /** Effective user_ids[] filter, or undefined for "no filter" (scope=all / group). */
  userIds: number[] | undefined
  /** When true, the tab-level Employee picker must render disabled. */
  employeePickerDisabled: boolean
  /** When true, the tab-level Department picker must render disabled. */
  departmentPickerDisabled: boolean
  /** Label to render on a disabled picker (i18n key). */
  disabledLabelKey: string
  /**
   * True when scope=department but the current user has no department or
   * no operators in it. Sub-tabs should render an explicit empty-state
   * instead of issuing a request with `user_ids=[]` (which would 200 → 0).
   */
  isEmptyResolution: boolean
}

const SCOPE_LABEL_KEY: Record<ActionAnalysisScope, string> = {
  my: 'pages.actionAnalysis.scope.my',
  group: 'pages.actionAnalysis.scope.group',
  department: 'pages.actionAnalysis.scope.department',
  all: 'pages.actionAnalysis.scope.all',
}

/**
 * Resolve the current scope into an effective user_ids[] list plus
 * picker-disabled flags. Each sub-tab consumes this hook and passes the
 * resolved `userIds` to its backend filter.
 *
 * Resolution rules (also documented in [Epic/KAN-506-Plan.md](Epic/KAN-506-Plan.md) §3.4):
 *   - `my`         → `[me.id]`; both pickers disabled.
 *   - `group`      → `undefined` (no-op until Groups land); both pickers disabled.
 *   - `department` → operators sharing the current user's department; department
 *                    picker disabled (locked), employee picker enabled as a refinement.
 *                    If no department or no operators → `userIds=[]` + isEmptyResolution.
 *   - `all`        → `undefined`; both pickers fully enabled.
 */
export function useScopedUserIds(operators: OperatorUser[]): ScopedUserIds {
  const [searchParams] = useSearchParams()
  const scope = readScope(searchParams)
  const userId = useAuthStore((s) => (s.user?.id ? Number(s.user.id) : null))
  const departmentId = useAuthStore((s) => s.user?.active_department_id ?? null)

  return useMemo<ScopedUserIds>(() => {
    if (scope === 'my') {
      return {
        scope,
        userIds: userId != null ? [userId] : [],
        employeePickerDisabled: true,
        departmentPickerDisabled: true,
        disabledLabelKey: SCOPE_LABEL_KEY.my,
        isEmptyResolution: userId == null,
      }
    }
    if (scope === 'group') {
      // Groups are placeholder UI until the entity ships. Treat as no-op so
      // the user sees data instead of an empty page.
      return {
        scope,
        userIds: undefined,
        employeePickerDisabled: true,
        departmentPickerDisabled: true,
        disabledLabelKey: SCOPE_LABEL_KEY.group,
        isEmptyResolution: false,
      }
    }
    if (scope === 'department') {
      if (departmentId == null) {
        return {
          scope,
          userIds: [],
          employeePickerDisabled: true,
          departmentPickerDisabled: true,
          disabledLabelKey: SCOPE_LABEL_KEY.department,
          isEmptyResolution: true,
        }
      }
      const ids = operators.filter((o) => o.department_id === departmentId).map((o) => o.id)
      return {
        scope,
        userIds: ids,
        employeePickerDisabled: false,
        departmentPickerDisabled: true,
        disabledLabelKey: SCOPE_LABEL_KEY.department,
        isEmptyResolution: ids.length === 0,
      }
    }
    // scope === 'all'
    return {
      scope,
      userIds: undefined,
      employeePickerDisabled: false,
      departmentPickerDisabled: false,
      disabledLabelKey: SCOPE_LABEL_KEY.all,
      isEmptyResolution: false,
    }
  }, [scope, userId, departmentId, operators])
}
