/**
 * Альтернатива `mode="any"` + системное право не снимается втихую.
 *
 * Шесть кредитных маршрутов пускают либо по кредитному праву, либо по
 * `PERMISSIONS.SYSTEM.MANAGE_SETTINGS` — это решение доступа (открытый вопрос
 * Q-FE-03), а не временная затычка, и менять его вправе владелец, а не уборка
 * соседнего кода. Ближайший существующий страж `creditRoutesGated.test.ts`
 * этого не видит: в нём ноль вхождений системного права и ноль упоминаний
 * режима, он проверяет только калитку `<CreditSectionGate>`. Значит снятие всех
 * шести альтернатив прошло бы CI зелёным.
 *
 * Тело блока маршрута ограничивается ПАРНОЙ фигурной скобкой, а не «до
 * следующего path:» — иначе последний блок таблицы тянул бы хвост файла и
 * засчитывал себе чужие `mode="any"` и системные права из соседних маршрутов.
 * Перед сверкой из тела срезаются комментарии: закомментированная при отладке
 * строка — самый вероятный способ снять альтернативу молча. Срезание безопасно:
 * вхождений `://` в файле маршрутов ноль (замер базы), то есть `//` встречается
 * только как начало комментария.
 *
 * ⚠️ ПРЕДЕЛ. Страж утверждает наличие альтернативы и режима, но НЕ утверждает,
 * какое именно кредитное право стоит рядом: подмена одного права W1 на другое
 * проходит зелёной. Привязка «маршрут → право» — решение доступа Q-FE-03, а не
 * дело этого стража. Пункты меню в `DashboardLayout.tsx` несут ту же пару в
 * шести местах и здесь не проверяются вовсе.
 *
 * Исходник читается глобом Vite с `?raw` — тем же приёмом, что соседний страж;
 * средства файловой системы Node уронили бы `tsc -b`.
 */
import { describe, it, expect } from 'vitest'

const ROUTES_PATH = '../../../routes/index.tsx'

const ROUTES_SOURCE: string = (() => {
  const found = Object.values(
    import.meta.glob('../../../routes/index.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
  )[0]
  // Глоб, не нашедший файл, дал бы `undefined`, разбор пустой строки и зелёный
  // тест на пустом множестве — отказ обязан прозвучать здесь, а не стеком
  // TypeError в случайном тесте.
  if (typeof found !== 'string' || found.length === 0) {
    throw new Error(`глоб потерял предмет: ${ROUTES_PATH} не прочитан`)
  }
  return found
})()

/**
 * Снят в общем pre-branch receipt на selected exact base
 * 8f654086e7875d0b5c6f8298e017dcfd343f422d командой
 *   git show 8f654086e7875d0b5c6f8298e017dcfd343f422d:src/routes/index.tsx | grep -c "path: 'credit/"
 * Равенство, а не «>=»: маршрут добавляют И удаляют, обе стороны обязаны
 * заметить. От HEAD задачи число НЕ пересчитывается.
 *
 * ПРОЦЕДУРА ЛЕГАЛЬНОГО ПЕРЕСЧЁТА (чтобы красное в чужом PR не толкало к
 * удалению теста): добавив или убрав кредитный маршрут, пересчитайте число той
 * же командой на СВОЕЙ базе, поправьте константу ТЕМ ЖЕ коммитом, что и
 * маршрут, и назовите новое число в описании PR. Новый маршрут обязан нести
 * `mode="any"` и системное право — это проверяют два теста ниже, и они краснеют
 * отдельно от счёта.
 */
const CREDIT_ROUTES_BASELINE = 6

/** Полный идентификатор системного права — альтернатива в `requiredPermissions`. */
const ALTERNATIVE = 'PERMISSIONS.SYSTEM.MANAGE_SETTINGS'

/** Режим, при котором достаточно любого права из списка. */
const ANY_MODE = 'mode="any"'

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** Тело объекта-маршрута: от его открывающей `{` до ПАРНОЙ ей закрывающей. */
function blockAt(source: string, markerIndex: number): string {
  const open = source.lastIndexOf('{', markerIndex)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return source.slice(open)
}

/**
 * ⚠️ ТОЛЬКО со слешем. Редирект без слеша (`<Navigate>` на список заявок) в
 * baseline команды нормы не входит: она считает `path: 'credit/`. Сосед
 * `creditRoutesGated` фильтрует иначе и намеренно получает на один больше —
 * копировать его фильтр значит получить 7 при baseline 6 и красное не по делу.
 */
function routeBlocks(source: string): Array<{ path: string; index: number }> {
  return [...source.matchAll(/path: '([^']*)'/g)].map((match) => ({
    path: match[1],
    index: match.index ?? 0,
  }))
}

