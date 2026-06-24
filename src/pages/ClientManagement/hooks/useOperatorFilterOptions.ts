/**
 * useOperatorFilterOptions (KAN-572)
 *
 * Shared derivation of the operator option lists used by the Client List
 * filters. Extracted from ClientFiltersBar so that ClientManagementPage can
 * detect the "all operators selected" case when building API params and omit
 * the (heavy) `responsible_employee_ids` / `interaction_user_ids` filter — an
 * all-IDs IN-list defeats the priority index and turns the dashboard query
 * into a full-scan + sort (the morning-login OOM/502 trigger).
 *
 * Rule (matches the original inline derivation): all active operators are
 * shown; an inactive operator appears only if it has >=1 client in the
 * relevant role — employee for Responsible Employee, searcher for Responsible
 * Searcher, either role for Interaction Created By.
 *
 * Both consumers call the same underlying react-query hooks, so the data is
 * fetched once and shared from cache — no extra network cost.
 */

import { useMemo } from 'react'
import { useClientAssigneeIds } from '@/features/clients/hooks/useClients'
import { useOperators } from '@/features/users/hooks/useUsers'
import type { OperatorOption } from '../components/OperatorMultiSelectDropdown'

export interface OperatorFilterOptions {
  employeeOptions: OperatorOption[]
  interactionUserOptions: OperatorOption[]
  searcherOptions: Array<{ id: string; name: string; isInactive: boolean }>
  /** True once both underlying lists have resolved, so the option sets are
   * complete. Consumers that decide whether to OMIT an operator filter must
   * wait for this — an incomplete option set would mis-detect "all selected"
   * and either send the heavy filter or omit it incorrectly. */
  isReady: boolean
}

export function useOperatorFilterOptions(projectId: number | null): OperatorFilterOptions {
  const { data: operators } = useOperators(projectId, { includeInactive: true })
  const { data: assigneeIds } = useClientAssigneeIds(!!projectId)
  // Both feed the option sets (assigneeIds gates which inactive operators
  // appear), so neither alone is enough to trust a "covers all" check.
  const isReady = operators !== undefined && assigneeIds !== undefined

  const { employeeIds, searcherIds, anyAssignedIds } = useMemo(() => {
    const emp = new Set<number>(assigneeIds?.employee_ids ?? [])
    const sea = new Set<number>(assigneeIds?.searcher_ids ?? [])
    return {
      employeeIds: emp,
      searcherIds: sea,
      anyAssignedIds: new Set<number>([...emp, ...sea]),
    }
  }, [assigneeIds])

  const interactionUserOptions = useMemo(
    () =>
      (operators ?? [])
        .filter((u) => u.status === 'active' || anyAssignedIds.has(u.id))
        .map((u) => ({
          id: u.id,
          name: u.full_name,
          isInactive: u.status !== 'active',
        })),
    [operators, anyAssignedIds]
  )

  const employeeOptions = useMemo(
    () =>
      (operators ?? [])
        .filter((u) => u.status === 'active' || employeeIds.has(u.id))
        .map((u) => ({
          id: u.id,
          name: u.full_name,
          isInactive: u.status !== 'active',
        })),
    [operators, employeeIds]
  )

  const searcherOptions = useMemo(
    () =>
      (operators ?? [])
        .filter((u) => u.status === 'active' || searcherIds.has(u.id))
        .map((u) => ({
          id: u.id.toString(),
          name: u.full_name,
          isInactive: u.status !== 'active',
        })),
    [operators, searcherIds]
  )

  return { employeeOptions, interactionUserOptions, searcherOptions, isReady }
}

/**
 * True when `selectedIds` covers every option in `optionIds` (i.e. "all
 * operators" are selected) — in which case the filter is a no-op and should be
 * omitted from the API request. Sentinel ids (e.g. "No Responsible") must be
 * stripped by the caller before calling this, since they widen the result set
 * and are NOT equivalent to "no filter".
 */
export function coversAllOptions(selectedRealIds: number[], optionIds: number[]): boolean {
  if (optionIds.length === 0) return false
  if (selectedRealIds.length < optionIds.length) return false
  const selectedSet = new Set(selectedRealIds)
  return optionIds.every((id) => selectedSet.has(id))
}
