/**
 * «Персоналізація» — персональная память ассистента для сотрудника.
 *
 * Третий режим панели диалогов (рядом с «Активні» и «Архів»): список фактов,
 * которые мозг помнит о текущем операторе и подмешивает в ответы, плюс форма
 * «добавить факт» и удаление лишнего.
 *
 * Память — не служебный лог, а то, что меняет ответы ассистента, поэтому
 * оператор должен видеть её целиком: у каждой записи показано происхождение
 * (сам добавил / ассистент вывел / наблюдение) и дата.
 *
 * Память живёт с потолком активных записей на скоуп: в шапке показан счётчик
 * «занято / потолок», а на границе — строка о том, что старые и неиспользуемые
 * факты вытесняются сами. Потолок может не прийти (он выключен на мозге либо
 * бэкенд ещё старый) — тогда шапка выглядит ровно как до потолка.
 *
 * Удаление оптимистично (useDeleteAssistantMemory) — строка исчезает сразу,
 * упавший DELETE возвращает её обратно и объясняет причину тостом. Добавление,
 * наоборот, ждёт сервер: `title`/`kind`/`source` проставляет он, а 409 (похожий
 * факт уже есть) и 422 (PII/пусто) обязаны дойти до оператора текстом, а не
 * молча проглотиться.
 */

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  useAssistantMemory,
  useCreateAssistantMemory,
  useDeleteAssistantMemory,
} from '@/features/aiAssistant/hooks'
import { classifyMemoryError, type AssistantMemoryItem } from '@/features/aiAssistant/api'
import {
  formatMemoryDate,
  isMemoryFull,
  makeMemoryTitle,
  memoryUsageLabel,
  shouldShowMemoryTitle,
  MEMORY_CONTENT_MAX_LENGTH,
  MEMORY_SOURCE_BADGE_CLASS,
  memorySourceKey,
} from '@/features/aiAssistant/memoryPresentation'

