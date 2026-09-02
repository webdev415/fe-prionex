/**
 * Идентификаторы должны КОПИРОВАТЬСЯ, а не просто отображаться.
 *
 * Оператор диктует UUID заявки разработчику и ключ операции в поддержку
 * провайдера. Пока значение только напечатано, его выделяют мышью — и ошибка
 * в одном символе всплывает через день переписки «такой заявки у нас нет».
 * Тест держит две вещи: кнопка копирует ИМЕННО своё значение (а не соседнее
 * и не обрезанное), и у пустого поля кнопки нет, чтобы в буфер не уезжал
 * прочерк.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreditIdentifierRows } from '../components/CreditIdentifiers'

const writeText = vi.fn(() => Promise.resolve())

beforeEach(() => {
  writeText.mockClear()
  // В jsdom `navigator.clipboard` нет вовсе, а вызов в компоненте защищён
  // `?.` — без подмены тест был бы зелёным при любой кнопке.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

const LOAN_ID = 'a249ee86-b723-483a-bbba-1ad400cc5bdd'
const APPLICATION_ID = '62386a7c-c8e6-4668-a7da-fa120472bb38'

function renderRows() {
  return render(
    <CreditIdentifierRows
      items={[
        { key: 'loan', label: 'ID кредиту', value: LOAN_ID },
        { key: 'application', label: 'ID заявки', value: APPLICATION_ID },
        { key: 'decision', label: 'ID рішення', value: null },
      ]}
    />
  )
}

describe('CreditIdentifierRows', () => {
  it('печатает значение целиком — UUID нельзя обрезать', () => {
    renderRows()
    expect(screen.getByText(LOAN_ID)).toBeInTheDocument()
    expect(screen.getByText(APPLICATION_ID)).toBeInTheDocument()
  })

  it('каждая кнопка кладёт в буфер своё значение', () => {
    renderRows()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)

    fireEvent.click(buttons[0])
    expect(writeText).toHaveBeenLastCalledWith(LOAN_ID)

    fireEvent.click(buttons[1])
    expect(writeText).toHaveBeenLastCalledWith(APPLICATION_ID)
  })

  it('у пустого идентификатора печатает прочерк и НЕ даёт кнопки', () => {
    renderRows()
    // Строка остаётся: «рішення ще немає» — это ответ оператору, а пропавшая
    // строка читается как потерянное поле, и его начинают искать.
    expect(screen.getByText('ID рішення')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    // Третьей кнопки нет — иначе в буфер уехал бы прочерк.
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
