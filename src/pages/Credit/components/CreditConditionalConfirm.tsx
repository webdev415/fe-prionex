/**
 * Кнопка «Підтвердити умовне схвалення» руководителя риск-менеджмента (19-5f).
 *
 * Рисуется страницей только при праве `credit.decisions.confirm_conditional`,
 * заявке в `referred` и ступени `proposed` — хук подтверждения живёт здесь, чтобы
 * вне этих условий его не звал никто. Автору кнопка НЕ прячется: правило
 * «подтверждает другой человек» — бизнес-правило модуля, номер автора модуль
 * берёт из пропуска; fe повторять его не должен (правило 27), автор получает
 * `409` и текст. Подсказка под кнопкой видна всегда.
 *
 * Успех компонент отдаёт наверх (`onConfirmed`) и плашки успеха не рисует:
 * после сброса кэша карточка приходит подтверждённой, и он уходит с экрана
 * вместе с кнопкой. Ошибку показывает сам — одной плашкой в блоке кнопки.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCreditConfirmConditional } from '@/features/credit/hooks/useCredit'

export function CreditConditionalConfirm({
  applicationId,
  proposalDecisionId,
  amount,
  codes,
  errorText,
  onConfirmed,
}: {
  applicationId: string
  proposalDecisionId: string
  /** Сумма предложения, уже отформатированная. */
  amount: string
  codes: readonly string[]
  errorText: (t: TFunction, error: unknown) => string
  onConfirmed: () => void
}) {
  const { t } = useTranslation('common')
  const mutation = useCreditConfirmConditional(applicationId)
  const [asking, setAsking] = useState(false)

  const confirm = () => {
    setAsking(false)
    mutation.mutate({ proposal_decision_id: proposalDecisionId }, { onSuccess: onConfirmed })
  }

  return (
    <div className="my-2 flex flex-col gap-2">
      {mutation.isError && <Alert variant="error">{errorText(t, mutation.error)}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          isLoading={mutation.isPending}
          onClick={() => setAsking(true)}
        >
          {t('credit.actions.confirmConditional')}
        </Button>
        <span className="text-muted-foreground text-xs">{t('credit.card.confirmNotAuthor')}</span>
      </div>
      <ConfirmDialog
        open={asking}
        title={t('credit.card.confirmTitle')}
        message={t('credit.card.confirmMessage', { amount, codes: codes.join(', ') })}
        confirmLabel={t('credit.actions.confirmConditional')}
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />
    </div>
  )
}
