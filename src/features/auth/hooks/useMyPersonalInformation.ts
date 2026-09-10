import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/**
 * These fields are saved by the profile form's own button, alongside the name
 * and phone beside them, so the success toast belongs to that save rather than
 * to this half of it - two toasts for one press reads as two things happening.
 * A failure still speaks for itself: the profile write may well have gone
 * through, and silence would leave somebody believing all of it did.
 */
export function useUpdateMyPersonalInformation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: MyPersonalInformationInput) => authApi.updateMyPersonalInformation(data),
    /*
     * The answer is the saved row, so it goes straight into the cache. A
     * refetch would leave the old values on screen for the moment right after
     * saving, which is the moment somebody is looking at them.
     */
    onSuccess: (saved: MyPersonalInformation) => {
      queryClient.setQueryData(MY_PERSONAL_INFORMATION_QUERY_KEY, saved)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
