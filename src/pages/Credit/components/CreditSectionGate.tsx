/**
 * Рубильник `crm_section` на МАРШРУТАХ раздела.
 *
 * Скрытого пункта меню недостаточно: прямая ссылка
 * `/dashboard/credit/applications` живёт в закладках, в переписке и в истории
 * браузера, и выключенный раздел открывался по ней как ни в чём не бывало.
 * Выключатель, который убирает только вход, но не закрывает комнату, — это не
 * выключатель. Поэтому проверка стоит на каждой странице раздела, а не только
 * в навигации.
 *
 * **Скрываем ТОЛЬКО по явному `false`** — то же правило, что в меню, и по той
 * же причине: ошибка сети, недоступный модуль и ещё не пришедший ответ обязаны
 * оставить раздел рабочим. Иначе поломка связи выглядит как решение
 * риск-менеджера, оператор идёт заводить задачу на «пропавший раздел», и мы
 * теряем время на аварию, которой нет. Правило живёт в одном месте —
 * `useCreditSectionEnabled`; второй его копии здесь намеренно нет.
 *
 * Дети передаются элементом и НЕ рендерятся при выключенном разделе — значит
 * ленивый чанк страницы даже не загружается.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { useCreditSectionEnabled } from '@/features/credit/hooks/useCredit'

export function CreditSectionGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common')
  // `true`: сюда доходит только тот, кто уже прошёл проверку прав маршрута.
  // Спрашивать у остальных положение рубильника незачем — они раздел и так
  // не видят.
  const enabled = useCreditSectionEnabled(true)

  if (enabled) return <>{children}</>

  return (
    <div className="p-6">
      <h1 className="text-foreground mb-4 text-xl font-semibold">
        {t('navigation.creditModule', 'Credit Module')}
      </h1>
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        {/* Объяснение, а не 403: человек пришёл по правам, ему отказал не
            доступ, а решение риск-менеджера — и текст обязан сказать, что
            обслуживание уже выданных кредитов при этом не остановлено. */}
        <Alert variant="warning">{t('credit.switches.sectionOff')}</Alert>
      </div>
    </div>
  )
}

export default CreditSectionGate
