/**
 * Плашка: модуль ещё не за Kong (этап 2, WS-20 — не сделан).
 *
 * Переключатель роли отсюда убран. Он менял заголовок `X-Operator-Role`,
 * которого браузер больше не шлёт: права приходят из пропуска оператора, и
 * выбор в списке уже ничего бы не менял. Оставить его — значит показывать
 * рычаг, не соединённый ни с чем: человек «сменил роль», увидел тот же 403 и
 * пошёл искать поломку не там.
 *
 * Сама плашка остаётся, пока остаётся её повод: модуль отвечает мимо шлюза.
 */
import { useTranslation } from 'react-i18next'
import type { CreditOverview } from '@/features/credit/api/types'

interface CreditStandBannerProps {
  overview?: CreditOverview
}

export function CreditStandBanner({ overview }: CreditStandBannerProps) {
  const { t } = useTranslation('common')
  if (!overview) return null

  return (
    <div className="bg-warning-100 text-warning-800 mb-4 flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5 text-xs">
      <span>{t('credit.stand.notice')}</span>
    </div>
  )
}

export default CreditStandBanner
