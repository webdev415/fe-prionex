import type { ClientFilters } from '../ClientManagementPage'

/**
 * How many filters the user has applied, for the "(N applied)" label and the
 * Clear All button that shows whenever this is above zero.
 *
 * One per GROUP, not per value: three tags is one filter applied, and tags,
 * excluded tags and a segment share a single count between them. RR status
 * follows the same rule -- it was simply left out of this tally when the
 * filter was added, so the list filtered while the label still read 0 and
 * Clear All never appeared (KAN-1119).
 *
 * Exported so the count can be tested without standing up the whole page.
 */
export function countAppliedFilters(
  filters: ClientFilters,
  selectedPriorities: string[],
  selectedV3Buckets: string[]
): number {
  let count = 0
  if (filters.debtRangeFrom || filters.debtRangeTo) count++
  if (filters.principalRangeFrom || filters.principalRangeTo) count++
  // DPD Range not yet implemented (days past due not calculated)
  // if (filters.dpdRangeFrom || filters.dpdRangeTo) count++
  if (filters.dateOfSaleFrom || filters.dateOfSaleTo) count++
  if (filters.taDateFrom || filters.taDateTo) count++
  if (filters.interactionUserIds && filters.interactionUserIds.length > 0) count++
  if (filters.interactionDateFrom || filters.interactionDateTo) count++
  if (filters.assignmentDateFrom || filters.assignmentDateTo) count++
  if (filters.portfolio && filters.portfolio.length > 0) count++
  if (
    (filters.tagIds && filters.tagIds.length > 0) ||
    (filters.excludeTagIds && filters.excludeTagIds.length > 0) ||
    filters.segmentId
  )
    count++
  if (filters.rrStatusIds && filters.rrStatusIds.length > 0) count++
  if (filters.responsibleEmployeeIds && filters.responsibleEmployeeIds.length > 0) count++
  if (filters.responsibleSearcher) count++
  if (filters.unassignedOnly) count++
  if (filters.hasVerifiedPayment) count++
  if (filters.chainIds && filters.chainIds.length > 0) count++
  if (filters.chainStepIds && filters.chainStepIds.length > 0) count++
  if (filters.stepValues && Object.keys(filters.stepValues).length > 0) count++
  if (selectedPriorities.length > 0) count++
  if (selectedV3Buckets.length > 0) count++
  return count
}
