/**
 * Маркетолог доходит до вкладки «Постбеки партнерам» (18-13d-a1, AC-a2).
 *
 * Правила постбеков живут вкладкой настроек кредитного раздела. Маркетолог
 * несёт право чтения постбеков и может не нести ни одного кредитного права и
 * `manage_settings`. Значит три места обязаны пускать его по этому праву:
 * маршрут `credit/settings`, пункт меню «Настройки» и вход в настройки при
 * ВЫКЛЮЧЕННОМ разделе (`keepsSiteEntry`): постбеки модуль шлёт и тогда —
 * рубильник раздела прячет экраны, не события (Р-18-13d-4). Экранные тесты
 * вкладки этого не заметят: они рендерят страницу мимо `PermissionRoute` и меню.
 *
 * Страж читает ИСХОДНИКИ (глоб Vite с `?raw`, как `creditSettingsSiteAccess`:
 * средства Node уронили бы `tsc -b`), вынимает списки прав и режим у трёх
 * мест, переводит `PERMISSIONS.X.Y` в значения тем же объектом, что и
 * приложение, и решает доступ так же, как они: «any» — хватает одного права.
 * Комментарии срезаются: закомментированное при отладке право — самый
 * вероятный способ снять его молча.
 *
 * ⚠️ ПРЕДЕЛ. Решение доступа повторено, а не вызвано (хуки внутри компонентов).
 * Поменяется правило `PermissionRoute` или фильтра меню — поправить и здесь.
 */
import { describe, it, expect } from 'vitest'
import { PERMISSIONS } from '@/constants/permissions'

function readSource(found: Record<string, string>, path: string): string {
  const text = Object.values(found)[0]
  // Глоб, не нашедший файл, дал бы пустую строку и зелёный тест ни о чём.
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error(`глоб потерял предмет: ${path} не прочитан`)
  }
  return text
}

const ROUTES_SOURCE = readSource(
  import.meta.glob('../../../routes/index.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
  'src/routes/index.tsx'
)

const MENU_SOURCE = readSource(
  import.meta.glob('../../../components/layout/DashboardLayout.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
  'src/components/layout/DashboardLayout.tsx'
)

const ROUTE_MARKER = "path: 'credit/settings'"
const MENU_MARKER = "path: '/dashboard/credit/settings'"
const KEEP_MARKER = 'const keepsSiteEntry = hasPermission('

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** Сырой текст объекта от его открывающей `{` до ПАРНОЙ ей закрывающей. */
function rawBlock(source: string, marker: string): string {
  const at = source.indexOf(marker)
  if (at === -1) throw new Error(`блок не найден: ${marker}`)
  const open = source.lastIndexOf('{', at)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  throw new Error(`блок не закрыт: ${marker}`)
}

/** Сырой текст вызова `hasPermission(` до парной закрывающей скобки. */
function rawCall(source: string, marker: string): string {
  const at = source.indexOf(marker)
  if (at === -1) throw new Error(`вызов не найден: ${marker}`)
  const open = at + marker.length - 1
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1
    else if (source[i] === ')') {
      depth -= 1
      if (depth === 0) return source.slice(at, i + 1)
    }
  }
  throw new Error(`вызов не закрыт: ${marker}`)
}

/** Значение `PERMISSIONS.<CATEGORY>.<KEY>`; неизвестный идентификатор — отказ. */
function resolve(identifier: string): string {
  const [, category, key] = identifier.split('.')
  const group = (PERMISSIONS as unknown as Record<string, Record<string, string>>)[category]
  const value = group?.[key]
  if (typeof value !== 'string') throw new Error(`неизвестное право: ${identifier}`)
  return value
}

interface Gate {
  permissions: string[]
  anyMode: boolean
}

function gateOf(body: string, open: string, anyLiteral: RegExp): Gate {
  const start = body.indexOf(open)
  if (start === -1) return { permissions: [], anyMode: false }
  const end = body.indexOf(']', start + open.length)
  const list = body.slice(start + open.length, end)
  const permissions = [...list.matchAll(/PERMISSIONS\.[A-Z0-9_]+\.[A-Z0-9_]+/g)].map((m) =>
    resolve(m[0])
  )
  return { permissions, anyMode: anyLiteral.test(body) }
}

function routeGate(source: string = ROUTES_SOURCE): Gate {
  const body = stripComments(rawBlock(source, ROUTE_MARKER))
  return gateOf(body, 'requiredPermissions={[', /mode="any"/)
}

function menuGate(source: string = MENU_SOURCE): Gate {
  const body = stripComments(rawBlock(source, MENU_MARKER))
  return gateOf(body, 'requiredPermissions: [', /mode: 'any'/)
}

/** Вход в настройки при выключенном разделе: `hasPermission(undefined, [...], 'any')`. */
function keepGate(source: string = MENU_SOURCE): Gate {
  const call = stripComments(rawCall(source, KEEP_MARKER))
  return gateOf(call, '[', /\]\s*,\s*'any'\s*\)$/)
}

