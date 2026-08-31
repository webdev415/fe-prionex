/**
 * Полный вывод анкеты заявки — ВСЕ блоки и ВСЕ поля, включая незнакомые.
 *
 * Требование CEO (29.08): «должны быть в заявке все данные заявителя
 * обязательно». Раньше карточка показывала фиксированный набор полей, а
 * остальное молча исчезало: отчество, национальный id, неосновные телефоны,
 * реквизиты — их просто не было на экране.
 *
 * Главная причина рисовать неизвестное под машинным именем: анкету ведёт сайт,
 * и состав блоков растёт. При фиксированном списке НЕВОЗМОЖНО заметить, что
 * поле добавили, а оператор его не видит — узнаём мы об этом от клиента,
 * сказавшего то, чего оператор не видел. Некрасивая подпись `middle_name`
 * лучше отсутствующей строки.
 *
 * Известные поля переводятся, неизвестные показываются как есть — и это видно
 * глазом, что подпись машинная.
 */
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/formatters'
import { formatCreditMoney } from '@/features/credit/api/money'
import type { CreditApplicationDraft } from '@/features/credit/api/types'

/** Поля-суммы: значение в minor units, показываем деньгами. */
const MONEY_FIELDS = new Set([
  'net_amount_minor',
  'amount_minor',
  'requested_amount_minor',
  'balance_current_minor',
])

/** Поля-даты: показываем в локальном формате, а не ISO. */
const DATE_FIELDS = new Set(['birth_date', 'date_of_birth', 'next_payday', 'issued_at'])

/** Значения-перечисления, для которых у нас есть словари. */
const ENUM_NAMESPACE: Record<string, string> = {
  employment_status: 'credit.employment',
  frequency: 'credit.frequency',
  receipt_method: 'credit.receipt',
  kind: 'credit.phoneKind',
}

/**
 * Блоки, которые рисуются ВСЕГДА — даже когда их нет в ответе.
 *
 * Блок, которого нет, раньше просто пропадал с экрана, и оператор не отличал
 * «клиент этого не заполнял» от «мы это не показали». На живых заявках так
 * исчезали income и params у четырнадцати из сорока пяти, personal и phones —
 * у тринадцати. Пустой блок с подписью «Не заповнено» честнее отсутствия.
 */
const ALWAYS_SHOWN_BLOCKS = [
  'personal',
  'address',
  'phones',
  'income',
  'params',
  // Блока `disbursement` нет в ответе НИ У ОДНОЙ заявки, поэтому «Реквізити
  // видачі» исчезали с экрана целиком — тот самый случай, ради которого
  // список и заведён: отсутствие блока должно читаться как «не заповнено»,
  // а не как «такого раздела не бывает».
  'disbursement',
]

/** Порядок показа; неизвестные блоки уйдут в конец как есть. */
const BLOCK_ORDER = [...ALWAYS_SHOWN_BLOCKS, 'banking', 'employment', 'disbursement']

/** Служебное — не поле анкеты, показывать не нужно. */
const HIDDEN_KEYS = new Set(['demo_note'])

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function CreditDraftBlocks({
  draft,
  currency,
}: {
  draft?: CreditApplicationDraft
  currency?: string
}) {
  const source = draft ?? {}
  const present = Object.keys(source).filter((key) => !HIDDEN_KEYS.has(key))
  const keys = [...new Set([...ALWAYS_SHOWN_BLOCKS, ...present])]
  const ordered = [
    ...BLOCK_ORDER.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !BLOCK_ORDER.includes(key)),
  ]

  return (
    <>
      {ordered.map((blockKey) => (
        <DraftBlock
          key={blockKey}
          blockKey={blockKey}
          value={source[blockKey]}
          currency={currency}
        />
      ))}
    </>
  )
}

