/**
 * Чек-лист проверки ручного решения (19-5f): блок формы и показ в карточке.
 *
 * Пункты — лист книги в порядке `CREDIT_CHECKLIST_KEYS`, тексты — словарь CRM
 * (двери-справочника у чек-листа нет). Ответ — три radio; «Скинути» и
 * «Примітка» появляются только у отвеченного пункта: без ответов блок не
 * добавляет в панель ни кнопки, ни текстового поля. Состояние ответов держит
 * форма решения — компонент управляемый.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Pii, piiProps } from '@/lib/openreplay/pii'
import {
  CREDIT_CHECKLIST_ANSWERS,
  CREDIT_CHECKLIST_HINTED,
  CREDIT_CHECKLIST_KEYS,
} from '@/features/credit/api/enums'
import {
  CREDIT_CHECKLIST_NOTE_MAX,
  answeredCount,
  type CreditChecklistAnswers,
  type CreditChecklistNotes,
} from '@/features/credit/api/decisionChecklist'
import type {
  CreditChecklistAnswer,
  CreditChecklistCompleted,
  CreditChecklistItem,
  CreditChecklistKey,
} from '@/features/credit/api/types'

const HINTED: readonly CreditChecklistKey[] = CREDIT_CHECKLIST_HINTED

export function CreditDecisionChecklistForm({
  answers,
  notes,
  onAnswer,
  onNote,
}: {
  answers: CreditChecklistAnswers
  notes: CreditChecklistNotes
  onAnswer: (key: CreditChecklistKey, answer: CreditChecklistAnswer | undefined) => void
  onNote: (key: CreditChecklistKey, note: string) => void
}) {
  const { t } = useTranslation('common')
  // Какие примечания открыты — забота экрана, а не решения: в тело уходит текст.
  const [opened, setOpened] = useState<CreditChecklistKey[]>([])

  return (
    <div className="mb-3">
      <p className="text-muted-foreground mb-1.5 text-xs font-semibold">
        {t('credit.checklist.title')}
      </p>
      <div className="border-border flex flex-col gap-2 rounded-md border p-3">
        {CREDIT_CHECKLIST_KEYS.map((key) => {
          const answer = answers[key]
          const showNote = answer !== undefined && opened.includes(key)
          return (
            <fieldset key={key}>
              <legend className="text-sm">{t(`credit.checklistItem.${key}`)}</legend>
              {HINTED.includes(key) && (
                <p className="text-muted-foreground text-xs">{t(`credit.checklistHint.${key}`)}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 py-1">
                {CREDIT_CHECKLIST_ANSWERS.map((value) => (
                  <label key={value} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name={`checklist-${key}`}
                      checked={answer === value}
                      onChange={() => onAnswer(key, value)}
                    />
                    {t(`credit.checklistAnswer.${value}`)}
                  </label>
                ))}
                {answer !== undefined && (
                  <>
                    <Button size="xs" variant="ghost" onClick={() => onAnswer(key, undefined)}>
                      {t('credit.checklist.clearAnswer')}
                    </Button>
                    {!showNote && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setOpened((prev) => [...prev, key])}
                      >
                        {t('credit.checklist.addNote')}
                      </Button>
                    )}
                  </>
                )}
              </div>
              {showNote && (
                <textarea
                  // Примечание несёт ПД (реквизиты письма работодателя), а управляемый
                  // textarea пишет значение и дочерним текстом — маска ввода его не видит.
                  {...piiProps}
                  className="border-input-border bg-card text-foreground w-full rounded-md border p-2 text-sm"
                  aria-label={t(`credit.checklistItem.${key}`)}
                  maxLength={CREDIT_CHECKLIST_NOTE_MAX}
                  value={notes[key] ?? ''}
                  onChange={(event) => onNote(key, event.target.value)}
                />
              )}
            </fieldset>
          )
        })}
      </div>
      <p className="text-muted-foreground mt-1.5 text-xs">
        {t('credit.checklist.progress', {
          answered: answeredCount(answers),
          total: CREDIT_CHECKLIST_KEYS.length,
        })}
      </p>
      <p className="text-muted-foreground text-xs">{t('credit.checklist.unansweredNotSent')}</p>
    </div>
  )
}

/**
 * Строка «Чек-лист» карточки: доля — из `checklist_completed` модуля, в fe не
 * пересчитывается (правило `n_a` — модуля). Ответы — свёрнутым списком из снимка
 * в порядке ответа модуля; примечание под маской записи сессии: в нём бывают
 * реквизиты письма работодателя.
 */
export function CreditDecisionChecklistView({
  completed,
  items,
}: {
  completed: CreditChecklistCompleted | null | undefined
  items: readonly CreditChecklistItem[]
}) {
  const { t } = useTranslation('common')
  return (
    <span className="flex flex-col gap-1">
      <span>
        {!completed
          ? t('credit.checklist.notFilled')
          : completed.applicable === 0
            ? t('credit.checklist.noneApplicable')
            : t('credit.checklist.share', { yes: completed.yes, applicable: completed.applicable })}
      </span>
      {items.length > 0 && (
        <details>
          <summary className="text-muted-foreground cursor-pointer text-xs">
            {t('credit.checklist.title')}
          </summary>
          <ul className="mt-1 text-xs">
            {items.map((item) => (
              <li key={item.key} className="py-0.5">
                {t(`credit.checklistItem.${item.key}`, item.key)}
                {' — '}
                {t(`credit.checklistAnswer.${item.answer}`, item.answer)}
                {item.note && (
                  <span className="text-muted-foreground block">
                    <Pii>{item.note}</Pii>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </span>
  )
}
