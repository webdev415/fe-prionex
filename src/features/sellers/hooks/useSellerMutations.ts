/**
 * Seller Mutation Hooks
 *
 * React Query mutation hooks for seller CRUD operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import { sellersApi } from '../api/sellersApi'
import { sellersKeys } from './useSellers'
import { getErrorMessage } from '@/lib/errors'
import type { CreateSellerInput, UpdateSellerInput } from '../types'

/**
 * Hook to create a new seller
 */
export function useCreateSeller() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateSellerInput) => sellersApi.createSeller(data),
    onSuccess: () => {
      toast.success(
        i18n.t('toasts.sellers.created', { defaultValue: 'Seller created successfully' })
      )
      queryClient.invalidateQueries({ queryKey: sellersKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to update an existing seller
 */
export function useUpdateSeller() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSellerInput }) =>
      sellersApi.updateSeller(id, data),
    onSuccess: (_, variables) => {
      toast.success(
        i18n.t('toasts.sellers.updated', { defaultValue: 'Seller updated successfully' })
      )
      queryClient.invalidateQueries({ queryKey: sellersKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: sellersKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to delete a seller (soft delete)
 */
export function useDeleteSeller() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sellerId }: { sellerId: number }) => sellersApi.deleteSeller(sellerId),
    onSuccess: () => {
      toast.success(
        i18n.t('toasts.sellers.deactivated', { defaultValue: 'Seller deactivated successfully' })
      )
      queryClient.invalidateQueries({ queryKey: sellersKeys.lists() })
    },
    onError: (error) => {
      const errorMessage = getErrorMessage(error)
      // Handle 409 conflict when seller has active debts
      if (error instanceof AxiosError && error.response?.status === 409) {
        toast.error(errorMessage || 'Cannot delete seller with active debts')
        return
      }
      toast.error(errorMessage)
    },
  })
}