function creditRoutes(source: string = ROUTES_SOURCE): Array<{ path: string; body: string }> {
  return routeBlocks(source)
    .filter((route) => route.path.startsWith('credit/'))
    .map((route) => ({ path: route.path, body: stripComments(blockAt(source, route.index)) }))
}

/** Содержимое `requiredPermissions={[ … ]}` блока — список, а не весь блок. */
function requiredPermissionsOf(body: string): string {
  const start = body.indexOf('requiredPermissions={[')
  if (start === -1) return ''
  const end = body.indexOf(']}', start)
  return end === -1 ? '' : body.slice(start, end)
}

/** Пути кредитных маршрутов без альтернативы. Общий предикат для знака и контролей. */
function withoutAlternative(source: string = ROUTES_SOURCE): string[] {
  return creditRoutes(source)
    .filter((route) => !requiredPermissionsOf(route.body).includes(ALTERNATIVE))
    .map((route) => route.path)
}

/** Пути кредитных маршрутов без режима «любое из перечисленных прав». */
function withoutAnyMode(source: string = ROUTES_SOURCE): string[] {
  return creditRoutes(source)
    .filter((route) => !route.body.includes(ANY_MODE))
    .map((route) => route.path)
}

/** Корректный кредитный маршрут — фикстура для контроля счёта. */
const WELL_FORMED_ROUTE = `{
        path: 'credit/archive',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.CREDIT.LOANS_VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            <CreditSectionGate>{withSuspense(<CreditLoansPage />)}</CreditSectionGate>
          </PermissionRoute>
        ),
      },
      {`

