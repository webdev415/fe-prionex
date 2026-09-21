import { useQuery } from '@tanstack/react-query'

import { dialerService } from '../api/dialerService'
import type { DialerCallingWindow } from '../types'

// Polled because the window opens and closes during a shift; a banner that was
// right at 20:40 is wrong at 20:46.
const POLL_INTERVAL_MS = 60_000

export function useDialerCallingWindow() {
  return useQuery<DialerCallingWindow>({
    queryKey: ['dialerCallingWindow'],
    queryFn: () => dialerService.getCallingWindow(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}
