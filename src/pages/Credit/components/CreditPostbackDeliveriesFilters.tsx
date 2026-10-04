/**
 * Фильтры лога постбеков (18-13d-b, К-2): правило, исход, триггер, ID действия,
 * период. Все — серверные (Р-18-13d-10): значения уходят параметрами двери, строки
 * страницы на клиенте не отбираются. Состояние держит секция (в URL, `pb_*`).
 * Период — сутки UTC, как считает дверь (К-8), и это подписано у полей.
 *
 * Подпись связана с полем по `id`: внутри `<label>` её текст смешался бы с
 * вариантами списка.
 */
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CREDIT_POSTBACK_OUTCOMES } from '@/features/credit/api/postbackEnums'
import {
  CREDIT_POSTBACK_TRIGGERS,
  postbackLogRequest,
  type CreditPostbackRule,
  type PostbackLogFilterValues,
} from '@/features/credit/api/postbacks'

type Key = keyof PostbackLogFilterValues

// Предел годных суток, как в `postbackLogRequest` (Р-18-13d-b2fix-1): календарь
// не даст выбрать дату, которую запрос всё равно отбросит.
const FIRST_DAY = '2000-01-01'
const LAST_DAY = '2100-12-31'

export function CreditPostbackDeliveriesFilters({
  values,
  rules,
  onChange,
  onReset,
}: {
  values: PostbackLogFilterValues
  rules: CreditPostbackRule[]
  onChange: (patch: Partial<PostbackLogFilterValues>) => void
  onReset: () => void
}) {
  const { t } = useTranslation('common')
  const id = useId()
  // Недописанный UUID и перевёрнутый период в запрос не ушли — поля это показывают.
  const { filters, actionInvalid, rangeInverted, from, to } = postbackLogRequest(values)
  const field = (key: Key, label: string, control: ReactNode) => (
    <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
      <label htmlFor={`${id}-${key}`}>{label}</label>
      {control}
    </div>
  )
  const choice = (key: Key, label: string, options: Array<[string, string]>) =>
    field(
      key,
      label,
      <select
        id={`${id}-${key}`}
        className="border-input-border bg-card text-foreground h-10 rounded-md border px-3 text-sm"
        value={values[key]}
        onChange={(event) => onChange({ [key]: event.target.value })}
      >
        <option value="">{t('credit.postbacks.log.filters.all')}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    )
  const text = (key: Key, label: string, props: Record<string, unknown>) =>
    field(
      key,
      label,
      <Input
        id={`${id}-${key}`}
        value={values[key]}
        onChange={(event) => onChange({ [key]: event.target.value })}
        {...props}
      />
    )
  const range = { type: 'date', 'aria-invalid': rangeInverted, 'aria-describedby': `${id}-range` }
  const ruleOptions = rules.map((rule): [string, string] => [rule.id, rule.name])
  // Правило из ссылки, которого нет в списке (удалено), остаётся выбранным своим ID;
  // негодный ID (не UUID) в запрос не ушёл — и вариантом не показывается.
  if (filters.rule_id && !rules.some((rule) => rule.id === filters.rule_id)) {
    ruleOptions.push([filters.rule_id, filters.rule_id])
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      {choice('rule', t('credit.postbacks.log.filters.rule'), ruleOptions)}
      {choice(
        'outcome',
        t('credit.postbacks.log.filters.outcome'),
        CREDIT_POSTBACK_OUTCOMES.map((code) => [code, t(`credit.postbacks.outcome.${code}`)])
      )}
      {choice(
        'trigger',
        t('credit.postbacks.log.filters.trigger'),
        CREDIT_POSTBACK_TRIGGERS.map((code) => [code, t(`credit.postbacks.trigger.${code}`)])
      )}
      {text('action', t('credit.postbacks.log.filters.action'), {
        'aria-invalid': actionInvalid,
        'aria-describedby': actionInvalid ? `${id}-action-hint` : undefined,
      })}
      {text('from', t('credit.postbacks.log.filters.from'), {
        ...range,
        min: FIRST_DAY,
        max: to || LAST_DAY,
      })}
      {text('to', t('credit.postbacks.log.filters.to'), {
        ...range,
        min: from || FIRST_DAY,
        max: LAST_DAY,
      })}
      <Button type="button" variant="ghost" onClick={onReset}>
        {t('credit.postbacks.log.filters.reset')}
      </Button>
      <p id={`${id}-range`} className="text-muted-foreground w-full text-xs">
        {rangeInverted
          ? t('credit.postbacks.log.filters.inverted')
          : t('credit.postbacks.log.filters.utc')}
      </p>
      {actionInvalid && (
        <p id={`${id}-action-hint`} className="text-error-500 w-full text-xs" role="alert">
          {t('credit.postbacks.log.filters.actionInvalid')}
        </p>
      )}
    </div>
  )
}
