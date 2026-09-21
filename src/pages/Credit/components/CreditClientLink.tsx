/**
 * Связь кредитной заявки с карточкой клиента CRM.
 *
 * Раньше здесь стояло «клієнта ще не створено» — и это неправда: клиента не
 * «ещё» не создали, его **нельзя создать**. CRM требует при создании
 * десятизначный налоговый номер, у канадского заёмщика такого нет (разбор — в
 * `features/credit/api/clientLink.ts`). Формулировка обещала, что запись
 * появится сама, и оператор ждал.
 *
 * Поэтому ищем сами — по телефону, под правами оператора, — и показываем
 * ровно то, что узнали. Три разных ответа, а не два: «нашли», «искали и не
 * нашли», «не искали, вот почему». Последнее — по требованию владельца
 * модуля, и оно спасает от вывода «этих людей в CRM нет», сделанного из
 * недоступности CRM.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { searchClientsByPhoneExact } from '@/api/clientSearchApi'
import { creditClientLinkState } from '@/features/credit/api/clientLink'

export function CreditClientLink({
  clientId,
  phone,
}: {
  clientId: number | null | undefined
  phone: string | null | undefined
}) {
  const { t } = useTranslation('common')

  // Ищем только когда есть что искать и незачем: при известном `client_id`
  // запрос не нужен, при пустом телефоне — не по чему.
  const enabled = typeof clientId !== 'number' && Boolean(phone)
  const { data, isLoading, error } = useQuery({
    queryKey: ['credit', 'clientByPhone', phone],
    queryFn: () => searchClientsByPhoneExact(phone as string),
    enabled,
    retry: false,
    staleTime: 60_000,
  })

  const state = creditClientLinkState({ clientId, phone, isLoading, error, matches: data })

  if (state.kind === 'linked' || state.kind === 'found') {
    return (
      <span className="flex items-center gap-2">
        <Link
          to={`/dashboard/clients/${state.clientId}`}
          className="text-primary-600 text-sm hover:underline"
        >
          {state.kind === 'found' ? state.name : `#${state.clientId}`}
        </Link>
        {/* Найденного по телефону помечаем: это НАША догадка по совпадению
            номера, а не связь, которую подтвердил модуль. Оператор должен
            понимать разницу, прежде чем ссылаться на неё в разговоре. */}
        {state.kind === 'found' && (
          <span className="text-muted-foreground text-xs">{t('credit.clientLink.byPhone')}</span>
        )}
      </span>
    )
  }

  if (state.kind === 'ambiguous') {
    return (
      <span className="text-warning-700 text-xs">
        {t('credit.clientLink.ambiguous', { count: state.count })}
      </span>
    )
  }

  if (state.kind === 'not_found') {
    return <span className="text-muted-foreground text-xs">{t('credit.clientLink.notFound')}</span>
  }

  return (
    <span className="text-muted-foreground text-xs">
      {t(`credit.clientLink.notSearched.${state.reason}`)}
    </span>
  )
}
