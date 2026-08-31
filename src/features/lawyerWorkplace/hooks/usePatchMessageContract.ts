import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { legalApi } from '../api/legalApi'
import type { LegalContractPatchRequest } from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

/**
 * Persists an explicit contract pick by the lawyer. Must stay user-initiated
 * only (no render-driven callers): the error toast below fires on every failed
 * attempt, and a background loop once buried the confirm button under 409/400
 * toasts. The single-contract auto-select is display-only in the panel — the
 * backend resolves it itself on confirm.
 */
export function usePatchMessageContract() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      messageId,
      payload,
    }: {
      messageId: string
      payload: LegalContractPatchRequest
    }) => legalApi.patchMessageContract(messageId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.message(variables.messageId),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
