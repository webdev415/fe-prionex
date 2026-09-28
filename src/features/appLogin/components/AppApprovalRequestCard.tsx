import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@/components/ui'

interface AppApprovalRequestCardProps {
  onSubmit: (username: string) => void
  onUsePassword: () => void
  /** The login of the previous request, kept after «Скасувати». */
  initialUsername?: string
}

/**
 * Step 1 of «Увійти через підтвердження в Prionex»: only the login — no
 * password, no Google Authenticator code; the bound phone is the proof.
 */
export function AppApprovalRequestCard({
  onSubmit,
  onUsePassword,
  initialUsername = '',
}: AppApprovalRequestCardProps) {
  const { t } = useTranslation('auth')
  const [username, setUsername] = useState(initialUsername)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = username.trim()
    if (!value) {
      setError(t('appLogin.approval.request.usernameRequired'))
      return
    }
    onSubmit(value)
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
        <h1 className="text-foreground text-2xl font-medium md:text-[30px]">
          {t('appLogin.approval.request.title')}
        </h1>
        <p className="text-muted-foreground mt-1.5 px-2 text-sm font-light sm:mt-2 sm:px-0 sm:text-base">
          {t('appLogin.approval.entry.hint')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4" noValidate>
        <Input
          type="text"
          inputSize="xl"
          label={t('appLogin.approval.request.username') + ':'}
          placeholder={t('appLogin.approval.request.usernamePlaceholder')}
          autoComplete="username"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the only field of this step
          autoFocus
          value={username}
          onChange={(event) => {
            setUsername(event.target.value)
            if (error) setError(null)
          }}
          error={error ?? undefined}
          className="text-sm sm:text-base"
        />

        <Button type="submit" size="xl" className="mt-4 w-full text-sm sm:mt-6 sm:text-base">
          {t('appLogin.approval.request.submit')}
        </Button>

        <button
          type="button"
          onClick={onUsePassword}
          className="text-primary-600 hover:text-primary-700 mt-2 w-full text-center text-xs underline-offset-2 hover:underline sm:text-sm"
        >
          {t('appLogin.approval.usePassword')}
        </button>
      </form>
    </div>
  )
}

export default AppApprovalRequestCard
