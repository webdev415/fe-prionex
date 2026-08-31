/**
 * Форматирование денег раздела.
 *
 * Проверяется то, что уже ломалось: валюта должна браться из ответа (в модуле
 * CAD, а общий formatCurrency CRM жёстко печатает ₴), пустые значения не
 * должны превращаться в «0,00», а процент приходит то числом, то
 * decimal-строкой — на строке `.toFixed()` ронял всю вкладку.
 */
import { describe, it, expect, afterEach } from 'vitest'
import i18n from 'i18next'
import {
  formatCreditCount,
  formatCreditMinorTotal,
  formatCreditMoney,
  formatCreditPercent,
  formatCreditRate,
} from '../money'

/**
 * Неразрывные пробелы Intl мешают сравнению, но не смыслу.
 *
 * Ожидания ниже записаны в АНГЛИЙСКОМ формате, потому что мок i18next в
 * src/test/setup.ts фиксирует `language: 'en'`. Это не случайность, а рабочая
 * ловушка: раньше форматтеры раздела печатали `'ru-RU'` жёстко, и при языке
 * `en` всё равно выдавали «342,00». Тест на «342.00» краснеет ровно тогда,
 * когда локаль снова захардкодят.
 */
const norm = (value: string | null) => value?.replace(/\s/g, ' ') ?? null

/**
 * Переключение языка в тесте.
 *
 * `intlLocaleForUiLanguage` схлопывает всё, кроме `uk`, в `en-US`, поэтому
 * хардкод любой третьей локали (например прежнего `'ru-RU'`) выглядит как
 * английский и НЕ ловится сравнением одного языка. Ловит только разница
 * между `uk` и `en`: при захардкоженной локали оба вызова дадут одно и то же.
 */
function withLanguage<T>(language: string, run: () => T): T {
  const previous = i18n.language
  ;(i18n as unknown as { language: string }).language = language
  try {
    return run()
  } finally {
    ;(i18n as unknown as { language: string }).language = previous
  }
}

afterEach(() => {
  ;(i18n as unknown as { language: string }).language = 'en'
})

describe('локаль форматирования', () => {
  it('следует языку интерфейса, а не зашита в код', () => {
    const en = norm(withLanguage('en', () => formatCreditMoney(34200, 'CAD')))
    const uk = norm(withLanguage('uk', () => formatCreditMoney(34200, 'CAD')))
    expect(en).toBe('342.00 CAD')
    expect(uk).toBe('342,00 CAD')
    // Главное: значения РАЗНЫЕ. Совпали — значит локаль захардкожена.
    expect(en).not.toBe(uk)
  })

  it('разделитель разрядов тоже следует языку', () => {
    const en = norm(withLanguage('en', () => formatCreditMinorTotal(750000, 'CAD')))
    const uk = norm(withLanguage('uk', () => formatCreditMinorTotal(750000, 'CAD')))
    expect(en).not.toBe(uk)
  })
})

describe('formatCreditMoney', () => {
  it('делит minor units на сто и печатает валюту из ответа', () => {
    expect(norm(formatCreditMoney(34200, 'CAD'))).toBe('342.00 CAD')
  })

  it('не подставляет свою валюту, когда её не передали', () => {
    expect(norm(formatCreditMoney(34200))).toBe('342.00')
  })

  it('работает с любой валютой, а не только с гривной', () => {
    expect(norm(formatCreditMoney(1000, 'USD'))).toBe('10.00 USD')
  })

  it('пусто — это прочерк, а не ноль', () => {
    // «0,00 CAD» на месте неизвестного долга оператор прочтёт как «долга нет».
    expect(formatCreditMoney(null, 'CAD')).toBe('—')
    expect(formatCreditMoney(undefined, 'CAD')).toBe('—')
  })

  it('ноль остаётся нулём', () => {
    expect(norm(formatCreditMoney(0, 'CAD'))).toBe('0.00 CAD')
  })
})

describe('formatCreditMinorTotal', () => {
  it('крупный агрегат печатается без копеек', () => {
    expect(norm(formatCreditMinorTotal(750000, 'CAD'))).toBe('7,500 CAD')
  })
})

describe('formatCreditCount', () => {
  it('разделяет разряды', () => {
    expect(norm(formatCreditCount(1776))).toBe('1,776')
  })
})

describe('formatCreditRate', () => {
  it('доля 0..1 печатается процентами', () => {
    expect(norm(formatCreditRate(1))).toBe('100 %')
    expect(norm(formatCreditRate(0.87))).toBe('87 %')
  })

  it('пусто — прочерк', () => {
    expect(formatCreditRate(undefined)).toBe('—')
  })
})

describe('formatCreditPercent', () => {
  it('принимает decimal-строку, как её отдаёт модуль', () => {
    // Ровно та форма, на которой падала вкладка «Анкета».
    expect(norm(formatCreditPercent('75.26'))).toBe('75.26')
  })

  it('принимает и число', () => {
    expect(norm(formatCreditPercent(10))).toBe('10')
  })

  it('на мусоре возвращает null, а не NaN на экране', () => {
    expect(formatCreditPercent('не число')).toBeNull()
    expect(formatCreditPercent(null)).toBeNull()
    expect(formatCreditPercent('')).toBeNull()
  })
})
