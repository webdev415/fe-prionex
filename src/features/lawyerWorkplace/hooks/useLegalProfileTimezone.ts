import { useAuthStore } from '@/stores/authStore'
import { LEGAL_DEFAULT_TIMEZONE, resolveLegalTimezone } from '../utils/legalDueDate'

/** Profile timezone for legal calendar-day semantics (fallback Europe/Kyiv). */
export function useLegalProfileTimezone(): string {
  const timezone = useAuthStore((state) => state.user?.timezone)
  return resolveLegalTimezone(timezone ?? LEGAL_DEFAULT_TIMEZONE)
}
