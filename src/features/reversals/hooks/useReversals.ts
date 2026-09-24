/**
 * React Query hooks for payment reversal / storno operations (KAN-334).
 *
 * Validation failures surface via Axios in the structured shape:
 *   { detail: "Validation failed", errors: [{ code, message, field?, ... }] }
 *
 * Use ``extractReversalErrors`` to pull the structured ``errors[]`` and render
 * them in the modal; fall back to a generic toast for 5xx / network failures.
 */

import type { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'

import { reversalsApi } from '../api/reversalsApi'
import type {
  BulkReversalRequest,
  CreateReversalRequest,
  ReversalFieldError,
  ReversalListParams,
  ReversalValidationErrorResponse,
} from '../api/types'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const reversalKeys = {
  all: ['reversals'] as const,
  lists: () => [...reversalKeys.all, 'list'] as const,
  list: (params: ReversalListParams) => [...reversalKeys.lists(), params] as const,
}

// ---------------------------------------------------------------------------
// Error extraction
// ---------------------------------------------------------------------------

export function extractReversalErrors(error: unknown): ReversalFieldError[] | null {
  const axiosError = error as AxiosError<{ detail?: ReversalValidationErrorResponse | string }>
  const data = axiosError?.response?.data
  // FastAPI wraps HTTPException(detail=...) so the structured envelope lands
  // under response.data.detail.
  const envelope = (data?.detail ?? data) as ReversalValidationErrorResponse | undefined
  if (
    envelope &&
    typeof envelope === 'object' &&
    Array.isArray(envelope.errors) &&
    envelope.detail === 'Validation failed'
  ) {
    return envelope.errors
  }
  return null
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** List reversal operations, optionally scoped to a client / debt / payment. */
export function useReversals(params: ReversalListParams = {}, enabled = true) {
  return useQuery({
    queryKey: reversalKeys.list(params),
    queryFn: () => reversalsApi.listReversals(params),
    enabled: enabled && (!!params.client_id || !!params.debt_id || !!params.payment_id),
    staleTime: 15_000,
  })
}

function invalidateAfterReversal(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: reversalKeys.lists() })
  // Refresh the payments list (indicator + disabled Reverse action) and
  // client-detail (a reopened credit changes debt status).
  queryClient.invalidateQueries({ queryKey: ['client-payment-history'] })
  queryClient.invalidateQueries({ queryKey: ['payments'] })
  queryClient.invalidateQueries({ queryKey: ['clients'] })
}

/** Create a single reversal on one payment. */
export function useCreateReversal(options?: {
  onValidationErrors?: (errors: ReversalFieldError[]) => void
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateReversalRequest) => reversalsApi.createReversal(data),
    onSuccess: () => invalidateAfterReversal(queryClient),
    onError: (error: AxiosError<ReversalValidationErrorResponse>) => {
      const structured = extractReversalErrors(error)
      if (structured && options?.onValidationErrors) {
        options.onValidationErrors(structured)
        return
      }
      toast.error(
        i18n.t('toasts.reversals.createFailed', { defaultValue: 'Failed to create reversal' })
      )
    },
  })
}

/** Bulk reversal from parsed file rows. */
export function useBulkReversal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: BulkReversalRequest) => reversalsApi.bulkReversal(data),
    onSuccess: () => invalidateAfterReversal(queryClient),
  })
}