function DraftBlock({
  blockKey,
  value,
  currency,
}: {
  blockKey: string
  value: unknown
  currency?: string
}) {
  const { t } = useTranslation('common')
  const title = t(`credit.blocks.${blockKey}`, blockKey)

  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h3 className="border-border flex min-h-[49px] items-center gap-2 border-b px-4 text-sm font-semibold">
        {title}
        {/* Машинное имя блока видно рядом — оператор понимает, что перевода
            для него ещё нет, и может назвать поле разработчику. */}
        {title === blockKey && (
          <span className="text-muted-foreground font-mono text-xs">{blockKey}</span>
        )}
      </h3>
      <div className="p-4">
        <BlockBody blockKey={blockKey} value={value} currency={currency} />
      </div>
    </section>
  )
}

function BlockBody({
  blockKey,
  value,
  currency,
}: {
  blockKey: string
  value: unknown
  currency?: string
}) {
  const { t } = useTranslation('common')

  if (isEmpty(value)) {
    return <p className="text-warning-800 text-sm">{t('credit.card.blockNotFilled')}</p>
  }

  // Блок-список (телефоны, адреса): каждая запись — своя группа строк.
  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div key={index} className="border-border rounded-md border p-3">
            <FieldRows record={item} blockKey={blockKey} currency={currency} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    // Блок вида `{items: [...]}` — разворачиваем список, а не рисуем «items».
    const listKey = Object.keys(record).find((key) => Array.isArray(record[key]))
    if (listKey && Object.keys(record).length === 1) {
      return <BlockBody blockKey={blockKey} value={record[listKey]} currency={currency} />
    }
    return <FieldRows record={record} blockKey={blockKey} currency={currency} />
  }

  return <FieldValue fieldKey={blockKey} value={value} currency={currency} />
}

function FieldRows({
  record,
  blockKey,
  currency,
}: {
  record: unknown
  blockKey: string
  currency?: string
}) {
  const { t } = useTranslation('common')
  if (!record || typeof record !== 'object') {
    return <FieldValue fieldKey={blockKey} value={record} currency={currency} />
  }
  const entries = Object.entries(record as Record<string, unknown>)
  if (entries.length === 0) {
    return <p className="text-warning-800 text-sm">{t('credit.card.blockNotFilled')}</p>
  }

  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
      {entries.map(([key, value]) => {
        const label = t(`credit.draftFields.${key}`, key)
        const unknown = label === key
        return (
          <div key={key} className="contents">
            <dt
              className={
                unknown ? 'text-muted-foreground font-mono text-xs' : 'text-muted-foreground'
              }
            >
              {label}
            </dt>
            <dd className="m-0 break-words">
              <FieldValue fieldKey={key} value={value} currency={currency} />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function FieldValue({
  fieldKey,
  value,
  currency,
}: {
  fieldKey: string
  value: unknown
  currency?: string
}) {
  const { t } = useTranslation('common')

  if (isEmpty(value)) {
    return <span className="text-warning-800">{t('credit.card.notFilled')}</span>
  }
  if (typeof value === 'boolean') {
    return <>{value ? t('common.yes', 'Так') : t('common.no', 'Ні')}</>
  }
  if (Array.isArray(value)) {
    // Массив дат — самый частый случай (зарплатные даты).
    if (value.every((item) => typeof item === 'string')) {
      const looksLikeDates = value.every((item) => /^\d{4}-\d{2}-\d{2}/.test(String(item)))
      return (
        <>{value.map((item) => (looksLikeDates ? formatDate(String(item)) : item)).join(', ')}</>
      )
    }
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="border-border rounded-md border p-2">
            <FieldRows record={item} blockKey={fieldKey} currency={currency} />
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'object') {
    return <FieldRows record={value} blockKey={fieldKey} currency={currency} />
  }

  if (typeof value === 'number' && MONEY_FIELDS.has(fieldKey)) {
    return <>{formatCreditMoney(value, currency)}</>
  }
  if (typeof value === 'string' && DATE_FIELDS.has(fieldKey)) {
    return <>{formatDate(value)}</>
  }
  const namespace = ENUM_NAMESPACE[fieldKey]
  if (namespace && typeof value === 'string') {
    return <>{t(`${namespace}.${value}`, value)}</>
  }
  return <>{String(value)}</>
}

export default CreditDraftBlocks
