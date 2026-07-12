import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { LawyerStatus } from '@/pages/LawyerWorkplace/settings/types'
import { useAuthStore } from '@/stores/authStore'
import { legalApi } from '../api/legalApi'
import { getErrorMessage } from '@/lib/errors'
import { legalWorkplaceKeys, useLegalLawyers } from './useLegalInbox'

export function useIsRegisteredLegalLawyer() {
  const currentUserId = useAuthStore((state) => (state.user?.id ? Number(state.user.id) : null))
  const lawyersQuery = useLegalLawyers()

  const isRegisteredLawyer = useMemo(() => {
    if (!currentUserId) return false
    return (lawyersQuery.data?.items ?? []).some((lawyer) => lawyer.user_id === currentUserId)
  }, [currentUserId, lawyersQuery.data?.items])

  return {
    isRegisteredLawyer,
    isLoading: lawyersQuery.isLoading,
  }
}

export function useLegalLawyerMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: legalWorkplaceKeys.lawyerMe(),
    queryFn: () => legalApi.getMyLawyerProfile(),
    enabled: options?.enabled !== false,
    staleTime: 30_000,
    retry: false,
  })
}

export function useUpdateMyLawyerStatus() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: LawyerStatus) => legalApi.updateMyLawyerStatus(status),
    onSuccess: (data) => {
      queryClient.setQueryData(legalWorkplaceKeys.lawyerMe(), data)
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
      toast.success(t('pages.lawyerWorkplace.availability.updateSuccess', 'Availability updated'))
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error) ||
          t('pages.lawyerWorkplace.availability.updateError', 'Could not update availability')
      )
    },
  })
}
