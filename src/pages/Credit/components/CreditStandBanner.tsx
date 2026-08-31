/**
 * Плашка этапа 1: модуль ещё не за Kong и не знает ролей CRM.
 *
 * Показываем честно, где мы находимся, и даём переключить роль стенда — иначе
 * оператор увидит 403 и решит, что раздел сломан. На этапе 2 (WS-20) компонент
 * удаляется целиком: роль будет приходить из JWT.
 */
import { useTranslation } from 'react-i18next'
import { getStandRole, setStandRole } from '@/features/credit/api/creditApi'
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
      <label className="flex items-center gap-2">
        {t('credit.stand.role')}
        <select
          className="border-warning-800/30 bg-card text-foreground h-8 rounded-md border px-2 text-xs"
          defaultValue={getStandRole()}
          onChange={(event) => {
            setStandRole(event.target.value)
            window.location.reload()
          }}
        >
          {overview.roles_available.map((role) => (
            <option key={role} value={role}>
              {t(`credit.roles.${role}`, role)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default CreditStandBanner
