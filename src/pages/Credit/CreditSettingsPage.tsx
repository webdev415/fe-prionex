/**
 * Настройки кредитного модуля: продукты, параметры решения, интеграции,
 * рубильники, сайт (владелец сайта и вход в его админку, 17-40b) и постбеки
 * партнерам (18-13d).
 *
 * Композиция — как у настроек CRM (`pages/AiSettings`): заголовок, пояснение и
 * секции, каждая из которых сама решает, что показать текущей роли. Вкладка
 * живёт в URL, чтобы ссылку на конкретный экран можно было переслать.
 */
import { useTranslation } from 'react-i18next'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useURLState } from '@/hooks/useURLState'
import { useCreditOverview } from '@/features/credit/hooks/useCredit'
import { CreditProductsSection } from './components/CreditProductsSection'
import { CreditParametersSection } from './components/CreditParametersSection'
import { CreditIntegrationsSection } from './components/CreditIntegrationsSection'
import { CreditSwitchesSection } from './components/CreditSwitchesSection'
import { CreditSiteSection } from './components/CreditSiteSection'
import { CreditPostbacksSection } from './components/CreditPostbacksSection'
import { Alert } from '@/components/ui/Alert'
import { useCreditSectionEnabled } from '@/features/credit/hooks/useCredit'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasAnyPermission, useHasPermission } from '@/hooks/usePermissions'

type SettingsTab = 'products' | 'parameters' | 'integrations' | 'switches' | 'site' | 'postbacks'

export function CreditSettingsPage() {
  const { t } = useTranslation('common')
  const [tab, setTab] = useURLState<string>('tab', 'products')

  // Вкладка «Сайт» (17-40b) — про права CRM, а не модуля: владелец сайта и
  // вход в его админку. Видит её тот, кто владельца меняет (`manage_settings`)
  // или правит контент сайта.
  const canSeeSite = useHasAnyPermission([
    PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
    PERMISSIONS.SITE.CONTENT_EDIT,
    PERMISSIONS.SITE.CONTENT_PUBLISH,
  ])
  // Контент-менеджер сайта или маркетолог без кредитных прав попадает сюда
  // только ради сайта или постбеков (маршрут пускает его по своему праву):
  // вкладки модуля ему были бы стеной отказов, поэтому у него остаются только
  // свои вкладки. Набор прав — тот же, что у маршрута `credit/settings` без
  // прав на сайт и постбеки.
  const hasCreditSettingsAccess = useHasAnyPermission([
    PERMISSIONS.CREDIT.PARAMETERS_VIEW,
    PERMISSIONS.CREDIT.PRODUCTS_VIEW,
    PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
    PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
  ])
  // Постбеки партнерам (18-13d) — права пропуска CRM, а не сводки модуля:
  // сводка требует `credit.loans.read`, и маркетолог без кредитных прав ловил
  // бы 403 на каждый заход (Р-18-13d-3).
  const canSeePostbacks = useHasPermission(PERMISSIONS.CREDIT.POSTBACKS_VIEW)
  const canWritePostbacks = useHasPermission(PERMISSIONS.CREDIT.POSTBACKS_WRITE)
  const moduleOff = (canSeeSite || canSeePostbacks) && !hasCreditSettingsAccess

  // Кредитный модуль такому человеку ничего не покажет — и спрашивать его
  // незачем: каждый запрос был бы 403 от credit-service в логах шлюза.
  const { data: overview } = useCreditOverview({ enabled: !moduleOff })

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
  const sectionEnabled = useCreditSectionEnabled(!moduleOff)

  const moduleTabs = [
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
  const siteTab = { id: 'site' as const, label: t('credit.settings.tabs.site') }
  const postbacksTab = { id: 'postbacks' as const, label: t('credit.settings.tabs.postbacks') }
  const crmTabs = [...(canSeeSite ? [siteTab] : []), ...(canSeePostbacks ? [postbacksTab] : [])]
  const tabs: Array<{ id: SettingsTab; label: string }> = moduleOff
    ? crmTabs
    : [...moduleTabs, ...crmTabs]

  const current = (tabs.find((item) => item.id === tab)?.id ?? tabs[0].id) as SettingsTab

  return (
    <TooltipProvider>
      <div className="p-6">
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('credit.settings.title')}
          </h1>
          <p className="text-muted-foreground text-sm font-light">{t('credit.settings.helper')}</p>
        </div>

        <SegmentedTabs
          items={tabs}
          value={current}
          onChange={(next) => setTab(next)}
          ariaLabel={t('credit.settings.title')}
        />

        {/* Рубильник раздела модуля к сайту отношения не имеет: на вкладке
            «Сайт» предупреждение о нём сбивало бы с толку. Постбеки модуль шлёт
            и при выключенном разделе — рубильник прячет экраны, не события. */}
        {!sectionEnabled && current !== 'site' && current !== 'postbacks' && (
          <Alert variant="warning" className="mt-4">
            {t('credit.switches.sectionOffHere')}
          </Alert>
        )}

        <div className="mt-4">
          {current === 'products' && <CreditProductsSection canRead={canReadProducts} />}
          {current === 'parameters' && <CreditParametersSection canRead={canReadParameters} />}
          {/* Поля служебного ключа здесь больше нет: браузер ходит в модуль
              пропуском оператора, а не общим ключом. Оставлять форму значило бы
              предлагать человеку ввести то, что уже никуда не отправляется. */}
          {current === 'integrations' && <CreditIntegrationsSection overview={overview} />}
          {current === 'switches' && <CreditSwitchesSection overview={overview} />}
          {current === 'site' && <CreditSiteSection />}
          {current === 'postbacks' && <CreditPostbacksSection canWrite={canWritePostbacks} />}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default CreditSettingsPage
