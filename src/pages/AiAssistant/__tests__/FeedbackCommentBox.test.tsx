/**
 * FeedbackCommentBox — форма «Що не так?» под 👎.
 *
 * Форма только собирает текст: что уходит на сервер и когда — решает страница
 * (см. AiAssistantBetaPage.feedback.test.tsx). Здесь — границы самого ввода:
 * пустой текст не отправить, длиннее лимита не набрать, края обрезаются,
 * «Пропустити» ничего не шлёт. i18n-мок из src/test/setup.ts отдаёт ключи.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  FeedbackCommentBox,
  FeedbackCommentSent,
  type FeedbackCommentBoxProps,
} from '../FeedbackCommentBox'

type BoxOptions = Partial<
  Pick<FeedbackCommentBoxProps, 'sending' | 'ratingPending' | 'focusOnOpen' | 'scrollMarginBottom'>
>

function renderBox(props: BoxOptions = {}) {
  const onSubmit = vi.fn()
  const onSkip = vi.fn()
  render(<FeedbackCommentBox messageId={42} onSubmit={onSubmit} onSkip={onSkip} {...props} />)
  const input = screen.getByLabelText(
    'pages.aiAssistant.feedbackCommentLabel'
  ) as HTMLTextAreaElement
  const submit = screen.getByRole('button', {
    name: 'pages.aiAssistant.feedbackCommentSubmit',
  }) as HTMLButtonElement
  const skip = screen.getByRole('button', {
    name: 'pages.aiAssistant.feedbackCommentSkip',
  }) as HTMLButtonElement
  return { onSubmit, onSkip, input, submit, skip }
}

describe('FeedbackCommentBox', () => {
  it('показывает поле с подсказкой-примером и лимитом 500', () => {
    const { input } = renderBox()

    expect(input.placeholder).toBe('pages.aiAssistant.feedbackCommentPlaceholder')
    expect(input.maxLength).toBe(FEEDBACK_COMMENT_MAX_LENGTH)
    expect(FEEDBACK_COMMENT_MAX_LENGTH).toBe(500)
    expect(screen.getByTestId('feedback-comment-counter').textContent).toBe('0/500')
  })

  it('пустой и пробельный текст отправить нельзя', () => {
    const { input, submit, onSubmit } = renderBox()

    expect(submit.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '   \n ' } })
    expect(submit.disabled).toBe(true)
    fireEvent.submit(input.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('«Надіслати» отдаёт текст без пробелов по краям', () => {
    const { input, submit, onSubmit } = renderBox()

    fireEvent.change(input, { target: { value: '  не той відділ  ' } })
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('не той відділ')
  })

  it('текст длиннее лимита обрезается и в поле, и в отправке', () => {
    const { input, submit, onSubmit } = renderBox()

    fireEvent.change(input, { target: { value: 'а'.repeat(FEEDBACK_COMMENT_MAX_LENGTH + 120) } })

    expect(input.value).toHaveLength(FEEDBACK_COMMENT_MAX_LENGTH)
    expect(screen.getByTestId('feedback-comment-counter').textContent).toBe('500/500')
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith('а'.repeat(FEEDBACK_COMMENT_MAX_LENGTH))
  })

  it('«Пропустити» закрывает без отправки', () => {
    const { input, skip, onSkip, onSubmit } = renderBox()

    fireEvent.change(input, { target: { value: 'не та дата' } })
    fireEvent.click(skip)

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('пока комментарий едет на сервер, форма заперта, но поле не теряет фокус', () => {
    const { input, submit, skip, onSubmit } = renderBox({ sending: true })

    // readOnly, а не disabled: заблокированное поле выбросило бы фокус в body.
    expect(input.readOnly).toBe(true)
    expect(input.disabled).toBe(false)
    expect(input.closest('form')?.getAttribute('aria-busy')).toBe('true')
    expect(submit.disabled).toBe(true)
    expect(skip.disabled).toBe(true)
    fireEvent.submit(input.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('FeedbackCommentBox: видимость, фокус, клавиатура', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'matchMedia')
    vi.restoreAllMocks()
  })

  it('при открытии прокручивает форму в видимую область «ближайшим» способом', () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    const { input } = renderBox({ scrollMarginBottom: 180 })
    const form = input.closest('form')!

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(form)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
  })

  it('на десктопе ставит фокус в поле', () => {
    const { input } = renderBox()

    expect(document.activeElement).toBe(input)
  })

  it('без focusOnOpen (узкая раскладка) фокус не ставит — клавиатура не выезжает', () => {
    const { input } = renderBox({ focusOnOpen: false })

    expect(document.activeElement).not.toBe(input)
  })

  it('на сенсорном вводе фокус не ставит даже на широком экране', () => {
    // jsdom `matchMedia` не знает — ставим свой на время теста.
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    const { input } = renderBox()

    expect(document.activeElement).not.toBe(input)
  })

  it('пока 👎 не подтверждён, писать можно, отправить нельзя', () => {
    const { input, submit, onSubmit } = renderBox({ ratingPending: true })

    fireEvent.change(input, { target: { value: 'не той відділ' } })
    expect(input.value).toBe('не той відділ')
    expect(submit.disabled).toBe(true)
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    fireEvent.submit(input.closest('form')!)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Ctrl/Cmd+Enter отправляет, Esc закрывает', () => {
    const { input, onSubmit, onSkip } = renderBox()

    fireEvent.change(input, { target: { value: 'не та дата' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true })
    expect(onSubmit).toHaveBeenCalledWith('не та дата')
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('счётчик связан с полем через aria-describedby', () => {
    const { input } = renderBox()
    const counter = screen.getByTestId('feedback-comment-counter')

    expect(counter.id).not.toBe('')
    expect(input.getAttribute('aria-describedby')).toBe(counter.id)
  })

  it('обрезка по лимиту не рвёт эмодзи пополам', () => {
    const { input, submit, onSubmit } = renderBox()
    const base = 'а'.repeat(FEEDBACK_COMMENT_MAX_LENGTH - 1)

    // Эмодзи — две UTF-16 единицы: на границе остался бы одиночный суррогат.
    fireEvent.change(input, { target: { value: `${base}😀` } })

    expect(input.value).toBe(base)
    fireEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith(base)
  })

  it('после неудачной отправки возвращает фокус в поле', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()
    const { rerender } = render(
      <FeedbackCommentBox messageId={42} sending onSubmit={onSubmit} onSkip={onSkip} />
    )
    const input = screen.getByLabelText(
      'pages.aiAssistant.feedbackCommentLabel'
    ) as HTMLTextAreaElement
    // Клик по «Надіслати» увёл фокус на кнопку, та заперлась — фокус в body.
    input.blur()
    expect(document.activeElement).toBe(document.body)

    rerender(
      <FeedbackCommentBox messageId={42} sending={false} onSubmit={onSubmit} onSkip={onSkip} />
    )

    expect(document.activeElement).toBe(input)
  })
})

describe('FeedbackCommentSent', () => {
  it('забирает потерянный фокус, чтобы скринридер прочёл «Дякуємо, передано»', () => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    render(<FeedbackCommentSent messageId={42} />)
    const note = screen.getByTestId('feedback-comment-sent-42')

    expect(note.getAttribute('role')).toBe('status')
    expect(note.textContent).toBe('pages.aiAssistant.feedbackCommentSent')
    expect(document.activeElement).toBe(note)
  })

  it('не отбирает фокус, если оператор уже в другом поле', () => {
    const other = document.createElement('input')
    document.body.appendChild(other)
    other.focus()

    render(<FeedbackCommentSent messageId={42} />)

    expect(document.activeElement).toBe(other)
    other.remove()
  })
})
