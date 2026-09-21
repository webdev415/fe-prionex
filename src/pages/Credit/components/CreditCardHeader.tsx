/**
 * Единая шапка карточки сущности кредитного модуля.
 *
 * Заявка и кредит — разные сущности, но оператор работает с ними одинаково,
 * поэтому и открываются они одинаково: возврат к списку → название с номером и
 * статусом → строка идентификации (кто это) → ряд плиток с главными цифрами →
 * предупреждения → вкладки. Раньше у кредита ключевые цифры шли текстовой
 * строкой, а у заявки их не было вовсе, и две карточки читались как из разных
 * систем.
 *
 * Плитки — тот же визуальный язык, что у счётчиков над списками: оператор уже
 * знает, что крупное число в рамке — это показатель, а не подпись.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'

export interface CreditHeaderMetric {
  key: string
  label: string
  value: string
  /** Второй строкой мелким шрифтом — дата платежа, валюта, уточнение. */
  hint?: string
  tone?: 'default' | 'ok' | 'warn' | 'danger'
}

const TONE_CLASS: Record<string, string> = {
  default: 'text-foreground',
  ok: 'text-success-700',
  warn: 'text-warning-800',
  danger: 'text-error-700',
}

/**
 * Копирование значения одной кнопкой.
 *
 * Экспортируется, потому что нужна не только шапке: ключи операции рельса
 * (`provider_tx_id`, `client_transaction_id`) оператор диктует в поддержку
 * провайдера, и набирать 40 символов руками он будет с ошибкой.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-muted-foreground hover:text-foreground inline-flex items-center"
    >
      {copied ? <Icons.CheckmarkBadge02 size={15} /> : <Icons.Copy size={15} />}
    </button>
  )
}

export function CreditCardHeader({
  backTo,
  backLabel,
  title,
  copyValue,
  badge,
  subtitle,
  identity,
  metrics,
  notices,
}: {
  backTo: string
  backLabel: string
  title: string
  copyValue?: string
  badge: React.ReactNode
  /** Код продукта и прочее, что уточняет заголовок. */
  subtitle?: React.ReactNode
  /** Строка «кто это»: клиент с контактами или даты жизни заявки. */
  identity?: React.ReactNode
  metrics: CreditHeaderMetric[]
  notices?: React.ReactNode
}) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-sm"
      >
        <Icons.ArrowLeft size={16} />
        {backLabel}
      </button>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-foreground text-xl font-semibold">{title}</h1>
        {copyValue && <CopyButton value={copyValue} label={t('credit.actions.copy')} />}
        {badge}
        {subtitle && <span className="text-muted-foreground text-sm">{subtitle}</span>}
      </div>

      {identity && (
        <div className="text-muted-foreground mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {identity}
        </div>
      )}

      {metrics.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {metrics.map((metric) => (
            <div
              key={metric.key}
              className="border-border bg-card min-w-[150px] rounded-lg border px-4 py-2.5"
            >
              <div className="text-muted-foreground text-xs">{metric.label}</div>
              <div
                className={`text-lg font-semibold tabular-nums ${TONE_CLASS[metric.tone ?? 'default']}`}
              >
                {metric.value}
              </div>
              {metric.hint && <div className="text-muted-foreground text-xs">{metric.hint}</div>}
            </div>
          ))}
        </div>
      )}

      {notices}
    </>
  )
}

/**
 * Предупреждение в светлой палитре раздела.
 *
 * `Alert variant="warning"` в CRM залит `warning-950` — почти чёрным: компонент
 * рассчитан на тёмный фон и среди светлых панелей раздела читается как дыра.
 * Берём тот же словарь токенов CRM, но светлую ступень — ровно как это делают
 * страницы тегов (`bg-warning-100 text-warning-800`). Ошибки оставляем на
 * штатном `Alert variant="error"`: он в CRM уже светлый.
 */
export function CreditNotice({
  tone = 'warn',
  children,
  className,
}: {
  tone?: 'warn' | 'info' | 'ok'
  children: React.ReactNode
  className?: string
}) {
  const toneClass = {
    warn: 'bg-warning-100 text-warning-800',
    info: 'bg-information-100 text-information-700',
    ok: 'bg-success-100 text-success-700',
  }[tone]
  return (
    <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toneClass} ${className ?? ''}`}>
      {children}
    </div>
  )
}

export default CreditCardHeader
