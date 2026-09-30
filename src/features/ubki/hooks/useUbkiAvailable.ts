import { activeProjectIsUkrainian } from '@/lib/projectCountry'
import { useAuthStore } from '@/stores/authStore'

export function useUbkiAvailable(): boolean {
  return useAuthStore((s) => activeProjectIsUkrainian(s.user))
}
