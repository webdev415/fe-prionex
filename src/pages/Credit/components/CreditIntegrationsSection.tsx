/**
 * Настройки → Интеграции.
 *
 * Статусная страница внешнего контура модуля. Статусы здесь НЕ выдуманы и не
 * опрашиваются несуществующими health-ручками: показывается то, что
 * зафиксировано в контракте и документации модуля, плюс единственный живой
 * признак, который сервис действительно отдаёт, — демо-режим стенда.
 *
 * Когда появятся настоящие подключения (этап 2–3), у каждой строки появится
 * свой источник статуса; до тех пор честнее «не подключено», чем зелёная
 * галочка, за которой ничего нет.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import type { CreditOverview } from '@/features/credit/api/types'

type IntegrationState = 'not_connected' | 'stand_only' | 'contract_draft'

interface IntegrationRow {
  id: string
  state: IntegrationState
  /** Документ модуля, где собрано всё, что известно об интеграции. */
  doc?: string
  stage: string
}

const PROVIDERS: IntegrationRow[] = [
  { id: 'flinks', state: 'not_connected', doc: 'docs/integrations/flinks-api.md', stage: '3' },
  { id: 'zumRails', state: 'not_connected', doc: 'docs/integrations/zum-rails-api.md', stage: '3' },
  { id: 'eSignature', state: 'not_connected', stage: '3' },
]

const PLATFORM: IntegrationRow[] = [
  { id: 'outbox', state: 'stand_only', stage: '2' },
  {
    id: 'clientService',
    state: 'contract_draft',
    doc: 'contracts/external/client-service-internal.yaml',
    stage: '2',
  },
]

const STATE_CLASS: Record<IntegrationState, string> = {
  not_connected: 'bg-muted text-muted-foreground',
  stand_only: 'bg-warning-100 text-warning-800',
  contract_draft: 'bg-information-100 text-information-700',
}

function IntegrationTable({ rows, title }: { rows: IntegrationRow[]; title: string }) {
  const { t } = useTranslation('common')
  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h3 className="border-border flex min-h-[49px] items-center border-b px-4 text-sm font-semibold">
        {title}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-xs">
            <th className="px-4 py-2 text-left font-medium">
              {t('credit.settings.integrationName')}
            </th>
            <th className="px-4 py-2 text-left font-medium">
              {t('credit.settings.integrationRole')}
            </th>
            <th className="px-4 py-2 text-left font-medium">{t('credit.columns.status')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('credit.settings.stage')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('credit.settings.source')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-border border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">
                {t(`credit.settings.integrations.${row.id}.name`)}
              </td>
              <td className="text-muted-foreground px-4 py-2.5">
                {t(`credit.settings.integrations.${row.id}.role`)}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_CLASS[row.state]}`}
                >
                  {t(`credit.settings.integrationState.${row.state}`)}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-2.5 text-xs">
                {t('credit.settings.stageValue', { stage: row.stage })}
              </td>
              <td className="text-muted-foreground px-4 py-2.5 font-mono text-[11px]">
                {row.doc ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export function CreditIntegrationsSection({ overview }: { overview?: CreditOverview }) {
  const { t } = useTranslation('common')

  return (
    <>
      {overview?.demo_mode && (
        <Alert variant="warning" className="mb-4">
          {t('credit.settings.demoModeNotice')}
        </Alert>
      )}

      <IntegrationTable rows={PROVIDERS} title={t('credit.settings.providers')} />
      <IntegrationTable rows={PLATFORM} title={t('credit.settings.platform')} />

      <p className="text-muted-foreground text-xs">{t('credit.settings.integrationsFootnote')}</p>
    </>
  )
}

export default CreditIntegrationsSection
