/**
 * Контент-менеджер сайта доходит до вкладки «Сайт» (17-40b, r2).
 *
 * Вход в админку сайта живёт на вкладке настроек кредитного модуля. Роль
 * «Контент-менеджер сайту» (17-40a) несёт только `site.content.edit`, без
 * единого кредитного права и без `manage_settings`. Значит и маршрут
 * `credit/settings`, и пункт меню «Настройки» обязаны пускать по праву на
 * контент сайта — иначе человек упрётся в 403 страницы и не увидит пункта, а
 * экранные тесты вкладки этого не заметят: они рендерят страницу напрямую,
 * мимо `PermissionRoute` и меню.
 *
 * Страж читает ИСХОДНИКИ (глоб Vite с `?raw`, как соседние стражи маршрутов:
 * средства Node уронили бы `tsc -b`), вынимает список `requiredPermissions` и
 * режим у блока маршрута и у пункта меню, переводит идентификаторы
 * `PERMISSIONS.X.Y` в значения тем же объектом, что и приложение, и решает
 * доступ так же, как `PermissionRoute` и меню: `mode="any"` — хватает одного
 * права. Комментарии срезаются: закомментированное при отладке право — самый
 * вероятный способ снять его молча.
 *
 * ⚠️ ПРЕДЕЛ. Решение доступа здесь повторено («any» = some, иначе every), а не
 * вызвано: `PermissionRoute` и фильтр меню — хуки внутри компонентов. Если их
 * правило поменяется, этот страж нужно поправить вместе с ними.
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

function blockAt(source: string, marker: string): string {
  return stripComments(rawBlock(source, marker))
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

/**
 * Список прав и режим. `open` — начало списка (`requiredPermissions={[` у
 * маршрута, `requiredPermissions: [` у меню), `anyMode` — литерал режима.
 */
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
  return gateOf(blockAt(source, ROUTE_MARKER), 'requiredPermissions={[', /mode="any"/)
}

function menuGate(source: string = MENU_SOURCE): Gate {
  return gateOf(blockAt(source, MENU_MARKER), 'requiredPermissions: [', /mode: 'any'/)
}

/** Так же, как `PermissionRoute` и фильтр меню. */
function lets(gate: Gate, held: string[]): boolean {
  if (gate.permissions.length === 0) return false
  return gate.anyMode
    ? gate.permissions.some((p) => held.includes(p))
    : gate.permissions.every((p) => held.includes(p))
}

const EDIT_ONLY = [PERMISSIONS.SITE.CONTENT_EDIT]
const PUBLISH_ONLY = [PERMISSIONS.SITE.CONTENT_PUBLISH]

describe('credit/settings пускает по праву на контент сайта', () => {
  it.each([
    ['маршрут', routeGate],
    ['пункт меню', menuGate],
  ])('%s: хватает одного site.content.edit', (_where, gate) => {
    expect(lets(gate(), EDIT_ONLY)).toBe(true)
  })

  it.each([
    ['маршрут', routeGate],
    ['пункт меню', menuGate],
  ])('%s: хватает одного site.content.publish', (_where, gate) => {
    expect(lets(gate(), PUBLISH_ONLY)).toBe(true)
  })

  it.each([
    ['маршрут', routeGate],
    ['пункт меню', menuGate],
  ])('%s: без единого права не пускает — страж различает', (_where, gate) => {
    // Контроль: «пускает всех» тоже дало бы true выше.
    expect(lets(gate(), [])).toBe(false)
    expect(lets(gate(), ['use_ai_assistant'])).toBe(false)
  })

  it.each([
    ['маршрут', routeGate],
    ['пункт меню', menuGate],
  ])('%s: прежние входы (кредитные права и manage_settings) на месте', (_where, gate) => {
    const { permissions } = gate()
    expect(permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.CREDIT.PARAMETERS_VIEW,
        PERMISSIONS.CREDIT.PRODUCTS_VIEW,
        PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
        PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
      ])
    )
  })

  describe('отрицательные контроли (копии текста в памяти)', () => {
    /** Правка только внутри блока `marker`; остальной файл не трогается. */
    function mutateBlock(source: string, marker: string, edit: (body: string) => string) {
      const whole = rawBlock(source, marker)
      const mutated = source.replace(whole, edit(whole))
      expect(mutated, 'контроль не построен: текст не изменился').not.toBe(source)
      return mutated
    }

    it.each([
      ['маршрут', ROUTES_SOURCE, ROUTE_MARKER, routeGate],
      ['пункт меню', MENU_SOURCE, MENU_MARKER, menuGate],
    ] as Array<[string, string, string, (source?: string) => Gate]>)(
      '%s без PERMISSIONS.SITE.CONTENT_EDIT не пускает контент-менеджера',
      (_where, source, marker, gate) => {
        const mutated = mutateBlock(source, marker, (body) =>
          body.replace('PERMISSIONS.SITE.CONTENT_EDIT,', '')
        )
        expect(lets(gate(mutated), EDIT_ONLY)).toBe(false)
      }
    )

    it.each([
      ['маршрут', ROUTES_SOURCE, ROUTE_MARKER, routeGate],
      ['пункт меню', MENU_SOURCE, MENU_MARKER, menuGate],
    ] as Array<[string, string, string, (source?: string) => Gate]>)(
      '%s с ЗАКОММЕНТИРОВАННЫМ правом краснит так же, как без него',
      (_where, source, marker, gate) => {
        const mutated = mutateBlock(source, marker, (body) =>
          body.replace('PERMISSIONS.SITE.CONTENT_EDIT,', '// PERMISSIONS.SITE.CONTENT_EDIT,')
        )
        expect(lets(gate(mutated), EDIT_ONLY)).toBe(false)
      }
    )

    it.each([
      ['маршрут', ROUTES_SOURCE, ROUTE_MARKER, routeGate, 'mode="any"', 'mode="all"'],
      ['пункт меню', MENU_SOURCE, MENU_MARKER, menuGate, "mode: 'any'", "mode: 'all'"],
    ] as Array<[string, string, string, (source?: string) => Gate, string, string]>)(
      '%s в режиме «все права» не пускает контент-менеджера',
      (_where, source, marker, gate, any, all) => {
        const mutated = mutateBlock(source, marker, (body) => body.replace(any, all))
        expect(lets(gate(mutated), EDIT_ONLY)).toBe(false)
      }
    )
  })
})
