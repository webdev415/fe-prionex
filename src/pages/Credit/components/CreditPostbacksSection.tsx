/**
 * Настройки → Постбеки партнерам (18-13d, CAP-31): подвкладки «Правила» и «Лог».
 *
 * Права — из пропуска CRM, а не из сводки модуля (Р-18-13d-3): сводка требует
 * `credit.loans.read`, которого у маркетолога нет. Видимость вкладки решает
 * страница и передаёт сюда право записи; сервер без права всё равно ответит 403.
 * Без права записи кнопок «Додати правило» и «Змінити» в разметке нет. Лог —
 * под тем же правом чтения (К-1), подвкладка живёт в URL (`pb_view`).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SegmentedTabs, segmentedTabId, segmentedTabPanelId } from '@/components/ui/SegmentedTabs'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useURLState } from '@/hooks/useURLState'
import { CreditApiError } from '@/features/credit/api/creditApi'
import {
  POSTBACK_LOG_FILTER_KEYS as FILTER_KEYS,
  postbackLogRequest,
  type CreditPostbackRule,
  type PostbackLogFilterValues,
} from '@/features/credit/api/postbacks'
import {
  useCreditPostbackDeliveries,
  useCreditPostbackRules,
} from '@/features/credit/hooks/useCreditPostbacks'
import { CreditModuleUnavailable } from './CreditModuleUnavailable'
import { CreditPostbackDeliveriesFilters } from './CreditPostbackDeliveriesFilters'
import { CreditPostbackDeliveriesTable } from './CreditPostbackDeliveriesTable'
import { CreditPostbackRuleForm } from './CreditPostbackRuleForm'
import { CreditPostbackRulesTable } from './CreditPostbackRulesTable'

export function CreditPostbacksSection({ canWrite }: { canWrite: boolean }) {
  const { t } = useTranslation('common')
  const [viewParam, setView] = useURLState<string>('pb_view', 'rules')
  const view = viewParam === 'log' ? 'log' : 'rules'
  return (
    <>
      <SegmentedTabs
        idPrefix="credit-postbacks"
        className="mb-3"
        ariaLabel={t('credit.settings.tabs.postbacks')}
        activation="manual"
        items={[
          { id: 'rules' as const, label: t('credit.postbacks.log.tabs.rules') },
          { id: 'log' as const, label: t('credit.postbacks.log.tabs.log') },
        ]}
        value={view}
        onChange={setView}
      />
      <div
        role="tabpanel"
        id={segmentedTabPanelId('credit-postbacks', view)}
        aria-labelledby={segmentedTabId('credit-postbacks', view)}
      >
        {view === 'log' ? <PostbackLogView /> : <PostbackRulesView canWrite={canWrite} />}
      </div>
    </>
  )
}

function PostbackRulesView({ canWrite }: { canWrite: boolean }) {
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

function PostbackLogView() {
  const { t } = useTranslation('common')
  // Фильтры живут в ссылке (`pb_*`): её можно переслать, и она переживает перезагрузку.
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, params.get(`pb_${key}`) ?? ''])
  ) as PostbackLogFilterValues
  const { filters, actionInvalid, rangeInverted } = postbackLogRequest(values)
  // Стек курсоров страниц — в состоянии экрана, не в URL (К-6): курсор живёт
  // одну сессию. Любая смена фильтров, и сброс тоже, начинает с первой страницы.
  const [stack, setStack] = useState<string[]>([])
  const change = (patch: Partial<PostbackLogFilterValues>) => {
    setStack([])
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(patch)) {
          if (value?.trim()) next.set(`pb_${key}`, value)
          else next.delete(`pb_${key}`)
        }
        return next
      },
      { replace: true }
    )
  }

  const rules = useCreditPostbackRules()
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } =
    useCreditPostbackDeliveries(filters, stack.at(-1))
  const forbidden = error instanceof CreditApiError && error.status === 403
  // «За фільтрами нічого» — только если фильтр ушёл в запрос или поле помечено негодным.
  const narrowed = Object.values(filters).some(Boolean) || actionInvalid || rangeInverted
  const pageButton = (label: string, disabled: boolean, cursors: string[]) => (
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => setStack(cursors)}>
      {label}
    </Button>
  )

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t('credit.postbacks.log.helper')}</p>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
          {t('credit.postbacks.log.refresh')}
        </Button>
      </div>
      <CreditPostbackDeliveriesFilters
        values={values}
        rules={rules.data?.items ?? []}
        onChange={change}
        onReset={() => change(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))}
      />
      {isLoading ? (
        <TableSkeleton columns={8} />
      ) : error && !data ? (
        forbidden ? (
          <Alert variant="warning">{t('credit.postbacks.forbidden')}</Alert>
        ) : (
          <CreditModuleUnavailable error={error} />
        )
      ) : (
        <>
          {/* Упала перечитка (кнопка, возврат на вкладку): страница на руках остаётся. */}
          {error && (
            <Alert variant="warning" className="mb-3">
              {forbidden
                ? t('credit.postbacks.forbidden')
                : t('credit.postbacks.log.refreshFailed')}
            </Alert>
          )}
          <CreditPostbackDeliveriesTable
            items={data?.items ?? []}
            rules={rules.data?.items}
            emptyMessage={
              narrowed ? t('credit.postbacks.log.emptyFiltered') : t('credit.postbacks.log.empty')
            }
          />
        </>
      )}
      {/* Вне состояний: после сбоя страницы по курсору «Назад» ведёт на прежнюю. */}
      <div className="mt-3 flex items-center justify-end gap-2">
        {pageButton(t('credit.postbacks.log.prev'), stack.length === 0, stack.slice(0, -1))}
        {pageButton(
          t('credit.postbacks.log.next'),
          !data?.next_cursor || isPlaceholderData || Boolean(error),
          [...stack, data?.next_cursor ?? '']
        )}
      </div>
    </>
  )
}

export default CreditPostbacksSection
