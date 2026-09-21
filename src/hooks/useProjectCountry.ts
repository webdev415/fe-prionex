import { activeProjectCountry, type Country } from '@/lib/projectCountry'
import { useAuthStore } from '@/stores/authStore'

export function useProjectCountry(): Country {
  return useAuthStore((s) => activeProjectCountry(s.user))
}
