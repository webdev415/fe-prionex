import { useQuery } from '@tanstack/react-query'
import { getTimeline } from '../api/operatorAnalyticsService'

export const timelineKeys = {
  all: ['operator-analytics', 'timeline'] as const,
  forCall: (callId: string) => [...timelineKeys.all, callId] as const,
}

export function useTimeline(callId: string | null | undefined, enabled = true) {
  const isReady = Boolean(callId) && enabled
  return useQuery({
    queryKey: timelineKeys.forCall(callId ?? ''),
    queryFn: () => getTimeline({ call_id: callId as string }),
    enabled: isReady,
    staleTime: 30_000,
  })
}
