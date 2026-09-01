/**
 * Лента пути заявки: пять этапов ГЛАЗАМИ КЛИЕНТА.
 *
 * Карточка уже говорила, где клиент застрял (`credit.card.stuckAt`) и чего не
 * хватает, но не показывала пути целиком: что позади, что сейчас, что впереди.
 * Клиент в кабинете видит именно ленту из пяти шагов и в разговоре называет
 * НОМЕР («я на третьем»), поэтому оператор обязан видеть ту же ленту с той же
 * нумерацией. Расчёт — в `features/credit/api/applicationStages.ts`, там же
 * объяснено, почему это зеркало кабинета и чем оно рискует.
 *
 * Своих цветов не заводим: `success/information/error/muted` — те же ступени
 * палитры, что у признаков заявки (`CreditFlagList`) и предупреждений
 * (`CreditNotice`).
 */
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  creditApplicationStages,
  type CreditApplicationStageInput,
  type CreditStageState,
} from '@/features/credit/api/applicationStages'

/** Кружок с номером/значком. */
const MARK_CLASS: Record<CreditStageState, string> = {
  done: 'bg-success-100 text-success-700',
  current: 'bg-information-100 text-information-700',
  failed: 'bg-error-100 text-error-700',
  todo: 'bg-muted text-muted-foreground',
}

/** Подпись шага. Текущий и сбойный выделены начертанием, а не только цветом. */
const LABEL_CLASS: Record<CreditStageState, string> = {
  done: 'text-foreground',
  current: 'text-foreground font-semibold',
  failed: 'text-error-700 font-semibold',
  todo: 'text-muted-foreground',
}

export function CreditStageProgress({ application }: { application: CreditApplicationStageInput }) {
  const { t } = useTranslation('common')
  const stages = creditApplicationStages(application)

  return (
    <section className="border-border bg-card mb-4 rounded-xl border px-4 py-3">
      <div className="text-muted-foreground mb-2.5 text-xs">
        {t('credit.card.stagesTitle')} · {t('credit.card.stagesHint')}
      </div>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {stages.map((step, index) => (
          <li key={step.stage} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${MARK_CLASS[step.state]}`}
            >
              {step.state === 'done' ? (
                <Icons.Checkmark size={14} />
              ) : step.state === 'failed' ? (
                <Icons.Cancel01 size={14} />
              ) : (
                step.number
              )}
            </span>
            <span className={`text-sm ${LABEL_CLASS[step.state]}`}>
              {t(`credit.stage.${step.stage}`)}
            </span>
            {/* Состояние словом. Цвет и начертание — не единственный признак:
                читалка озвучит «3. Перевірка доходу — поточний крок», а не один
                номер. Видимой подписью показываем только то, что требует
                действия: где стоим и где сорвалось. */}
            {(step.state === 'current' || step.state === 'failed') && (
              <span className="text-muted-foreground text-xs">
                {t(`credit.stageState.${step.state}`)}
              </span>
            )}
            {(step.state === 'done' || step.state === 'todo') && (
              <span className="sr-only">{t(`credit.stageState.${step.state}`)}</span>
            )}
            {index < stages.length - 1 && (
              <Icons.ArrowRight size={14} className="text-muted-foreground mx-1" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default CreditStageProgress
