/**
 * Другие заявки того же клиента — блок «Клієнт» карточки заявки.
 *
 * Счёт и список приходят ГОТОВЫМИ из модуля (`applicant_applications`): правило
 * «тот же клиент» (почта ИЛИ SIN, телефон не ключ) живёт там, и второй счёт во
 * фронте разошёлся бы с машиной. Блок не шлёт ни одного запроса.
 *
 * Четыре пустоты различаются, потому что значат разное: модуль поле не прислал
 * (счёт недоступен — это не ноль), сравнивать было не с чем (у заявки нет почты и
 * SIN), других заявок нет, и — всегда — заявки прежней CRM сюда не входят.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatDate } from '@/lib/formatters'
import type { CreditApplicantApplications } from '@/features/credit/api/types'
import { CreditStatusBadge } from './CreditStatusBadge'

export function CreditPriorApplications({
  value,
}: {
  value: CreditApplicantApplications | null | undefined
}) {
  const { t } = useTranslation('common')

  return (
    <div className="text-sm">
      <PriorApplicationsBody value={value} />
      {/* Заявки прежней CRM в счёт модуля не входят ни в каком состоянии поля:
          без этой строки «інших заявок немає» соврало бы каждому вернувшемуся
          клиенту. */}
      <p className="text-muted-foreground mt-2 text-xs">
        {t('credit.clientHistory.legacyNotCounted')}
      </p>
    </div>
  )
}

function PriorApplicationsBody({
  value,
}: {
  value: CreditApplicantApplications | null | undefined
}) {
  const { t } = useTranslation('common')

  // Ответ модуля приходит приведением типа без разбора схемы: поле без списка
  // или без признаков — тот же «модуль не передав», а не падение карточки.
  if (
    !value ||
    typeof value.total !== 'number' ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.identity_keys)
  ) {
    return <p className="text-muted-foreground">{t('credit.clientHistory.notCounted')}</p>
  }
  if (value.identity_keys.length === 0) {
    return <p className="text-muted-foreground">{t('credit.clientHistory.noIdentity')}</p>
  }

  const rule = (
    <p className="text-muted-foreground mt-1 text-xs">{t('credit.clientHistory.identityRule')}</p>
  )
  if (value.total === 0) {
    return (
      <>
        <p>{t('credit.clientHistory.none')}</p>
        {rule}
      </>
    )
  }

  return (
    <>
      <p className="font-medium">
        {t('credit.clientHistory.otherApplications', { count: value.total })}
      </p>
      {rule}
      <ul className="mt-2">
        {value.items.map((item) => (
          <li
            key={item.application_id}
            className="border-border flex flex-wrap items-center gap-3 border-b py-1.5 last:border-0"
          >
            <Link
              to={`/dashboard/credit/applications/${item.application_id}`}
              className="text-information-600 font-mono text-xs underline"
            >
              {item.number}
            </Link>
            <CreditStatusBadge status={item.status} />
            <span className="text-muted-foreground text-xs">{formatDate(item.created_at)}</span>
            <span className="text-xs">
              {item.decision_outcome
                ? t(`credit.status.${item.decision_outcome}`, item.decision_outcome)
                : '—'}
            </span>
          </li>
        ))}
      </ul>
      {value.items.length < value.total && (
        <p className="text-muted-foreground mt-1 text-xs">
          {t('credit.clientHistory.shownOf', { shown: value.items.length, total: value.total })}
        </p>
      )}
    </>
  )
}
