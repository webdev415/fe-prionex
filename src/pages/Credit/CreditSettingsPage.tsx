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
import { CreditSwitchesSection } from './components/CreditSwitchesSection'
import { Alert } from '@/components/ui/Alert'
import { useCreditSectionEnabled } from '@/features/credit/hooks/useCredit'
import { CreditStandBanner } from './components/CreditStandBanner'

type SettingsTab = 'products' | 'parameters' | 'integrations' | 'switches'

export function CreditSettingsPage() {
  const { t } = useTranslation('common')
  const [tab, setTab] = useURLState<string>('tab', 'products')
  const { data: overview } = useCreditOverview()

  // Права приходят от самого модуля: продукты и параметры — риск-менеджеру.
  // UI повторяет ту же матрицу, но не подменяет её: отказ всё равно придёт
  // с сервера (403), даже если кто-то откроет вкладку напрямую по ссылке.
  const canReadProducts = Boolean(overview?.permissions.includes('credit.products.read'))
  const canReadParameters = Boolean(overview?.permissions.includes('credit.parameters.read'))
  const canReadSwitches = Boolean(overview?.permissions.includes('credit.switches.read'))
  // Настройки намеренно НЕ закрыты калиткой (иначе рубильник односторонний —
  // см. routes/index.tsx и creditRoutesGated.test.ts). Но раз страница
  // остаётся открытой при выключенном разделе, она обязана сказать почему:
  // иначе риск-менеджер видит работающие настройки внутри «выключенного»
  // модуля и не понимает, в каком состоянии система.
  const sectionEnabled = useCreditSectionEnabled(true)

  const tabs = [
    { id: 'products' as const, label: t('credit.settings.tabs.products') },
    { id: 'parameters' as const, label: t('credit.settings.tabs.parameters') },
    { id: 'integrations' as const, label: t('credit.settings.tabs.integrations') },
    // Рубильники видят все операторские роли: оператор обязан понимать,
    // почему нет новых заявок. Переключает только риск-менеджер — это решает
    // право `credit.switches.write` внутри самой секции.
    ...(canReadSwitches
      ? [{ id: 'switches' as const, label: t('credit.settings.tabs.switches') }]
      : []),
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

        {!sectionEnabled && (
          <Alert variant="warning" className="mt-4">
            {t('credit.switches.sectionOffHere')}
          </Alert>
        )}

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
          {current === 'switches' && <CreditSwitchesSection overview={overview} />}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default CreditSettingsPage
