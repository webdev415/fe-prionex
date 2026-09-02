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
 * ⚠️ Адрес проверки. Замер, которым это найдено, сделан на СТАРОМ стенде
 * `72.62.17.132`: `GET http://72.62.17.132:8000/api/v1/credit/admin/overview`
 * → 404 `no Route matched with those values`. Настоящий DEV с 02.09.2026 —
 * `185.185.49.127` (он же `10.70.0.1` по WireGuard), там своя сеть
 * `crm-dev-network` и свой шлюз `crm-dev-kong-gateway`. Оставлять голый адрес
 * без имени стенда нельзя: сегодня по такому же комментарию мы дважды искали
 * ответ не на той машине — сначала выдали роль в проекте, которого на рабочем
 * стенде нет, потом построили миграцию на цепочке, оборвавшейся на другом
 * хосте. Утверждение об инфраструктуре без имени стенда — незаконченное.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { CreditApiKeyPanel } from './CreditApiKeyPanel'

export function CreditModuleUnavailable({ error }: { error: unknown }) {
  const { t } = useTranslation('common')
  // 401 — это НЕ «модуль не развёрнут»: модуль есть, отвечает и требует ключ.
  // Свалить эти состояния в одно значит отправить человека искать несуществующую
  // аварию вместо того, чтобы дать ему поле для ключа.
  const needsKey = error instanceof CreditApiError && error.status === 401
  if (needsKey) {
    return (
      <div className="p-6">
        <h1 className="text-foreground mb-4 text-xl font-semibold">
          {t('navigation.creditModule', 'Credit Module')}
        </h1>
        <CreditApiKeyPanel />
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
