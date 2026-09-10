/**
 * Настройки → Рубильники продукта.
 *
 * Три независимых выключателя: приём заявок с сайта, кабинет клиента, раздел
 * модуля в CRM. Положение и история приходят из модуля
 * (`GET /admin/switches`), переключает только риск-менеджер
 * (`credit.switches.write`).
 *
 * Что здесь ГЛАВНОЕ и почему экран устроен именно так:
 *
 * 1. **Выключение = запрет НОВОГО.** Обслуживание выданных кредитов не
 *    останавливается никогда. Это написано на самом экране, а не только в
 *    документации: человек, который дёргает рубильник, обязан понимать, что
 *    именно он останавливает, в момент нажатия.
 * 2. **Причина обязательна при выключении.** Контракт её не требует, мы —
 *    требуем: без причины через неделю никто не объяснит остановку продукта,
 *    а история переключений и есть весь аудит (отдельного журнала нет).
 * 3. **Выключение подтверждается отдельным шагом.** Рубильник останавливает
 *    выдачу денег; случайный клик по переключателю для такого действия — не
 *    та цена ошибки. Включение обратно делается одним нажатием: возврат к
 *    работе не должен быть трудным.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { formatDateTime } from '@/lib/formatters'
import { useCreditSwitches, useSetCreditSwitch } from '@/features/credit/hooks/useCredit'
import type { CreditOverview, CreditSwitchName } from '@/features/credit/api/types'

/** Порядок на экране — от самого дорогого выключения к самому дешёвому. */
const SWITCHES: CreditSwitchName[] = ['applications_intake', 'client_cabinet', 'crm_section']

export function CreditSwitchesSection({ overview }: { overview?: CreditOverview }) {
  const { t } = useTranslation('common')
  const { data, isLoading, error } = useCreditSwitches()
  const setSwitch = useSetCreditSwitch()
  const [pending, setPending] = useState<CreditSwitchName | null>(null)
  const [reason, setReason] = useState('')

  const canWrite = Boolean(overview?.permissions.includes('credit.switches.write'))

  if (isLoading) return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>

  // Молчать нельзя: экран рубильников, который не смог прочитать положение,
  // обязан сказать об этом, а не показать всё включённым.
  if (error || !data) return <Alert variant="warning">{t('credit.switches.loadFailed')}</Alert>

  const submitOff = (name: CreditSwitchName) => {
    setSwitch.mutate(
      { name, payload: { enabled: false, reason: reason.trim() } },
      {
        onSuccess: () => {
          setPending(null)
          setReason('')
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="info">{t('credit.switches.rule')}</Alert>

      <div className="border-border divide-border divide-y rounded-lg border">
        {SWITCHES.map((name) => {
          const enabled = data.switches[name]
          const confirming = pending === name
          return (
            <div key={name} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {t(`credit.switches.names.${name}`)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t(`credit.switches.effects.${name}`)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {enabled ? t('credit.switches.on') : t('credit.switches.off')}
                  </span>
                  <ToggleSwitch
                    checked={enabled}
                    disabled={!canWrite || setSwitch.isPending}
                    ariaLabel={t(`credit.switches.names.${name}`)}
                    onChange={(next) => {
                      // Включение — сразу: возврат к работе не должен быть
                      // трудным. Выключение — через причину и подтверждение.
                      if (next) {
                        setSwitch.mutate({ name, payload: { enabled: true, reason: null } })
                        return
                      }
                      setPending(name)
                      setReason('')
                    }}
                  />
                </div>
              </div>

              {confirming && (
                <div className="bg-muted/40 flex flex-col gap-2 rounded-md p-3">
                  <p className="text-foreground text-xs">{t(`credit.switches.confirm.${name}`)}</p>
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t('credit.switches.reasonPlaceholder')}
                    maxLength={500}
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!reason.trim() || setSwitch.isPending}
                      onClick={() => submitOff(name)}
                    >
                      {t('credit.switches.turnOff')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                      {t('common.cancel')}
                    </Button>
                    {!reason.trim() && (
                      <span className="text-muted-foreground text-xs">
                        {t('credit.switches.reasonRequired')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!canWrite && (
        <p className="text-muted-foreground text-xs">{t('credit.switches.readOnly')}</p>
      )}
      {setSwitch.isError && <Alert variant="error">{t('credit.switches.saveFailed')}</Alert>}

      <div>
        <h3 className="text-foreground mb-2 text-sm font-medium">
          {t('credit.switches.historyTitle')}
        </h3>
        {data.history.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t('credit.switches.historyEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.history.map((row, index) => (
              <li key={`${row.switch}-${row.occurred_at}-${index}`} className="text-xs">
                <span className="text-muted-foreground">{formatDateTime(row.occurred_at)}</span>{' '}
                <span className="text-foreground">{t(`credit.switches.names.${row.switch}`)}</span>{' '}
                <span className="text-muted-foreground">
                  {row.enabled ? t('credit.switches.on') : t('credit.switches.off')} · {row.actor}
                  {row.reason ? ` · ${row.reason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
