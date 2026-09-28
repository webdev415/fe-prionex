/**
 * «Що не так?» — короткий комментарий к оценке 👎 под ответом ассистента.
 *
 * Прокси (`comment`, шифруется) и мозг (`comment`, ПДн маскируются) поле уже
 * принимали, но интерфейс его не слал — в журнале мозга оставался голый 👎 без
 * причины. Форма только собирает текст: отправку, повторную оценку и тосты
 * держит страница (см. `handleFeedbackComment` в AiAssistantBetaPage).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

/**
 * Потолок длины комментария. У мозга `max_length=2000`, у прокси лимита нет
 * (`Text`); 500 хватает на «что не так» и не упирается в мозг — длинный текст
 * там дал бы 422 и тихий `journal: failed`.
 */
export const FEEDBACK_COMMENT_MAX_LENGTH = 500

/**
 * Обрезка до лимита без разрыва суррогатной пары: `slice` считает UTF-16
 * единицы, и эмодзи на границе оставил бы одиночный суррогат — в JSON он уходит
 * как `\udXXX`, и UTF-8 на сервере на нём спотыкается.
 */
function clampFeedbackComment(value: string): string {
  if (value.length <= FEEDBACK_COMMENT_MAX_LENGTH) return value
  const cut = value.slice(0, FEEDBACK_COMMENT_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/**
 * Сенсорный ввод: фокус в поле там сразу поднимает экранную клавиатуру и
 * перекрывает ответ, который оператор только что оценил. jsdom и старые
 * WebView `matchMedia` не знают — тогда считаем, что указатель точный.
 */
function isCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

export interface FeedbackCommentBoxProps {
  /** Серверный id ответа — только для testid/отладки. */
  messageId: number
  /**
   * 👎 ещё не подтверждён сервером: писать можно, «Надіслати» — нет. Иначе
   * комментарий мог бы уйти раньше оценки, а её откат оставил бы на сервере
   * 👎 с комментарием под ответом, который в интерфейсе без оценки.
   */
  ratingPending?: boolean
  /** Комментарий уже едет на сервер: форма заперта, текст сохранён. */
  sending?: boolean
  /**
   * Высота фиксированной панели ввода (px): форма прокручивается в видимую
   * область с этим отступом снизу, а не под панель.
   */
  scrollMarginBottom?: number
  /**
   * Ставить ли фокус в поле при открытии. Страница выключает его в узкой
   * раскладке; на сенсорном вводе форма не фокусируется в любом случае.
   */
  focusOnOpen?: boolean
  /** Обрезанный по краям текст, не длиннее {@link FEEDBACK_COMMENT_MAX_LENGTH}. */
  onSubmit: (comment: string) => void
  onSkip: () => void
}

export function FeedbackCommentBox({
  messageId,
  ratingPending = false,
  sending = false,
  scrollMarginBottom,
  focusOnOpen = true,
  onSubmit,
  onSkip,
}: FeedbackCommentBoxProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const inputId = useId()
  const counterId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasSending = useRef(sending)
  // Решение о фокусе фиксируется при открытии: смена раскладки позже не должна
  // дёргать ни фокус, ни ленту.
  const focusOnOpenRef = useRef(focusOnOpen)
  const comment = clampFeedbackComment(text.trim())
  const canSubmit = comment.length > 0 && !sending && !ratingPending

  // 👎 чаще всего жмут под последним ответом, а он стоит вплотную к
  // фиксированной панели ввода: форма появлялась под ней, невидимой. Сначала
  // показываем её (scroll-margin-bottom = высота панели), потом фокус — без
  // второй прокрутки (вместо autoFocus — jsx-a11y/no-autofocus).
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (focusOnOpenRef.current && !isCoarsePointer()) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }, [])

  // Отправка не удалась — фокус обратно в поле: клик по «Надіслати» увёл его
  // на кнопку, а она на время отправки заперта, и фокус упал в body.
  useEffect(() => {
    if (wasSending.current && !sending) {
      const active = document.activeElement
      if (!active || active === document.body) {
        inputRef.current?.focus({ preventScroll: true })
      }
    }
    wasSending.current = sending
  }, [sending])

  const submit = () => {
    if (!canSubmit) return
    onSubmit(comment)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && !sending) {
      event.preventDefault()
      event.stopPropagation()
      onSkip()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      ref={formRef}
      data-testid={`feedback-comment-${messageId}`}
      data-state={sending ? 'sending' : ratingPending ? 'pending' : 'open'}
      aria-busy={sending || undefined}
      className="border-border bg-card mt-1.5 flex w-80 max-w-full flex-col gap-1.5 rounded-lg border p-2"
      style={scrollMarginBottom != null ? { scrollMarginBottom } : undefined}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor={inputId} className="text-foreground text-xs font-medium">
        {t('pages.aiAssistant.feedbackCommentLabel')}
      </label>
      <Textarea
        ref={inputRef}
        id={inputId}
        textareaSize="sm"
        rows={2}
        value={text}
        maxLength={FEEDBACK_COMMENT_MAX_LENGTH}
        // readOnly, а не disabled: заблокированное поле теряет фокус, и
        // клавиатурному оператору пришлось бы искать его заново.
        readOnly={sending}
        aria-describedby={counterId}
        placeholder={t('pages.aiAssistant.feedbackCommentPlaceholder')}
        onChange={(event) => setText(clampFeedbackComment(event.target.value))}
        onKeyDown={handleKeyDown}
        className="min-h-14 px-3 py-1.5 text-xs"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          id={counterId}
          data-testid="feedback-comment-counter"
          className="text-muted-foreground text-[11px] font-light"
        >
          {`${text.length}/${FEEDBACK_COMMENT_MAX_LENGTH}`}
        </span>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="2xs" disabled={sending} onClick={onSkip}>
            {t('pages.aiAssistant.feedbackCommentSkip')}
          </Button>
          <Button type="submit" variant="primary" size="2xs" disabled={!canSubmit}>
            {t('pages.aiAssistant.feedbackCommentSubmit')}
          </Button>
        </div>
      </div>
    </form>
  )
}

/**
 * «Дякуємо, передано» на месте формы. Форма размонтировалась вместе с полем,
 * где был фокус, — строка забирает его себе (если фокус никуда больше не ушёл),
 * чтобы скринридер её прочёл, а клавиатура не начинала с начала страницы.
 */
export function FeedbackCommentSent({ messageId }: { messageId: number }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const active = document.activeElement
    if (!active || active === document.body) {
      ref.current?.focus({ preventScroll: true })
    }
  }, [])

  return (
    <p
      ref={ref}
      role="status"
      tabIndex={-1}
      data-testid={`feedback-comment-sent-${messageId}`}
      className="text-muted-foreground mt-1 px-1 text-[11px] font-light outline-none"
    >
      {t('pages.aiAssistant.feedbackCommentSent')}
    </p>
  )
}
