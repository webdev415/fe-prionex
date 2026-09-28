/**
 * React Query hooks for write-off operations (KAN-245).
 *
 * Multi-error responses surface via Axios in the structured shape from
 * REQUIREMENTS §5.2:
 *   { detail: "Validation failed", errors: [{ code, field, ... }, ...] }
 *
 * Components should NOT toast the AxiosError directly — use
 * ``extractWriteoffErrors`` to pull the structured ``errors[]`` and
 * render them per-field. A generic toast is acceptable for non-validation
 * failures (5xx, network).
 */

import type { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'

import { writeoffsApi } from '../api/writeoffsApi'
import type {
  CancelWriteoffRequest,
  CreateWriteoffRequest,
  ListWriteoffsParams,
  UpdateWriteoffRequest,
  WriteoffFieldError,
  WriteoffValidationErrorResponse,
} from '../api/types'

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const writeoffKeys = {
  all: ['writeoffs'] as const,
  lists: () => [...writeoffKeys.all, 'list'] as const,
  list: (debtId: number, params: ListWriteoffsParams) =>
    [...writeoffKeys.lists(), debtId, params] as const,
  byDebt: (debtId: number) => [...writeoffKeys.all, 'debt', debtId] as const,
  details: () => [...writeoffKeys.all, 'detail'] as const,
  detail: (entryId: number) => [...writeoffKeys.details(), entryId] as const,
}

// ---------------------------------------------------------------------------
// Error extraction
// ---------------------------------------------------------------------------

/**
 * Pull the structured ``errors[]`` array from an Axios error response.
 * Returns ``null`` if the response isn't a writeoff-validation error
 * (e.g. a 5xx or network failure).
 */
export function extractWriteoffErrors(error: unknown): WriteoffFieldError[] | null {
  const axiosError = error as AxiosError<WriteoffValidationErrorResponse>
  const data = axiosError?.response?.data
  if (data && Array.isArray(data.errors) && data.detail === 'Validation failed') {
    return data.errors
  }
  return null
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** List entries for a debt (paginated, filtered). */
export function useWriteoffsForDebt(
  debtId: number,
  params: ListWriteoffsParams = {},
  enabled = true
) {
  return useQuery({
    queryKey: writeoffKeys.list(debtId, params),
    queryFn: () => writeoffsApi.listWriteoffsForDebt(debtId, params),
    enabled: enabled && !!debtId,
    staleTime: 15_000,
  })
}

/** Read a single entry by id. */
export function useWriteoff(entryId: number, enabled = true) {
  return useQuery({
    queryKey: writeoffKeys.detail(entryId),
    queryFn: () => writeoffsApi.getWriteoff(entryId),
    enabled: enabled && !!entryId,
    staleTime: 15_000,
  })
}

/** Create N entries on a debt (one per non-zero component). */
export function useCreateWriteoffs(
  debtId: number,
  options?: {
    onValidationErrors?: (errors: WriteoffFieldError[]) => void
  }
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWriteoffRequest) => writeoffsApi.createWriteoffs(debtId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: writeoffKeys.byDebt(debtId) })
      queryClient.invalidateQueries({ queryKey: writeoffKeys.lists() })
      // Bust the client-detail cache so total_to_return refreshes via the
      // routers/clients.py:130 extension.
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (error: AxiosError<WriteoffValidationErrorResponse>) => {
      const structured = extractWriteoffErrors(error)
      if (structured && options?.onValidationErrors) {
        options.onValidationErrors(structured)
        return
      }
      const fallback =
        (error?.response?.data as { detail?: string } | undefined)?.detail ??
        'Failed to create write-off'
      toast.error(
        typeof fallback === 'string'
          ? fallback
          : i18n.t('toasts.writeoffs.createFailed', { defaultValue: 'Failed to create write-off' })
      )
    },
  })
}

/** Edit cancellation_date / notes on an active entry. */
export function useEditWriteoff(
  entryId: number,
  options?: {
    onValidationErrors?: (errors: WriteoffFieldError[]) => void
  }
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateWriteoffRequest) => writeoffsApi.editWriteoff(entryId, data),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: writeoffKeys.detail(entryId) })
      queryClient.invalidateQueries({ queryKey: writeoffKeys.byDebt(entry.debt_id) })
      // Bust list-shaped queries too — ClientWriteoffsTable uses
      // writeoffKeys.list(debtId, params), which doesn't share a prefix
      // with byDebt. Without this the table doesn't refresh.
      queryClient.invalidateQueries({ queryKey: writeoffKeys.lists() })
    },
    onError: (error: AxiosError<WriteoffValidationErrorResponse>) => {
      const structured = extractWriteoffErrors(error)
      if (structured && options?.onValidationErrors) {
        options.onValidationErrors(structured)
        return
      }
      toast.error(
        i18n.t('toasts.writeoffs.editFailed', { defaultValue: 'Failed to edit write-off' })
      )
    },
  })
}

/** Soft-cancel an active entry. */
export function useCancelWriteoff(
  entryId: number,
  options?: {
    onValidationErrors?: (errors: WriteoffFieldError[]) => void
  }
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CancelWriteoffRequest = {}) => writeoffsApi.cancelWriteoff(entryId, data),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: writeoffKeys.detail(entryId) })
      queryClient.invalidateQueries({ queryKey: writeoffKeys.byDebt(entry.debt_id) })
      // Bust list-shaped queries too — ClientWriteoffsTable uses
      // writeoffKeys.list(debtId, {status, ...}) which lives under
      // writeoffKeys.lists() (not under byDebt). Without this the
      // entry stays visible in the Active tab and never appears in the
      // Cancelled tab until the page is refreshed manually.
      queryClient.invalidateQueries({ queryKey: writeoffKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (error: AxiosError<WriteoffValidationErrorResponse>) => {
      const structured = extractWriteoffErrors(error)
      if (structured && options?.onValidationErrors) {
        options.onValidationErrors(structured)
        return
      }
      toast.error(
        i18n.t('toasts.writeoffs.cancelFailed', { defaultValue: 'Failed to cancel write-off' })
      )
    },
  })
}
