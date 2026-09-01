/**
 * Настройки кредитного модуля: продукты, параметры решения, интеграции.
 *
 * Композиция — как у настроек CRM (`pages/AiSettings`): заголовок, пояснение и
 * секции, каждая из которых сама решает, что показать текущей роли. Вкладка
 * живёт в URL, чтобы ссылку на конкретный экран можно было переслать.
 */
import { useTranslation } from 'react-i18next'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { CreditApiKeyPanel } from './components/CreditApiKeyPanel'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useURLState } from '@/hooks/useURLState'
import { useCreditOverview } from '@/features/credit/hooks/useCredit'
import { CreditProductsSection } from './components/CreditProductsSection'
import { CreditParametersSection } from './components/CreditParametersSection'
import { CreditIntegrationsSection } from './components/CreditIntegrationsSection'
import { CreditStandBanner } from './components/CreditStandBanner'

type SettingsTab = 'products' | 'parameters' | 'integrations'

export function CreditSettingsPage() {
  const { t } = useTranslation('common')
  const [tab, setTab] = useURLState<string>('tab', 'products')
  const { data: overview } = useCreditOverview()

  // Права приходят от самого модуля: продукты и параметры — риск-менеджеру.
  // UI повторяет ту же матрицу, но не подменяет её: отказ всё равно придёт
  // с сервера (403), даже если кто-то откроет вкладку напрямую по ссылке.
  const canReadProducts = Boolean(overview?.permissions.includes('credit.products.read'))
  const canReadParameters = Boolean(overview?.permissions.includes('credit.parameters.read'))

  const tabs = [
    { id: 'products' as const, label: t('credit.settings.tabs.products') },
    { id: 'parameters' as const, label: t('credit.settings.tabs.parameters') },
    { id: 'integrations' as const, label: t('credit.settings.tabs.integrations') },
  ]

  const current = (tabs.find((item) => item.id === tab)?.id ?? 'products') as SettingsTab

  return (
    <TooltipProvider>
      <div className="p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('credit.settings.title')}
          </h1>
          <p className="text-muted-foreground text-sm font-light">{t('credit.settings.helper')}</p>
        </div>

        <CreditStandBanner overview={overview} />

        <SegmentedTabs
          items={tabs}
          value={current}
          onChange={(next) => setTab(next)}
          ariaLabel={t('credit.settings.title')}
        />

        <div className="mt-4">
          {current === 'products' && <CreditProductsSection canRead={canReadProducts} />}
          {current === 'parameters' && <CreditParametersSection canRead={canReadParameters} />}
          {current === 'integrations' && (
            <div className="space-y-4">
              {/* Ключ стенда — здесь же, где интеграции: это ровно интеграция
                  с модулем на этапе 1. Раньше вписать его было негде вовсе. */}
              <CreditApiKeyPanel />
              <CreditIntegrationsSection overview={overview} />
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default CreditSettingsPage
