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
import { CreditApiError } from '@/features/credit/api/creditApi'

export function CreditModuleUnavailable({ error }: { error: unknown }) {
  const { t } = useTranslation('common')
  // Три РАЗНЫХ состояния, и раньше два из них показывались одинаково.
  //
  // 401 — модуль есть и отвечает, но НЕ ПРИНЯЛ пропуск оператора. Раньше здесь
  // предлагалось поле для служебного ключа; теперь ключа у браузера нет вовсе,
  // и предлагать нечего — человеку надо объяснить, почему его не пустили.
  //
  // 403 — пропуск приняли, а прав не хватило. Это не поломка, а ответ по делу,
  // и чаще всего причина в ПРОЕКТЕ: кредитные права заведены в «Фінбусті», и
  // оператор другого проекта принесёт права, среди которых кредитных нет.
  // Сообщение «нет права credit.applications.read» читается как «вам не
  // выдали», хотя настоящая причина — не тот проект.
  const status = error instanceof CreditApiError ? error.status : undefined
  if (status === 401 || status === 403) {
    return (
      <div className="p-6">
        <h1 className="text-foreground mb-4 text-xl font-semibold">
          {t('navigation.creditModule', 'Credit Module')}
        </h1>
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <p className="text-foreground text-sm font-medium">
            {t(status === 401 ? 'credit.access.notAuthenticated' : 'credit.access.noRights')}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            {t(
              status === 401 ? 'credit.access.notAuthenticatedHint' : 'credit.access.noRightsHint'
            )}
          </p>
        </div>
      </div>
    )
  }
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
