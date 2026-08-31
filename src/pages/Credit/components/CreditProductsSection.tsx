/**
 * Настройки → Кредитные продукты.
 *
 * Каталог продуктов с версиями: что именно продаём, по какой цене и какая
 * версия активна. Просмотр — по контракту (`listInternalProducts`).
 *
 * Кнопки создания/правки показаны намеренно, но выключены: операции есть в
 * контракте (`createProduct`, `createProductVersion`, `validateProductVersion`,
 * `activateProductVersion`), а в сервисе их нет — и появятся они не раньше,
 * чем будет кому утверждать изменение (UW-04, WS-20). Скрыть их означало бы
 * спрятать от риск-менеджера часть его работы; показать активными — соврать.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { useCreditProducts } from '@/features/credit/hooks/useCredit'
import { CreditApiError } from '@/features/credit/api/creditApi'
import type { CreditProduct } from '@/features/credit/api/types'

/** Параметры продукта, которые риск-менеджер читает чаще всего — вперёд. */
const KEY_PARAMS = [
  'amount_min_minor',
  'amount_max_minor',
  'amount_step_minor',
  'term_days_min',
  'term_days_max',
  'fee_per_100',
  'default_interest_monthly_pct',
  'nsf_fee_minor',
  'rollover_allowed',
  'regulatory_package_version',
]

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function DisabledAction({ label, reason }: { label: string; reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span — чтобы тултип ловил наведение на выключенной кнопке */}
        <span className="inline-block">
          <Button size="sm" variant="white-secondary" disabled>
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}

export function CreditProductsSection({ canRead }: { canRead: boolean }) {
  const { t } = useTranslation('common')
  const { data, isLoading, error } = useCreditProducts(canRead)
  const [openCode, setOpenCode] = useState<string | null>(null)

  if (!canRead) {
    return <Alert variant="info">{t('credit.settings.needRiskManager')}</Alert>
  }
  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{t('common.loading', 'Загрузка…')}</p>
  }
  if (error) {
    return <Alert variant="error">{(error as CreditApiError).message}</Alert>
  }

  const products = data?.items ?? []
  const reason = t('credit.settings.mutationDisabled')

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DisabledAction label={t('credit.settings.createProduct')} reason={reason} />
        <DisabledAction label={t('credit.settings.newVersion')} reason={reason} />
        <DisabledAction label={t('credit.settings.validateVersion')} reason={reason} />
        <DisabledAction label={t('credit.settings.activateVersion')} reason={reason} />
      </div>

      {products.map((product) => (
        <ProductCard
          key={product.code}
          product={product}
          open={openCode === product.code}
          onToggle={() => setOpenCode(openCode === product.code ? null : product.code)}
        />
      ))}
      {products.length === 0 && (
        <p className="text-muted-foreground text-sm">{t('credit.settings.noProducts')}</p>
      )}
    </>
  )
}

function ProductCard({
  product,
  open,
  onToggle,
}: {
  product: CreditProduct
  open: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation('common')
  const active = product.versions.find((version) => version.state === 'active')
  const payload = (active?.payload ?? {}) as Record<string, unknown>
  const rest = Object.keys(payload).filter((key) => !KEY_PARAMS.includes(key))

  return (
    <section className="border-border bg-card mb-3 rounded-xl border shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="font-mono text-xs">{product.code}</span>
        <span className="text-sm font-medium">{product.name}</span>
        <span className="text-muted-foreground text-xs">{product.jurisdiction}</span>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${
            product.availability === 'available'
              ? 'bg-success-100 text-success-700'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {t(`credit.settings.availability.${product.availability}`, product.availability)}
        </span>
        <span className="text-muted-foreground text-xs">
          {t('credit.settings.versionsCount', { count: product.versions.length })}
        </span>
      </button>

      {open && (
        <div className="border-border border-t p-4">
          <p className="text-muted-foreground mb-2 text-xs">{t('credit.settings.keyParams')}</p>
          <dl className="mb-4 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
            {KEY_PARAMS.filter((key) => key in payload).map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground font-mono text-xs">{key}</dt>
                <dd className="m-0">{formatValue(payload[key])}</dd>
              </div>
            ))}
          </dl>

          {rest.length > 0 && (
            <details className="mb-4">
              <summary className="text-muted-foreground cursor-pointer text-xs">
                {t('credit.settings.otherParams', { count: rest.length })}
              </summary>
              <pre className="bg-secondary-900 mt-2 max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px] text-white">
                {JSON.stringify(
                  Object.fromEntries(rest.map((key) => [key, payload[key]])),
                  null,
                  2
                )}
              </pre>
            </details>
          )}

          <p className="text-muted-foreground mb-2 text-xs">{t('credit.settings.versions')}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th className="py-2 text-left font-medium">{t('credit.settings.version')}</th>
                <th className="py-2 text-left font-medium">{t('credit.settings.state')}</th>
                <th className="py-2 text-left font-medium">{t('credit.settings.pricing')}</th>
                <th className="py-2 text-left font-medium">{t('credit.settings.validFrom')}</th>
              </tr>
            </thead>
            <tbody>
              {product.versions.map((version) => (
                <tr key={version.version} className="border-border border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{version.version}</td>
                  <td className="py-2">{version.state}</td>
                  <td className="py-2 font-mono text-xs">{version.pricing_version ?? '—'}</td>
                  <td className="text-muted-foreground py-2 text-xs">
                    {version.valid_from ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default CreditProductsSection