/** Так же, как `PermissionRoute` и фильтр меню. */
function lets(gate: Gate, held: string[]): boolean {
  if (gate.permissions.length === 0) return false
  return gate.anyMode
    ? gate.permissions.some((p) => held.includes(p))
    : gate.permissions.every((p) => held.includes(p))
}

const MARKETER = [PERMISSIONS.CREDIT.POSTBACKS_VIEW]

const PLACES: Array<[string, string, string, (source?: string) => Gate]> = [
  ['маршрут', ROUTES_SOURCE, ROUTE_MARKER, routeGate],
  ['пункт меню', MENU_SOURCE, MENU_MARKER, menuGate],
  ['вход при выключенном разделе', MENU_SOURCE, KEEP_MARKER, keepGate],
]

describe('credit/settings пускает по праву чтения постбеков', () => {
  it.each(PLACES)('%s: хватает одного права чтения постбеков', (_where, _s, _m, gate) => {
    expect(lets(gate(), MARKETER)).toBe(true)
  })

  it.each(PLACES)('%s: без единого права не пускает — страж различает', (_where, _s, _m, gate) => {
    expect(lets(gate(), [])).toBe(false)
    expect(lets(gate(), ['use_ai_assistant'])).toBe(false)
    // Право ЗАПИСИ само по себе не вход: читать список без права чтения нельзя.
    expect(lets(gate(), [PERMISSIONS.CREDIT.POSTBACKS_WRITE])).toBe(false)
  })

  it.each(PLACES)('%s: прежние входы на месте', (_where, _s, _m, gate) => {
    expect(gate().permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        PERMISSIONS.SITE.CONTENT_EDIT,
        PERMISSIONS.SITE.CONTENT_PUBLISH,
      ])
    )
  })

  it.each([
    ['маршрут', routeGate],
    ['пункт меню', menuGate],
  ] as Array<[string, () => Gate]>)('%s: кредитные входы на месте', (_where, gate) => {
    expect(gate().permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.CREDIT.PARAMETERS_VIEW,
        PERMISSIONS.CREDIT.PRODUCTS_VIEW,
        PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
      ])
    )
  })

  describe('отрицательные контроли (копии текста в памяти)', () => {
    /** Правка только внутри куска `marker`; остальной файл не трогается. */
    function mutate(source: string, marker: string, edit: (body: string) => string) {
      const whole = marker === KEEP_MARKER ? rawCall(source, marker) : rawBlock(source, marker)
      const mutated = source.replace(whole, edit(whole))
      expect(mutated, 'контроль не построен: текст не изменился').not.toBe(source)
      return mutated
    }

    it.each(PLACES)('%s без права чтения постбеков не пускает маркетолога', (_w, s, m, gate) => {
      const mutated = mutate(s, m, (body) => body.replace('PERMISSIONS.CREDIT.POSTBACKS_VIEW,', ''))
      expect(lets(gate(mutated), MARKETER)).toBe(false)
    })

    it.each(PLACES)('%s с ЗАКОММЕНТИРОВАННЫМ правом краснит так же', (_w, s, m, gate) => {
      const mutated = mutate(s, m, (body) =>
        body.replace('PERMISSIONS.CREDIT.POSTBACKS_VIEW,', '// PERMISSIONS.CREDIT.POSTBACKS_VIEW,')
      )
      expect(lets(gate(mutated), MARKETER)).toBe(false)
    })

    it.each([
      ['маршрут', ROUTES_SOURCE, ROUTE_MARKER, routeGate, 'mode="any"', 'mode="all"'],
      ['пункт меню', MENU_SOURCE, MENU_MARKER, menuGate, "mode: 'any'", "mode: 'all'"],
      ['вход при выключенном разделе', MENU_SOURCE, KEEP_MARKER, keepGate, "'any'", "'all'"],
    ] as Array<[string, string, string, (source?: string) => Gate, string, string]>)(
      '%s в режиме «все права» не пускает маркетолога',
      (_w, s, m, gate, any, all) => {
        const mutated = mutate(s, m, (body) => body.replace(any, all))
        expect(lets(gate(mutated), MARKETER)).toBe(false)
      }
    )
  })
})
