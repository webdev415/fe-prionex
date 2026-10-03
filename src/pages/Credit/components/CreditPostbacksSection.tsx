/**
 * Настройки → Постбеки партнерам (18-13d, CAP-31).
 *
 * Права — из пропуска CRM, а не из сводки модуля (Р-18-13d-3): сводка требует
 * `credit.loans.read`, которого у маркетолога нет. Видимость вкладки решает
 * страница и передаёт сюда право записи; сервер без права всё равно ответит 403.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { useCreditPostbackRules } from '@/features/credit/hooks/useCreditPostbacks'
import { CreditModuleUnavailable } from './CreditModuleUnavailable'
import { CreditPostbackRulesTable } from './CreditPostbackRulesTable'

export function CreditPostbacksSection({ canWrite }: { canWrite: boolean }) {
  const { t } = useTranslation('common')
  const { data, isLoading, error } = useCreditPostbackRules()

  if (isLoading) return <TableSkeleton columns={8} />
  // 403 — ответ по делу (права не выдали), а не поломка модуля.
  const forbidden = error instanceof CreditApiError && error.status === 403
  if (error && !data) {
    return forbidden ? (
      <Alert variant="warning">{t('credit.postbacks.forbidden')}</Alert>
    ) : (
      <CreditModuleUnavailable error={error} />
    )
  }
  return (
    <>
      <p className="text-muted-foreground mb-3 text-sm">{t('credit.postbacks.helper')}</p>
      {/* Упала фоновая перечитка (после вкл/выкл или удаления): список на руках не прячем. */}
      {error && (
        <Alert variant="warning" className="mb-3">
          {forbidden ? t('credit.postbacks.forbidden') : t('credit.postbacks.refreshFailed')}
        </Alert>
      )}
      <CreditPostbackRulesTable rules={data?.items ?? []} canWrite={canWrite} />
    </>
  )
}

export default CreditPostbacksSection
