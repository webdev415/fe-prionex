/**
 * Форматирование денег кредитного модуля.
 *
 * Один форматтер на весь раздел вместо пяти копий с захардкоженным `'ru-RU'`:
 * русской локали в проекте нет (`SUPPORTED_LANGUAGES = ['en','uk']`), и
 * оператор-украинец видел разделители чужого языка.
 *
 * Общий `formatCurrency` из `@/lib/formatters` не подходит: там жёстко ₴, а
 * валюта кредита приходит от API (`CAD`) и на втором рынке будет другой.
 *
 * Все суммы модуля — в minor units (центы/копейки); деление на 100 живёт
 * здесь и только здесь.
 */
import i18n from 'i18next'
import { formatNumber } from '@/lib/localeFormat'

const MINOR_IN_MAJOR = 100

function currentLanguage(): string {
  return i18n.language || 'uk'
}

/** Сумма с двумя знаками: `342,00 CAD`. Пусто/undefined → «—». */
export function formatCreditMoney(minor?: number | null, currency?: string | null): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '—'
  const value = formatNumber(minor / MINOR_IN_MAJOR, currentLanguage(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${value} ${currency}` : value
}

/** Крупный агрегат без копеек: `7 500 CAD` — для карточек-счётчиков. */
export function formatCreditMinorTotal(minor: number, currency?: string | null): string {
  const value = formatNumber(Math.round(minor / MINOR_IN_MAJOR), currentLanguage(), {
    maximumFractionDigits: 0,
  })
  return currency ? `${value} ${currency}` : value
}

/** Счётчик штук с разделителями разрядов. */
export function formatCreditCount(value: number): string {
  return formatNumber(value, currentLanguage(), { maximumFractionDigits: 0 })
}

/** Доля 0..1 в проценты: `100 %`. */
export function formatCreditRate(rate?: number | null, digits = 0): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—'
  return `${formatNumber(rate * 100, currentLanguage(), { maximumFractionDigits: digits })} %`
}

/**
 * Процент, который сервис отдаёт то числом, то decimal-строкой («0.70»).
 * Разбор в одном месте: `.toFixed()` на строке роняет всю страницу — так и
 * случилось на живой заявке 29.08.
 */
export function formatCreditPercent(value?: string | number | null, digits = 2): string | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value)
  if (Number.isNaN(numeric)) return null
  return formatNumber(numeric, currentLanguage(), { maximumFractionDigits: digits })
}
