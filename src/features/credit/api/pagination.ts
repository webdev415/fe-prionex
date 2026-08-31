/**
 * Постраничная навигация раздела.
 *
 * Контракт модуля описывает `cursor` как НЕПРОЗРАЧНУЮ строку из `next_cursor`
 * предыдущего ответа. Реализация сервиса сейчас кладёт туда числовой offset
 * (`_parse_offset` в routers/internal.py), и это единственное, что позволяет
 * дать оператору номера страниц вместо «Далі» без возврата назад.
 *
 * Зависимость сделана громкой в двух местах:
 *   • здесь — `cursorForPage` строит курсор арифметикой и это написано прямым
 *     текстом, а не спрятано в компоненте;
 *   • на стороне сервиса — тестом, который падает, если формат курсора
 *     перестанет быть числовым offset'ом (service/tests/test_operator_api.py).
 * Без второго пункта смена формата курсора тихо сломала бы страницы 2+.
 *
 * Если сервис однажды начнёт отдавать непрозрачный курсор, здесь останется
 * `hasNextPage` — навигация выродится в «вперёд», но не соврёт.
 */
import { DEFAULT_PAGE_SIZE_OPTIONS } from '@/components/ui/Pagination'

export const CREDIT_PAGE_SIZE_OPTIONS = DEFAULT_PAGE_SIZE_OPTIONS
export const CREDIT_DEFAULT_PAGE_SIZE = 20

/** Курсор для запрошенной страницы (1-indexed). Первая страница — без курсора. */
export function cursorForPage(page: number, pageSize: number): string | undefined {
  if (page <= 1) return undefined
  return String((page - 1) * pageSize)
}

/** Сколько всего страниц. Ноль записей — одна пустая страница, а не ноль. */
export function totalPagesOf(total: number | undefined, pageSize: number): number {
  if (!total || total <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Разбор номера страницы из URL: мусор и отрицательные — первая страница. */
export function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

/**
 * Размер страницы из URL. Чужое значение приводим к ближайшему допустимому:
 * выпадающий список умеет выбирать только из своего набора, и произвольное
 * число из адреса осталось бы в нём невыбранным.
 */
export function parsePageSize(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return CREDIT_PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : CREDIT_DEFAULT_PAGE_SIZE
}
