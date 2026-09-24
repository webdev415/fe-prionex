import { activeProjectCountry } from '@/lib/projectCountry'
import { useAuthStore } from '@/stores/authStore'

export function useUbkiAvailable(): boolean {
  return useAuthStore((s) => activeProjectCountry(s.user) === 'UA')
}
