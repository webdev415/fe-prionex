/**
 * Идентификаторы сущности — моноширинной строкой и с кнопкой копирования.
 *
 * Оператор диктует их: `application_id` — чтобы разработчик нашёл заявку в
 * логах модуля, `loan_id` — чтобы запросить повтор решения
 * (`/decisions/{id}/replay`), `external_application_id` — чтобы партнёр нашёл
 * ту же заявку у себя. До этого блока ни один из них не был на экране: UUID
 * заявки и кредита существовали только в адресной строке, а `decision_id` и
 * `external_application_id` не показывались нигде — их приходилось просить у
 * разработчика. «Выделить мышью 36 символов из адреса» ломается на одном
 * символе, и ошибку видно не сразу, а через день переписки.
 *
 * Отсутствующее значение печатаем прочерком, а не прячем строку: «решения ещё
 * нет» — это ответ оператору, а исчезнувшая строка читается как «поле
 * потеряли», и её начинают искать.
 */
import { useTranslation } from 'react-i18next'
import { CopyButton } from './CreditCardHeader'

export interface CreditIdentifierItem {
  key: string
  /** Уже переведённая подпись: ключи словаря просят страницы, чтобы их видел
   *  страж i18nKeys — он собирает только статические `t('credit.…')`. */
  label: string
  value: string | null | undefined
}

export function CreditIdentifierRows({ items }: { items: CreditIdentifierItem[] }) {
  const { t } = useTranslation('common')
  return (
    <>
      {items.map((item) => (
        <div key={item.key} className="flex gap-3 py-1.5 text-sm">
          <span className="text-muted-foreground w-56 shrink-0">{item.label}</span>
          {item.value ? (
            <span className="flex min-w-0 items-center gap-2">
              {/* break-all, а не break-words: UUID — одно «слово» в 36 символов,
                  и без разрыва по символам он распирает панель на узком экране. */}
              <span className="font-mono text-xs break-all">{item.value}</span>
              <CopyButton value={item.value} label={t('credit.actions.copy')} />
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      ))}
    </>
  )
}

export default CreditIdentifierRows
