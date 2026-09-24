/**
 * Галочка «скопировано» не должна переживать кнопку.
 *
 * Кнопка показывает галочку 1,5 с и гасит её таймером. Пока таймер не
 * снимался, он стрелял setState уже после размонтирования — а в CI позже
 * сноса jsdom: «ReferenceError: window is not defined» из
 * `CreditCardHeader.tsx` ронял прогон с кодом 1 при всех 6735 зелёных тестах
 * (fe PR #283, run 1578). Ошибка плавающая: проявляется, только если файл
 * тестов успел закончиться раньше 1,5 с после клика.
 *
 * Поэтому тест меряет не «ошибки не было» — в React 19 setState у
 * размонтированного компонента молчит, и такой тест зеленел бы и на старом
 * коде, — а то, что после размонтирования не осталось ни одного таймера.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CopyButton } from '../components/CreditCardHeader'
import { Icons } from '@/lib/icons'

const LABEL = 'Копіювати'

// Эталонная разметка обеих иконок: сравниваем с настоящими, без подмены
// модуля иконок — иначе тест проверял бы свою заглушку.
function iconMarkup(icon: React.ReactElement) {
  const { container, unmount } = render(icon)
  const html = container.innerHTML
  unmount()
  return html
}

let COPY_ICON = ''
let COPIED_ICON = ''

beforeEach(() => {
  COPY_ICON = iconMarkup(<Icons.Copy size={15} />)
  COPIED_ICON = iconMarkup(<Icons.CheckmarkBadge02 size={15} />)
  // Подменяем только таймеры кнопки: Date и прочее остаются настоящими.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

function renderButton() {
  const view = render(<CopyButton value="a249ee86-b723-483a-bbba-1ad400cc5bdd" label={LABEL} />)
  return { ...view, button: screen.getByRole('button', { name: LABEL }) }
}

describe('CopyButton', () => {
  it('размонтирование до 1,5 с снимает таймер — стрелять в мёртвое окружение нечему', () => {
    const { button, unmount } = renderButton()
    expect(vi.getTimerCount()).toBe(0)

    fireEvent.click(button)
    // Контроль: таймер действительно поставлен, иначе ноль ниже ничего не доказывал бы.
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)

    const consoleError = vi.spyOn(console, 'error')
    vi.advanceTimersByTime(1500)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('галочка появляется по клику и сбрасывается ровно через 1500 мс', () => {
    const { button } = renderButton()
    expect(button.innerHTML).toBe(COPY_ICON)

    fireEvent.click(button)
    expect(button.innerHTML).toBe(COPIED_ICON)

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(button.innerHTML).toBe(COPIED_ICON)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(button.innerHTML).toBe(COPY_ICON)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('повторный клик заменяет таймер, а не копит второй', () => {
    const { button } = renderButton()

    fireEvent.click(button)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    fireEvent.click(button)
    expect(vi.getTimerCount()).toBe(1)

    // Галочка держится 1,5 с от ПОСЛЕДНЕГО клика: прежний таймер снят и не
    // гасит её через 500 мс после второго нажатия.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(button.innerHTML).toBe(COPIED_ICON)

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(button.innerHTML).toBe(COPY_ICON)
  })
})
