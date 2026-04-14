import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authApi } from '@/features/auth/api/authApi'
import { usersKeys } from '@/features/users/hooks/useUsers'
import { rolesKeys } from '@/features/roles/hooks/useRoles'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import type { UpdateMyProfileInput } from '@/types/api'

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const refreshUser = useAuthStore((state) => state.refreshUser)

  return useMutation({
    mutationFn: (data: UpdateMyProfileInput) => authApi.updateMyProfile(data),
    onSuccess: () => {
      toast.success('User updated successfully')
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: usersKeys.detail(Number(user.id)) })
      }
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() })
      queryClient.invalidateQueries({ queryKey: rolesKeys.lists() })
      queryClient.invalidateQueries({ queryKey: rolesKeys.details() })
      void refreshUser()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
