/**
 * Экран «сервис кредитов не отвечает на этом стенде».
 *
 * Зачем отдельный экран. Раздел виден в меню всем, а сервис кредитов может не
 * отвечать — тогда в Alert попадала строка axios «Request failed with status
 * code 404», и первый же сотрудник, кликнувший «Кредити», получал техническую
 * ошибку вместо объяснения. Ответ шлюза при отсутствии маршрута приходит в
 * чужом формате (`{"message": "..."}`, без `detail`/`title`), разобрать его
 * как ошибку модуля нечем — поэтому экран объясняет состояние словами и
 * оставляет техническую строку отдельно, для разработчика.
 *
 * Утверждений о том, ГДЕ именно живёт модуль, здесь больше нет намеренно:
 * они устаревают быстрее, чем их успевают исправить (WP-FE-2, REQ-FE-2-02).
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { CreditApiError } from '@/features/credit/api/creditApi'

/**
 * Техническая строка для разработчика: статус, код и сообщение, сколько их есть.
 *
 * Подсказка экрана обещает причину ниже, и обещание обязано держаться на ЛЮБОЙ
 * ошибке. Прежняя запись `(error as Error)?.message ?? '—'` держалась только на
 * богатой: `??` закрывает null и undefined, поэтому пустое `message` рисовало
 * пустую красную полосу, а не-Error (строка перехватчика, объект react-query) —
 * один прочерк. В обоих случаях подсказка обещала бы то, чего на экране нет.
 */
function technicalReason(error: unknown): string {
  const parts: string[] = []
  if (error instanceof CreditApiError) {
    if (error.status !== undefined) parts.push(`HTTP ${error.status}`)
    if (error.code) parts.push(error.code)
  } else if (error instanceof Error) {
    if (error.name) parts.push(error.name)
  } else if (typeof error === 'string' && error) {
    parts.push(error)
  } else if (error !== null && error !== undefined) {
    parts.push(typeof error)
  }
  const message = error instanceof Error ? error.message : ''
  if (message) parts.push(message)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function CreditModuleUnavailable({ error }: { error: unknown }) {
  const { t } = useTranslation('common')
  // Три РАЗНЫХ состояния, и раньше два из них показывались одинаково.
  //
  // 401 — модуль есть и отвечает, но НЕ ПРИНЯЛ пропуск оператора. Раньше здесь
  // предлагалось поле для служебного ключа; теперь ключа у браузера нет вовсе,
  // и предлагать нечего — человеку надо объяснить, почему его не пустили.
  //
  // 403 — пропуск приняли, а прав не хватило. Это не поломка, а ответ по делу:
  // в предъявленном пропуске нет прав `credit.*`. Сообщение вида «нет права
  // credit.applications.read» читается оператором как «вам не выдали» и не
  // говорит, к кому идти, — поэтому экран называет того, кто эти права выдаёт.
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
          <span className="font-mono text-xs">{technicalReason(error)}</span>
        </Alert>
      </div>
    </div>
  )
}

export default CreditModuleUnavailable
