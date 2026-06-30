import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { legalApi } from '../api/legalApi'
import type { LegalLetterConfirmRequest } from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

export function useConfirmLetter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      messageId,
      payload,
    }: {
      messageId: string
      payload: LegalLetterConfirmRequest
    }) => legalApi.confirmLetter(messageId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.message(data.message_id),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
