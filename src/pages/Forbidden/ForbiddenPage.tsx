import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

export function ForbiddenPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="border-border bg-card/50 rounded-xl border p-8 text-center shadow-sm">
        <Icons.Lock className="text-error-500 mx-auto mb-4 h-12 w-12" strokeWidth={1.5} />
        <h2 className="text-foreground mb-2 text-xl font-semibold">
          {t('pages.forbidden.title', 'Access Denied')}
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md text-sm font-light">
          {t(
            'pages.forbidden.message',
            "You don't have permission to access this page. Contact your administrator if you believe this is a mistake."
          )}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" size="md" onClick={() => navigate(-1)}>
            {t('pages.forbidden.goBack', 'Go Back')}
          </Button>
          <Button variant="outline" size="md" onClick={() => navigate('/dashboard')}>
            {t('pages.forbidden.goHome', 'Go to Dashboard')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ForbiddenPage
