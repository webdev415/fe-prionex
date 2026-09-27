import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface AppApprovalEntryProps {
  onClick: () => void
  disabled?: boolean
}

/**
 * «або» + «Увійти через підтвердження в Prionex» under the password form. The
 * login page renders it only when `GET /api/v1/auth/app-login/config` answered
 * `passwordless: true`.
 */
export function AppApprovalEntry({ onClick, disabled = false }: AppApprovalEntryProps) {
  const { t } = useTranslation('auth')

  return (
    <div className="mt-4 flex flex-col gap-3 sm:mt-6">
      <div className="text-muted-foreground flex items-center gap-3 text-xs sm:text-sm">
        <span className="bg-border h-px flex-1" aria-hidden="true" />
        <span>{t('appLogin.approval.entry.or')}</span>
        <span className="bg-border h-px flex-1" aria-hidden="true" />
      </div>
      <Button
        type="button"
        variant="white-secondary"
        size="xl"
        // The Ukrainian label is long: let it wrap on a narrow phone screen
        // instead of running out of the button.
        className="h-auto min-h-[45px] w-full gap-2 py-2 text-sm whitespace-normal sm:text-base"
        onClick={onClick}
        disabled={disabled}
        aria-describedby="app-approval-entry-hint"
      >
        <Icons.Phone size={18} className="shrink-0" />
        <span>{t('appLogin.approval.entry.button')}</span>
      </Button>
      <p id="app-approval-entry-hint" className="text-muted-foreground text-center text-xs">
        {t('appLogin.approval.entry.hint')}
      </p>
    </div>
  )
}

export default AppApprovalEntry
