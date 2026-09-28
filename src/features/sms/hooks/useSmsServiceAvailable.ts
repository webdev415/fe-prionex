import { activeProjectCountry } from '@/lib/projectCountry'
import { useAuthStore } from '@/stores/authStore'

export function useSmsServiceAvailable(): boolean {
  return useAuthStore((s) => activeProjectCountry(s.user) === 'UA')
}