function MemoryRow({ item }: { item: AssistantMemoryItem }) {
  const { t, i18n } = useTranslation('common')
  const deleteMutation = useDeleteAssistantMemory()

  const title = item.title?.trim()
  const content = item.content.trim()
  const sourceKey = memorySourceKey(item.source, item.kind)
  // Подзаголовок — только когда он несёт что-то сверх текста факта:
  // машинное «Профиль оператора: …» и обрезанная копия строки выше не несут.
  const showTitle = shouldShowMemoryTitle(title, content, sourceKey)

  const handleDelete = () => {
    deleteMutation.mutate(item.id, {
      onError: () => toast.error(t('pages.aiAssistant.memory.deleteError')),
    })
  }

  return (
    <li
      data-testid={`memory-item-${item.id}`}
      className="border-border/70 hover:bg-muted/50 group/memory relative rounded-xl border px-3 py-2 pr-9 transition-colors"
    >
      <p className="text-foreground text-sm leading-snug font-light break-words">{content}</p>
      {showTitle && (
        <p className="text-muted-foreground truncate text-[11px] font-light">{title}</p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
            MEMORY_SOURCE_BADGE_CLASS[sourceKey]
          )}
        >
          {t(`pages.aiAssistant.memory.sources.${sourceKey}`)}
        </span>
        <span className="text-muted-foreground text-[11px] font-light">
          {formatMemoryDate(item.created_at, i18n.language)}
        </span>
      </div>

      <button
        type="button"
        data-testid={`memory-delete-${item.id}`}
        aria-label={t('pages.aiAssistant.memory.deleteAria')}
        disabled={deleteMutation.isPending}
        onClick={handleDelete}
        className={cn(
          'text-muted-foreground absolute top-2 right-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg opacity-0 transition-opacity',
          'hover:bg-muted hover:text-error-600 group-hover/memory:opacity-100 focus-visible:opacity-100',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <Icons.Delete size={14} strokeWidth={1.5} />
      </button>
    </li>
  )
}

export type MemoryPanelProps = {
  className?: string
}

export function MemoryPanel({ className }: MemoryPanelProps) {
  const { t } = useTranslation('common')
  // Запрос уходит при монтировании: панель существует только в режиме
  // «Персоналізація», отдельный флаг «не грузить» ей не нужен.
  const memoryQuery = useAssistantMemory()
  const createMutation = useCreateAssistantMemory()

  const [draft, setDraft] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const items = memoryQuery.data?.items ?? []
  // Счётчик и подсказка живут на серверных `total`/`limit`: `items.length` — это
  // то, что уместилось в ответ, а не объём памяти.
  const total = memoryQuery.data?.total ?? items.length
  const limit = memoryQuery.data?.limit ?? null
  const usage = memoryUsageLabel(total, limit)
  const full = isMemoryFull(total, limit)
  const trimmed = draft.trim()
  const tooLong = trimmed.length > MEMORY_CONTENT_MAX_LENGTH
  const canSubmit = trimmed.length > 0 && !tooLong && !createMutation.isPending

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setFormError(null)
    createMutation.mutate(
      { title: makeMemoryTitle(trimmed), content: trimmed },
      {
        onSuccess: () => {
          setDraft('')
          toast.success(t('pages.aiAssistant.memory.addSuccess'))
        },
        onError: (error) => {
          const { kind, message } = classifyMemoryError(error)
          // Текст сервера — единственное, что объясняет 409/422 по существу
          // («такой факт уже есть», «уберите номер телефона»); локализованная
          // формулировка остаётся запасным вариантом.
          setFormError(message ?? t(`pages.aiAssistant.memory.errors.${kind}`))
        },
      }
    )
  }

  return (
    // flex-1/min-h-0, а не h-full: панель — колонка внутри колонки сайдбара,
    // высота приходит от родителя, а собственный скролл живёт в списке.
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="px-3 pt-1 pb-2">
        <div className="flex items-start gap-2">
          <p className="text-muted-foreground min-w-0 flex-1 text-[11px] leading-snug font-light">
            {t('pages.aiAssistant.memory.helper')}
          </p>
          {/* Потолка может не быть (старый бэкенд либо он выключен) — тогда
              счётчика просто нет, а список работает как раньше. */}
          {usage && (
            <span
              data-testid="memory-usage"
              title={t('pages.aiAssistant.memory.usageTitle', { used: total, limit })}
              className="text-muted-foreground shrink-0 text-[11px] font-light tabular-nums"
            >
              {usage}
            </span>
          )}
        </div>
        {/* Заполненная память — норма работы, а не ошибка: спокойный тон, без
            красного, и объяснение, что будет дальше. */}
        {full && (
          <p
            data-testid="memory-limit-hint"
            className="text-muted-foreground pt-1 text-[11px] leading-snug font-light"
          >
            {t('pages.aiAssistant.memory.limitHint')}
          </p>
        )}
      </div>

      <div className="ai-chat-input-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {memoryQuery.isPending && (
          <div className="space-y-2 px-1 pt-1" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="bg-muted h-14 animate-pulse rounded-xl" />
            ))}
          </div>
        )}

        {memoryQuery.isError && (
          <div className="flex flex-col items-start gap-2 px-2 pt-2">
            <p className="text-muted-foreground text-xs leading-snug font-light">
              {t('pages.aiAssistant.memory.loadError')}
            </p>
            <button
              type="button"
              onClick={() => void memoryQuery.refetch()}
              className="text-primary-600 hover:text-primary-700 inline-flex cursor-pointer items-center gap-1 text-xs font-medium"
            >
              <Icons.Reload size={12} strokeWidth={1.5} />
              {t('pages.aiAssistant.memory.retry')}
            </button>
          </div>
        )}

        {memoryQuery.isSuccess && items.length === 0 && (
          <div
            data-testid="memory-empty"
            className="flex flex-col items-center gap-2 px-2 pt-8 text-center"
          >
            <Icons.AiBrain03 size={24} strokeWidth={1} className="text-muted-foreground/60" />
            <p className="text-muted-foreground text-xs leading-snug font-light">
              {t('pages.aiAssistant.memory.empty')}
            </p>
          </div>
        )}

        {items.length > 0 && (
          <ul data-testid="memory-list" className="space-y-1.5 pt-1">
            {items.map((item) => (
              <MemoryRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-border/80 border-t px-3 py-2">
        <textarea
          rows={2}
          value={draft}
          data-testid="memory-input"
          aria-label={t('pages.aiAssistant.memory.addAria')}
          placeholder={t('pages.aiAssistant.memory.addPlaceholder')}
          onChange={(event) => {
            setDraft(event.target.value)
            if (formError) setFormError(null)
          }}
          className="border-border bg-muted/60 focus-within:border-primary-300 text-foreground placeholder:text-muted-foreground w-full resize-none rounded-xl border px-2.5 py-1.5 text-sm font-light focus:outline-none"
        />
        {tooLong && (
          <p className="text-error-600 pt-0.5 text-[11px] font-light">
            {t('pages.aiAssistant.memory.tooLong', { max: MEMORY_CONTENT_MAX_LENGTH })}
          </p>
        )}
        {formError && (
          <p
            data-testid="memory-form-error"
            className="text-error-600 pt-0.5 text-[11px] font-light"
          >
            {formError}
          </p>
        )}
        <button
          type="submit"
          data-testid="memory-submit"
          disabled={!canSubmit}
          className={cn(
            'border-primary-200/70 bg-primary-50/70 text-primary-700 hover:bg-primary-100/70 mt-1.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-light transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <Icons.Add size={16} strokeWidth={1.5} />
          {t('pages.aiAssistant.memory.addAction')}
        </button>
      </form>
    </div>
  )
}

export default MemoryPanel
