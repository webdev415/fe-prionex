import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCoefficientRange,
  deleteCoefficientRange,
  listCoefficientRanges,
  updateCoefficientRange,
  type LoanCoefficientRangeInput,
} from '../api/loanCoefficientRangesApi'

export const loanCoefficientRangeKeys = {
  all: ['loan-coefficient-ranges'] as const,
  list: () => [...loanCoefficientRangeKeys.all, 'list'] as const,
}

export function useLoanCoefficientRanges() {
  return useQuery({
    queryKey: loanCoefficientRangeKeys.list(),
    queryFn: listCoefficientRanges,
    staleTime: 30_000,
  })
}

export function useCreateCoefficientRange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoanCoefficientRangeInput) => createCoefficientRange(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanCoefficientRangeKeys.all })
    },
  })
}

export function useUpdateCoefficientRange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: LoanCoefficientRangeInput }) =>
      updateCoefficientRange(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanCoefficientRangeKeys.all })
    },
  })
}

export function useDeleteCoefficientRange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCoefficientRange(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanCoefficientRangeKeys.all })
    },
  })
}
