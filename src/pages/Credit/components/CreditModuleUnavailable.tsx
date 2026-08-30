/**
 * Экран «модуль не развёрнут на этом стенде».
 *
 * Зачем отдельный экран. Кредитный модуль на этапе 1 живёт вне Kong: локально
 * его отдаёт прокси Vite на localhost:8020, а на сервере фронт — статика за
 * nginx, где весь /api/ уходит в Kong целиком. Маршрута /api/v1/credit там
 * нет, и Kong отвечает 404 с телом `{"message":"no Route matched…"}` — формат
 * чужой, `detail`/`title` в нём нет, поэтому в Alert попадала строка axios
 * «Request failed with status code 404». Раздел виден в меню всем, так что
 * первый же сотрудник, кликнувший «Кредити» на dev, получал бы техническую
 * ошибку вместо объяснения.
 *
 * Проверено вызовом: `GET http://72.62.17.132:8000/api/v1/credit/admin/overview`
 * → 404 `no Route matched with those values`.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'

export function CreditModuleUnavailable({ error }: { error: unknown }) {
  const { t } = useTranslation('common')
  return (
    <div className="p-6">
      <h1 className="text-foreground mb-4 text-xl font-semibold">
        {t('navigation.creditModule', 'Credit Module')}
      </h1>
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <p className="text-foreground text-sm font-medium">{t('credit.unavailable.title')}</p>
        <p className="text-muted-foreground mt-2 text-sm">{t('credit.unavailable.hint')}</p>
        <Alert variant="error" className="mt-4">
          {/* Техническую причину прячем не полностью: без неё разработчику
              нечего искать в логах, а оператору она и не мешает — он читает
              объяснение выше. */}
          <span className="font-mono text-xs">{(error as Error)?.message ?? '—'}</span>
        </Alert>
      </div>
    </div>
  )
}

export default CreditModuleUnavailable
