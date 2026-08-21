import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { legalApi } from '../api/legalApi'
import type { LegalLetterConfirmRequest } from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

/**
 * The backend answers confirm with 409 "Letter already confirmed" when the
 * kanban task already exists (double click, stale panel, second tab). For the
 * lawyer that is a success — the task is there — so callers treat it as one
 * instead of toasting an error the user retries in a loop.
 */
export function isLetterAlreadyConfirmed(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) {
    return false
  }
  const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
  return typeof detail === 'string' && detail.toLowerCase().includes('already confirmed')
}

export function useConfirmLetter() {
  const { t } = useTranslation('common')
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
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
    },
    onError: (error, variables) => {
      if (isLetterAlreadyConfirmed(error)) {
        // The task exists — refresh the letter and the inbox so the panel
        // flips to its read-only state instead of inviting another click.
        toast.success(
          t('pages.lawyerWorkplace.parameters.alreadyConfirmed', 'Task already created on kanban')
        )
        queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
        queryClient.invalidateQueries({
          queryKey: legalWorkplaceKeys.message(variables.messageId),
        })
        queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
        queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
        return
      }
      toast.error(getErrorMessage(error))
    },
  })
}
