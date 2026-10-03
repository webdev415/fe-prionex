/**
 * Настройки → Постбеки партнерам (18-13d, CAP-31).
 *
 * Права — из пропуска CRM, а не из сводки модуля (Р-18-13d-3): сводка требует
 * `credit.loans.read`, которого у маркетолога нет. Видимость вкладки решает
 * страница и передаёт сюда право записи; сервер без права всё равно ответит 403.
 * Без права записи кнопок «Додати правило» и «Змінити» в разметке нет.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { CreditApiError } from '@/features/credit/api/creditApi'
import type { CreditPostbackRule } from '@/features/credit/api/postbacks'
import { useCreditPostbackRules } from '@/features/credit/hooks/useCreditPostbacks'
import { CreditModuleUnavailable } from './CreditModuleUnavailable'
import { CreditPostbackRuleForm } from './CreditPostbackRuleForm'
import { CreditPostbackRulesTable } from './CreditPostbackRulesTable'

export function CreditPostbacksSection({ canWrite }: { canWrite: boolean }) {
  const { t } = useTranslation('common')
  const { data, isLoading, error } = useCreditPostbackRules()
  // Форма монтируется на каждое открытие: новое открытие — новый ключ создания.
  const [editing, setEditing] = useState<CreditPostbackRule | 'new' | null>(null)
  // 409 правки: форма закрыта, таблица называет правило; снимается следующим действием.
  const [conflict, setConflict] = useState<string>()
  const open = (target: CreditPostbackRule | 'new') => {
    setConflict(undefined)
    setEditing(target)
  }

  // Колонки таблицы: восемь у всех и «Дії» у держателя права записи.
  if (isLoading) return <TableSkeleton columns={canWrite ? 9 : 8} />
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
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => open('new')}>
            {t('credit.postbacks.form.add')}
          </Button>
        </div>
      )}
      <CreditPostbackRulesTable
        rules={data?.items ?? []}
        canWrite={canWrite}
        onEdit={open}
        conflict={conflict}
        onAction={() => setConflict(undefined)}
      />
      {canWrite && editing && data && (
        <CreditPostbackRuleForm
          rule={editing === 'new' ? undefined : editing}
          list={data}
          onClose={() => setEditing(null)}
          onConflict={(name) => {
            setConflict(name)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

export default CreditPostbacksSection
