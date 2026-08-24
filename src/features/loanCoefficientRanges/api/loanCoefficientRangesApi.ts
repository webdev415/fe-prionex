import { api } from '@/lib/api'

/**
 * Loan closing coefficient ranges (KAN-994).
 *
 * Coefficients are carried as strings, not numbers: the backend stores
 * numeric(3,1) and rejects more than one decimal place, and round-tripping
 * through a JS float would reintroduce values like 1.5000000000000002.
 */
export interface LoanCoefficientRange {
  id: number
  project_id: number
  min_days: number
  max_days: number
  min_coefficient: string
  max_coefficient: string
  updated_by_username: string | null
  /** Last change only — not a history. Earlier edits are overwritten and a
   *  deleted range leaves nothing behind. */
  updated_at: string
}

export interface LoanCoefficientRangeInput {
  min_days: number
  max_days: number
  min_coefficient: string
  max_coefficient: string
}

const BASE_URL = '/api/v1/loan-coefficient-ranges'

export async function listCoefficientRanges(): Promise<LoanCoefficientRange[]> {
  const response = await api.get<LoanCoefficientRange[]>(BASE_URL)
  return response.data
}

export async function createCoefficientRange(
  input: LoanCoefficientRangeInput
): Promise<LoanCoefficientRange> {
  const response = await api.post<LoanCoefficientRange>(BASE_URL, input)
  return response.data
}

export async function updateCoefficientRange(
  id: number,
  input: LoanCoefficientRangeInput
): Promise<LoanCoefficientRange> {
  const response = await api.put<LoanCoefficientRange>(`${BASE_URL}/${id}`, input)
  return response.data
}

export async function deleteCoefficientRange(id: number): Promise<void> {
  await api.delete(`${BASE_URL}/${id}`)
}
