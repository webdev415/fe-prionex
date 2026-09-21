/**
 * Простой заявки: сколько она стоит без движения.
 *
 * Проверяем не «функция считает вычитание», а три места, где она врала бы
 * незаметно: часовой пояс, расхождение часов и границы формата.
 */
import { describe, it, expect } from 'vitest'
import { formatIdle, idleMinutes } from '../idle'

const t = (key: string, options?: Record<string, unknown>) =>
  options && 'value' in options ? `${key}:${String(options.value)}` : key

describe('idleMinutes', () => {
  it('метку без часового пояса читает как UTC, а не как местное время', () => {
    // Главная ловушка: соседние источники CRM присылают время без зоны.
    // Без явного `Z` результат уехал бы на пояс браузера — на киевской
    // машине простой занизился бы на три часа, и «висит сутки» стало бы
    // «висит 21 час». Тест обязан давать один ответ в любом поясе.
    expect(idleMinutes('2026-08-31T12:00:00', new Date('2026-08-31T13:00:00Z'))).toBe(60)
  })

  it('метку со смещением считает по смещению', () => {
    expect(idleMinutes('2026-08-31T12:00:00+00:00', new Date('2026-08-31T14:30:00Z'))).toBe(150)
  })

  it('часы сервера впереди браузера — ноль, а не отрицательный простой', () => {
    expect(idleMinutes('2026-08-31T14:00:00Z', new Date('2026-08-31T13:00:00Z'))).toBe(0)
  })

  it('без метки и с мусором — null, а не ноль', () => {
    // Ноль означал бы «только что двигалась» — противоположность правде.
    expect(idleMinutes(undefined, new Date())).toBeNull()
    expect(idleMinutes('не дата', new Date())).toBeNull()
  })
})

describe('formatIdle', () => {
  it('до часа — словом, без числа', () => {
    expect(formatIdle(0, t)).toBe('credit.idle.underHour')
    expect(formatIdle(59, t)).toBe('credit.idle.underHour')
  })

  it('час и дальше — часами, с усечением вниз', () => {
    expect(formatIdle(60, t)).toBe('credit.idle.hoursShort:1')
    expect(formatIdle(119, t)).toBe('credit.idle.hoursShort:1')
    expect(formatIdle(23 * 60, t)).toBe('credit.idle.hoursShort:23')
  })

  it('сутки и дальше — днями', () => {
    expect(formatIdle(24 * 60, t)).toBe('credit.idle.daysShort:1')
    expect(formatIdle(72 * 60 - 1, t)).toBe('credit.idle.daysShort:2')
  })
})
