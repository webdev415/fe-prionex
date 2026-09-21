/**
 * Лента пути заявки: этапы ГЛАЗАМИ КЛИЕНТА, а позиция — из ответа модуля.
 *
 * Карточка уже говорила, где клиент застрял (`credit.card.stuckAt`) и чего не
 * хватает, но не показывала пути целиком: что позади, что сейчас, что впереди.
 * Клиент в кабинете видит ленту шагов и в разговоре называет НОМЕР («я на
 * третьем»), поэтому оператор обязан видеть ТОТ ЖЕ номер. Номер приходит из
 * модуля (`stage`/`stage_index`/`stage_total`), а не считается здесь; прежнее
 * зеркало осталось фолбэком для стендов, которые полей не присылают. Разбор
 * ответа, его границы и деградированный вид — в
 * `features/credit/api/applicationStages.ts`; там же названо, чем правило CRM
 * расходится с правилом витрины.
 *
 * Своих цветов не заводим: `success/information/error/muted` — те же ступени
 * палитры, что у признаков заявки (`CreditFlagList`) и предупреждений
 * (`CreditNotice`).
 */
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  CREDIT_APPLICATION_STAGES,
  creditApplicationStageView,
  creditStageLabelKey,
  type CreditApplicationStageInput,
  type CreditStageRow,
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
  const view = creditApplicationStageView(application)

  // Подпись «крок N з M» строится ТОЛЬКО из полей модуля и ТОЛЬКО когда оба
  // числа пришли: «крок undefined з 5» не рисуется никогда. Она ВИДИМАЯ, а не
  // `sr-only`: это ровно то число, которое оператор и клиент называют вслух.
  const caption =
    view.kind === 'mirror' || view.index === undefined || view.total === undefined
      ? null
      : t('credit.card.stageOfTotal', { index: view.index, total: view.total })

  // Имя этапа: знакомое — через словарь, чужое — СЫРЫМ ТЕКСТОМ. Ключ группы
  // `credit.stage` здесь не собирается вовсе — его строит домен
  // (`creditStageLabelKey`) и только для имени из перечня: в словаре законно
  // может оказаться ключ с чужим именем, и оператор прочёл бы служебную строку
  // как название этапа.
  const label = (row: { name?: string; known: boolean }) => {
    const key = row.known ? creditStageLabelKey(row.name) : null
    return key === null ? (row.name ?? '') : t(key)
  }

  if (view.kind === 'degraded') {
    // Ленты нет НАМЕРЕННО: подставить свою нумерацию к несогласованному ответу
    // значит соврать оператору. Подсказки `stagesHint` здесь тоже нет — она
    // обещает ленту из пяти шагов, которой в этом виде не будет. Числа
    // печатаются КАК ПРИШЛИ, даже противоречивые («крок 7 з 5»): это
    // единственный видимый признак того, что модуль отвечает несогласованно.
    return (
      <section className="border-border bg-card mb-4 rounded-xl border px-4 py-3">
        <div className="text-muted-foreground mb-2.5 text-xs">{t('credit.card.stagesTitle')}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {view.stage !== undefined && (
            <span className="text-foreground font-semibold">
              {label({ name: view.stage, known: view.known })}
            </span>
          )}
          {caption !== null && <span className="text-muted-foreground text-xs">{caption}</span>}
        </div>
      </section>
    )
  }

  // Подсказка обещает «ті самі п'ять кроків, що клієнт бачить у своєму
  // кабінеті». На расширенном пути строк шесть и больше, и подсказка начинает
  // спорить с соседним числом и с тем, что видно глазами. В деградированном
  // виде её сняли по этому же доводу — значит и здесь снимаем, а не только там,
  // где заметили первым.
  const showHint = view.kind === 'mirror' || view.total === CREDIT_APPLICATION_STAGES.length

  const rows: CreditStageRow[] =
    view.kind === 'mirror'
      ? view.steps.map((step) => ({
          name: step.stage,
          known: true,
          state: step.state,
          number: step.number,
        }))
      : view.rows

  return (
    <section className="border-border bg-card mb-4 rounded-xl border px-4 py-3">
      <div className="text-muted-foreground mb-2.5 text-xs">
        {t('credit.card.stagesTitle')}
        {caption !== null && <> · {caption}</>}
        {showHint && <> · {t('credit.card.stagesHint')}</>}
      </div>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {rows.map((row, index) => (
          /* key — НОМЕР, а не имя: при `stage_total` длиннее перечня имена
             повторяются или отсутствуют вовсе. Лента от дубля ключа не падает —
             React пишет предупреждение в консоль и может переиспользовать узлы
             не той строки (замер: восемь строк, две безымянные, ровно одно
             `Each child in a list should have a unique "key" prop`). */
          <li key={row.number} className="flex items-center gap-2">
            <span
              aria-hidden
              /* `min-w-6 px-1`, а не `w-6`: потолок пути — двенадцать шагов, и
                 двузначный номер в кружке фиксированной ширины обрезается. */
              className={`grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-1 text-xs font-semibold ${MARK_CLASS[row.state]}`}
            >
              {row.state === 'done' ? (
                <Icons.Checkmark size={14} />
              ) : row.state === 'failed' ? (
                <Icons.Cancel01 size={14} />
              ) : (
                row.number
              )}
            </span>
            {/* Номер отдельной строкой для читалки: кружок с цифрой помечен
                `aria-hidden` (он несёт ещё и знак состояния), поэтому без этой
                строки номер не достаётся вспомогательной технологии вовсе.
                А номер — это ровно то, ради чего лента заведена: оператор и
                клиент должны назвать ОДИН шаг. Приёмка поймала: читалке
                доставалось «Перевірка доходу — поточний крок», без «3». */}
            <span className="sr-only">{row.number}.</span>
            <span className={`text-sm ${LABEL_CLASS[row.state]}`}>{label(row)}</span>
            {/* Состояние словом. Цвет и начертание — не единственный признак:
                читалка озвучит «3. Перевірка доходу — поточний крок», а не один
                номер. Видимой подписью показываем только то, что требует
                действия: где стоим и где сорвалось. */}
            {(row.state === 'current' || row.state === 'failed') && (
              <span className="text-muted-foreground text-xs">
                {t(`credit.stageState.${row.state}`)}
              </span>
            )}
            {(row.state === 'done' || row.state === 'todo') && (
              <span className="sr-only">{t(`credit.stageState.${row.state}`)}</span>
            )}
            {index < rows.length - 1 && (
              <Icons.ArrowRight size={14} className="text-muted-foreground mx-1" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export default CreditStageProgress
