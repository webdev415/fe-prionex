/**
 * Настройки → Настройки модуля.
 *
 * Реестр параметров decision-engine: пороги допуска, лимиты, cooldown'ы. Это
 * ДАННЫЕ, а не код — правила решения читают их из реестра, поэтому здесь видно
 * ровно то, по чему сейчас принимаются решения.
 *
 * Только чтение, и это не временное упрощение: по UW-04 изменение параметра
 * требует второго утверждающего, а института утверждающих до ролей CRM
 * (WS-20) не существует. Форма правки без него была бы бесконтрольной правкой
 * боевых порогов.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { useCreditParameters } from '@/features/credit/hooks/useCredit'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { formatDateTime } from '@/lib/formatters'

export function CreditParametersSection({ canRead }: { canRead: boolean }) {
  const { t } = useTranslation('common')
  const { data, isLoading, error } = useCreditParameters(canRead)

  if (!canRead) {
    return <Alert variant="info">{t('credit.settings.needRiskManager')}</Alert>
  }
  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{t('common.loading', 'Загрузка…')}</p>
  }
  if (error) {
    return <Alert variant="error">{(error as CreditApiError).message}</Alert>
  }

  const parameters = data?.items ?? []

  return (
    <>
      <Alert variant="warning" className="mb-4">
        {t('credit.settings.parametersReadonly')}
      </Alert>

      {parameters.map((parameter) => (
        <section
          key={parameter.code}
          className="border-border bg-card mb-3 rounded-xl border p-4 shadow-sm"
        >
          <div className="mb-1 flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-sm font-medium">{parameter.code}</span>
            <span className="text-muted-foreground text-xs">
              {t('credit.settings.updatedAt', { at: formatDateTime(parameter.updated_at) })}
            </span>
          </div>
          {parameter.description && (
            <p className="text-muted-foreground mb-2 text-xs">{parameter.description}</p>
          )}
          <pre className="bg-secondary-900 max-h-72 overflow-auto rounded-md p-3 font-mono text-[11px] text-white">
            {JSON.stringify(parameter.value, null, 2)}
          </pre>
        </section>
      ))}

      {parameters.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('credit.settings.noParameters')}</p>
      )}

      <p className="text-muted-foreground mt-4 text-xs">{t('credit.settings.historyPending')}</p>
    </>
  )
}

export default CreditParametersSection
