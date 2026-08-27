import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { authApi } from '@/features/auth/api/authApi'
import { getErrorMessage } from '@/lib/errors'
import type { MyPersonalInformation, MyPersonalInformationInput } from '@/types/api'

export const MY_PERSONAL_INFORMATION_QUERY_KEY = ['me', 'personal'] as const

export function useMyPersonalInformation() {
  return useQuery({
    queryKey: MY_PERSONAL_INFORMATION_QUERY_KEY,
    queryFn: () => authApi.myPersonalInformation(),
  })
}

export function useUpdateMyPersonalInformation() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: MyPersonalInformationInput) => authApi.updateMyPersonalInformation(data),
    /*
     * The answer is the saved row, so it goes straight into the cache. A
     * refetch would leave the old values on screen for the moment right after
     * saving, which is the moment somebody is looking at them.
     */
    onSuccess: (saved: MyPersonalInformation) => {
      queryClient.setQueryData(MY_PERSONAL_INFORMATION_QUERY_KEY, saved)
      toast.success(t('pages.profile.personalInformation.saved'))
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
