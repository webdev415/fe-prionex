import api from '@/lib/api'

const BASE_URL = '/api/v1/users/me/operator-pins'

/**
 * The operators this user has pinned, oldest pin first.
 *
 * Ids and nothing else: the assignee pickers already hold the full operator
 * records from the operators query, so carrying names here too would create a
 * second copy that can drift out of step with that one.
 */
export interface OperatorPinListResponse {
  operator_ids: number[]
}

export async function getOperatorPins(): Promise<OperatorPinListResponse> {
  const response = await api.get<OperatorPinListResponse>(BASE_URL)
  return response.data
}

/**
 * Pin an operator.
 *
 * Idempotent server-side — pinning somebody already pinned is a no-op rather
 * than a toggle, so a double-fired click cannot silently undo itself. Returns
 * the whole set, which lets the caller replace its cache from the response
 * instead of refetching underneath an open popover.
 */
export async function pinOperator(operatorId: number): Promise<OperatorPinListResponse> {
  const response = await api.post<OperatorPinListResponse>(`${BASE_URL}/${operatorId}`)
  return response.data
}

/** Unpin an operator. Idempotent, and returns the whole set, as above. */
export async function unpinOperator(operatorId: number): Promise<OperatorPinListResponse> {
  const response = await api.delete<OperatorPinListResponse>(`${BASE_URL}/${operatorId}`)
  return response.data
}
