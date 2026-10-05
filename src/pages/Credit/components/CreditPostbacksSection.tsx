/**
 * Настройки → Постбеки партнерам (18-13d, CAP-31): подвкладки «Правила» и «Лог».
 *
 * Права — из пропуска CRM, а не из сводки модуля (Р-18-13d-3): сводка требует
 * `credit.loans.read`, которого у маркетолога нет. Видимость вкладки решает
 * страница и передаёт сюда право записи; сервер без права всё равно ответит 403.
 * Без права записи кнопок «Додати правило» и «Змінити» в разметке нет. Лог —
 * под тем же правом чтения (К-1), подвкладка живёт в URL (`pb_view`); на «Правила»
 * фильтры лога (`pb_*`) из ссылки снимаются — невидимыми они в ней не нужны.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SegmentedTabs, segmentedTabId, segmentedTabPanelId } from '@/components/ui/SegmentedTabs'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
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
  const [params, setParams] = useSearchParams()
  const view = params.get('pb_view') === 'log' ? 'log' : 'rules'
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
        onChange={(id) => {
          const next = new URLSearchParams(params)
          if (id === 'rules') FILTER_KEYS.forEach((key) => next.delete(`pb_${key}`))
          next.set('pb_view', id)
          setParams(next, { replace: true })
        }}
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
  const { filters, actionInvalid, rangeInverted, fromInvalid, toInvalid } =
    postbackLogRequest(values)
  // Стек курсоров страниц — в состоянии экрана, не в URL (К-6): курсор живёт
  // одну сессию. Смена фильтров запроса, и сброс тоже, начинает с первой страницы;
  // ввод, который запрос не меняет (недописанный UUID), страницу не сбрасывает (Б-2).
  // Сброс — здесь же, не эффектом: иначе один рендер ушёл бы с новыми фильтрами и
  // старым курсором.
  const [stack, setStack] = useState<string[]>([])
  // Адрес, записанный самим `change`, — чтобы чистка ссылки ниже его не трогала.
  const own = useRef<string | null>(null)
  const change = (patch: Partial<PostbackLogFilterValues>) => {
    const nextFilters = postbackLogRequest({ ...values, ...patch }).filters
    if (JSON.stringify(nextFilters) !== JSON.stringify(filters)) setStack([])
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value?.trim()) next.set(`pb_${key}`, value)
      else next.delete(`pb_${key}`)
    }
    own.current = next.toString()
    setParams(next, { replace: true })
  }
  // Негодная дата ссылки (правленой, пересланной) снимается из адреса один раз —
  // когда адрес пришёл извне. Свою запись из `change` пропускаем: при наборе года
  // браузер шлёт 0002-10-04, 0020-…, и стереть их значит не дать набрать дату (К-2).
  const search = params.toString()
  useEffect(() => {
    if (search === own.current || !(fromInvalid || toInvalid)) return
    const next = new URLSearchParams(search)
    if (fromInvalid) next.delete('pb_from')
    if (toInvalid) next.delete('pb_to')
    setParams(next, { replace: true })
  }, [search, fromInvalid, toInvalid, setParams])

  const rules = useCreditPostbackRules()
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } =
    useCreditPostbackDeliveries(filters, stack.at(-1))
  const forbidden = error instanceof CreditApiError && error.status === 403
  // «За фільтрами нічого» — только если фильтр ушёл в запрос или поле помечено негодным.
  const sent = Object.values(filters).some(Boolean)
  const narrowed = sent || actionInvalid || rangeInverted || fromInvalid || toInvalid
  // 422 при ушедшем фильтре — ответ развёрнутого модуля по делу (фильтр отвергнут),
  // а не «модуль не развёрнут» (Р-18-13d-b2fix-2); без фильтра — как прежде.
  const rejected = sent && error instanceof CreditApiError && error.status === 422
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
        ) : rejected ? (
          <Alert variant="warning">{t('credit.postbacks.log.filterRejected')}</Alert>
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
                : rejected
                  ? t('credit.postbacks.log.filterRejected')
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
