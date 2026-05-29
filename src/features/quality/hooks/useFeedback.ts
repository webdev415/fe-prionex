import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFeedback,
  exportFeedback,
  getFeedback,
  listFeedback,
  markFeedbackCompleted,
  markFeedbackRead,
  replyToFeedback,
} from '../api/qualityService'
import type { FeedbackCreatePayload, FeedbackListFilters } from '../types'

export const feedbackKeys = {
  all: ['quality', 'feedback'] as const,
  list: (filters: FeedbackListFilters) => [...feedbackKeys.all, 'list', filters] as const,
  detail: (feedbackId: number) => [...feedbackKeys.all, 'detail', feedbackId] as const,
}

export function useFeedback(filters: FeedbackListFilters, enabled = true) {
  return useQuery({
    queryKey: feedbackKeys.list(filters),
    queryFn: () => listFeedback(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useFeedbackDetail(feedbackId: number | null, enabled = true) {
  return useQuery({
    queryKey:
      feedbackId == null
        ? ['quality', 'feedback', 'detail', 'pending']
        : feedbackKeys.detail(feedbackId),
    queryFn: () => getFeedback(feedbackId as number),
    enabled: enabled && feedbackId != null,
    staleTime: 10_000,
  })
}

export function useCreateFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: FeedbackCreatePayload) => createFeedback(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all })
    },
  })
}

export function useReplyToFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ feedbackId, text }: { feedbackId: number; text: string }) =>
      replyToFeedback(feedbackId, text),
    onSuccess: (_reply, vars) => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.detail(vars.feedbackId) })
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all })
    },
  })
}

export function useMarkFeedbackRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (feedbackId: number) => markFeedbackRead(feedbackId),
    onSuccess: (updated) => {
      queryClient.setQueryData(feedbackKeys.detail(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all })
    },
  })
}

export function useMarkFeedbackCompleted() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (feedbackId: number) => markFeedbackCompleted(feedbackId),
    onSuccess: (updated) => {
      queryClient.setQueryData(feedbackKeys.detail(updated.id), updated)
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all })
    },
  })
}

export function useExportFeedback() {
  return useMutation({
    mutationFn: (filters: FeedbackListFilters) => exportFeedback(filters),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `feedback-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
  })
}
