import type { ClientFilters } from './ClientManagementPage'

export function countAppliedFilters(
  filters: ClientFilters,
  selectedPriorityCount: number,
  selectedV3BucketCount: number
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
  if (selectedPriorityCount > 0) count++
  if (selectedV3BucketCount > 0) count++
  return count
}