describe('T-FE-2-05 альтернатива доступа у кредитных маршрутов', () => {
  it('тело каждого блока ограничено своим маршрутом', () => {
    // Контроль разбора: блок, утянувший хвост файла, засчитал бы себе чужие
    // mode="any" и системные права — и страж стал бы формальностью.
    const overreaching = creditRoutes()
      .filter((route) => (route.body.match(/path: '/g) ?? []).length !== 1)
      .map((route) => route.path)
    expect(overreaching, `блок тянет чужой хвост: ${overreaching.join(', ')}`).toEqual([])
  })

  it('число кредитных маршрутов равно baseline selected base', () => {
    const count = creditRoutes().length
    // prettier-ignore
    expect(count, `число credit routes ${count} ≠ baseline ${CREDIT_ROUTES_BASELINE}`).toBe(CREDIT_ROUTES_BASELINE)
  })

  it('у каждого стоит режим «любое из перечисленных прав»', () => {
    const bad = withoutAnyMode()
    expect(bad, `${bad.join(', ')}: mode="any" снят`).toEqual([])
  })

  it('у каждого в requiredPermissions есть PERMISSIONS.SYSTEM.MANAGE_SETTINGS', () => {
    // Полный идентификатор, а не подстрока имени: PERMISSIONS.TAGS.MANAGE_SETTINGS
    // — другое право (значение `manage_tag_settings`), и подстрока приняла бы
    // его за системное.
    const bad = withoutAlternative()
    expect(bad, `${bad.join(', ')}: альтернатива MANAGE_SETTINGS снята`).toEqual([])
  })

  describe('отрицательные контроли (копии текста в памяти)', () => {
    it('снятая альтернатива у одного маршрута краснит', () => {
      const mutated = ROUTES_SOURCE.replace(
        `PERMISSIONS.CREDIT.LOANS_VIEW,\n              ${ALTERNATIVE},`,
        'PERMISSIONS.CREDIT.LOANS_VIEW,'
      )
      expect(mutated, 'контроль не построен: альтернатива не снята').not.toBe(ROUTES_SOURCE)
      expect(
        withoutAlternative(mutated),
        'контроль не покраснел: страж принял маршрут без альтернативы'
      ).not.toEqual([])
    })

    it('ЗАКОММЕНТИРОВАННАЯ альтернатива краснит так же, как снятая', () => {
      // Самый вероятный способ снять её молча: закомментировать при отладке и
      // забыть. По сырому тексту такая строка неотличима от живой.
      const mutated = ROUTES_SOURCE.replace(`${ALTERNATIVE},`, `// ${ALTERNATIVE},`)
      expect(mutated, 'контроль не построен: строка не закомментирована').not.toBe(ROUTES_SOURCE)
      expect(
        withoutAlternative(mutated),
        'контроль не покраснел: страж засчитал закомментированную альтернативу как живую'
      ).not.toEqual([])
    })

    it('снятый режим «любое из прав» у одного маршрута краснит', () => {
      const mutated = ROUTES_SOURCE.replace(ANY_MODE, 'mode="all"')
      expect(mutated, 'контроль не построен: режим не снят').not.toBe(ROUTES_SOURCE)
      expect(
        withoutAnyMode(mutated),
        'контроль не покраснел: страж принял маршрут без режима «любое из прав»'
      ).not.toEqual([])
    })

    it('ЗАКОММЕНТИРОВАННЫЙ режим краснит так же, как снятый', () => {
      const mutated = ROUTES_SOURCE.replace(ANY_MODE, `/* ${ANY_MODE} */ mode="all"`)
      expect(mutated, 'контроль не построен: режим не закомментирован').not.toBe(ROUTES_SOURCE)
      expect(
        withoutAnyMode(mutated),
        'контроль не покраснел: страж засчитал закомментированный режим как живой'
      ).not.toEqual([])
    })

    it('+1 КОРРЕКТНЫЙ маршрут краснит только равенство счёта', () => {
      const added = ROUTES_SOURCE.replace(
        "{\n        path: 'credit/loans',",
        WELL_FORMED_ROUTE + "\n        path: 'credit/loans',"
      )
      expect(added, 'контроль не построен: маршрут не вставлен').not.toBe(ROUTES_SOURCE)
      const more = creditRoutes(added).length
      expect(more, 'контроль не покраснел: счёт не изменился').toBe(CREDIT_ROUTES_BASELINE + 1)
      // Фикстура корректна — значит красным будет ТОЛЬКО счёт, и «красное»
      // продолжает различать нарушенные инварианты.
      expect(
        withoutAlternative(added),
        'фикстура некорректна: у нового маршрута нет альтернативы'
      ).toEqual([])
      expect(withoutAnyMode(added), 'фикстура некорректна: у нового маршрута нет режима').toEqual(
        []
      )
    })

    it('−1 КОРРЕКТНЫЙ маршрут краснит равенство счёта с другой стороны', () => {
      const settings = creditRoutes().find((route) => route.path === 'credit/settings')
      expect(settings, 'контроль не построен: блок credit/settings не найден').toBeTruthy()
      const marker = ROUTES_SOURCE.indexOf("path: 'credit/settings'")
      const whole = blockAt(ROUTES_SOURCE, marker)
      const removed = ROUTES_SOURCE.replace(whole, '')
      expect(removed, 'контроль не построен: блок не удалён').not.toBe(ROUTES_SOURCE)
      const fewer = creditRoutes(removed).length
      expect(fewer, 'контроль не покраснел: счёт не изменился').toBe(CREDIT_ROUTES_BASELINE - 1)
      // Оставшиеся маршруты по-прежнему корректны — красное только про счёт.
      expect(withoutAlternative(removed)).toEqual([])
      expect(withoutAnyMode(removed)).toEqual([])
    })
  })
})
