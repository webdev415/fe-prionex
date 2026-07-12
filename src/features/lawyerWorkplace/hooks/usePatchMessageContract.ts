import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { legalApi } from '../api/legalApi'
import type { LegalContractPatchRequest } from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

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
