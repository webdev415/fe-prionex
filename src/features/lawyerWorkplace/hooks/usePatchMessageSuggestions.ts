import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { legalApi } from '../api/legalApi'
import type { LegalMessageSuggestionsPatchRequest } from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

export function usePatchMessageSuggestions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      messageId,
      payload,
    }: {
      messageId: string
      payload: LegalMessageSuggestionsPatchRequest
    }) => legalApi.patchMessageSuggestions(messageId, payload),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.message(variables.messageId),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
      return data
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
