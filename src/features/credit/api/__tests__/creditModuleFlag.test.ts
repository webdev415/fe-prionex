/**
 * Флаг кредитного блока: значение И его дорога до собранного образа.
 *
 * 🔴 Почему одного теста функции мало. Сборщик подставляет
 * `import.meta.env.VITE_*` **на сборке**, а образ отдаёт уже готовый `dist`:
 * переменная, объявленная только в `.env*.example`, до бандла не доезжает
 * вовсе, читается как `undefined`, и блок выключен на всех стендах навсегда.
 * Снаружи это неотличимо от «выключен как задумано» — ровно тот двойной
 * признак включённости, о котором предупреждает норма: «переменная стоит, кода
 * нет». Этот класс отказа в репозитории уже случался с адресом софтфона
 * (`build.yml`: «was outside the Dockerfile's build-arg contract, so every
 * image CI has ever produced had it undefined»), и сторожит его
 * `src/features/operatorPhone/__tests__/prodOrigin.test.ts` — этот файл сделан
 * по его образцу.
 *
 * Истина об одном флаге живёт в ТРЁХ местах, и тест держит их вместе:
 *   1. `Dockerfile.prod` — пара `ARG` + `ENV`;
 *   2. `.forgejo/workflows/build.yml` — `--build-arg` из шага выбора значения;
 *   3. `creditModuleFlag.ts` — чтение в коде.
 * Выпадение любого из трёх возвращает ровно тот отказ, ради которого тест
 * написан.
 *
 * Файлы конвейера читаются глобом сборщика с `?raw`, а не модулем файловой
 * системы: проект компилируется без типов Node, и `tsc -b` (job Type Check)
 * падает на таком импорте — тот же довод записан в `i18nKeys.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const FLAG = 'VITE_CREDIT_MODULE_ENABLED'

const PIPELINE = import.meta.glob('../../../../../{Dockerfile.prod,.forgejo/workflows/build.yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function pipelineFile(tail: string): string {
  const found = Object.entries(PIPELINE).find(([path]) => path.endsWith(tail))
  if (!found) {
    throw new Error(
      `глоб не принёс ${tail} — выборка потеряла предмет контроля, и проверки ниже ` +
        'зеленели бы на пустом множестве'
    )
  }
  return found[1]
}

async function loadFlagModule() {
  vi.resetModules()
  return await import('../creditModuleFlag')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('isCreditModuleEnabled — значение', () => {
  it('включён только на литеральной строке true', async () => {
    vi.stubEnv(FLAG, 'true')
    const mod = await loadFlagModule()
    expect(mod.isCreditModuleEnabled()).toBe(true)
  })

  it('выключен на false', async () => {
    vi.stubEnv(FLAG, 'false')
    const mod = await loadFlagModule()
    expect(mod.isCreditModuleEnabled()).toBe(false)
  })

  it('выключен, когда переменной нет вовсе', async () => {
    // Состояние любого стенда, которому флаг ещё не выдали.
    vi.stubEnv(FLAG, undefined as unknown as string)
    const mod = await loadFlagModule()
    expect(mod.isCreditModuleEnabled()).toBe(false)
  })

  it.each(['True', 'TRUE', '1', 'yes', ' true', ''])(
    'выключен на значении %o — сравнение строковое, а не «похоже на правду»',
    async (value) => {
      // Не придирка: ровно поэтому конвейер отвергает всё, кроме true/false, —
      // иначе выставленная человеком переменная молча означала бы «выключено».
      vi.stubEnv(FLAG, value)
      const mod = await loadFlagModule()
      expect(mod.isCreditModuleEnabled()).toBe(false)
    }
  )

  it('имя переменной экспортировано и совпадает с читаемым', async () => {
    const mod = await loadFlagModule()
    expect(mod.CREDIT_MODULE_FLAG).toBe(FLAG)
  })
})

describe('флаг доезжает до собранного образа — три места одной истины', () => {
  const dockerfile = () => pipelineFile('Dockerfile.prod')
  const workflow = () => pipelineFile('build.yml')

  /** Номер строки объявления — и отказ, который называет предмет. */
  function lineIndex(text: string, predicate: (line: string) => boolean, what: string): number {
    const index = text.split('\n').findIndex(predicate)
    if (index < 0) throw new Error(`в файле нет строки: ${what}`)
    return index
  }

  /** Строка, начинающаяся с `#`, объявлением не является. */
  const isLive = (line: string, needle: string) => line.includes(needle) && !/^\s*#/.test(line)

  it('Dockerfile.prod объявляет пару ARG + ENV, и обе строки живые', () => {
    const text = dockerfile()
    // Положительный контроль выборки: соседний флаг, ради которого эта пара и
    // заведена, в файле есть — значит «нашего нет» было бы сказано о живом
    // файле, а не о пустой строке.
    expect(text).toContain('ARG VITE_ASSISTANT_REPORT_TABLES_ENABLED')
    // 🔴 Не `toContain` по сырому тексту: закомментированная строка содержится
    // в файле ровно так же, а флага в бандле от неё не появится.
    expect(() =>
      lineIndex(text, (line) => isLive(line, `ARG ${FLAG}`), `ARG ${FLAG}`)
    ).not.toThrow()
    expect(() =>
      lineIndex(text, (line) => isLive(line, `ENV ${FLAG}=$${FLAG}`), `ENV ${FLAG}`)
    ).not.toThrow()
  })

  it('🔴 ENV объявлен ДО сборки бандла и в той же стадии', () => {
    // Сборщик вшивает значение в момент `npm run build`. `ENV`, переехавший
    // ниже этой строки или во вторую стадию образа, оставляет бандл без флага,
    // а файл — внешне правильным.
    const text = dockerfile()
    const env = lineIndex(text, (line) => isLive(line, `ENV ${FLAG}=`), `ENV ${FLAG}`)
    const build = lineIndex(text, (line) => isLive(line, 'RUN npm run build'), 'RUN npm run build')
    const secondStage = lineIndex(text, (line) => isLive(line, 'FROM nginx:'), 'FROM nginx:')
    expect(env).toBeLessThan(build)
    expect(build).toBeLessThan(secondStage)
    // ARG без ENV значение сборщику не отдаст — порядок держим и для него.
    const arg = lineIndex(text, (line) => isLive(line, `ARG ${FLAG}`), `ARG ${FLAG}`)
    expect(arg).toBeLessThan(env)
  })

  it('build.yml передаёт значение build-arg из шага выбора', () => {
    const text = workflow()
    expect(text).toContain('VITE_OPERATOR_PHONE_URL=${{ steps.phone.outputs.phone_url }}')
    expect(text).toContain(`${FLAG}=\${{ steps.credit_flag.outputs.credit_enabled }}`)
  })

  it('🔴 build-arg лежит ВНУТРИ блока build-args шага сборки образа', () => {
    // Та же строка, оставленная в комментарии или в чужом шаге, ничего не
    // передаёт. Предмет — место: блок `build-args:` того шага, который и
    // собирает образ приложения.
    const lines = workflow().split('\n')
    const stepAt = lines.findIndex((line) => line.includes('docker/build-push-action'))
    expect(stepAt, 'шага сборки образа в файле нет').toBeGreaterThan(-1)
    const argsAt = lines.findIndex((line, i) => i > stepAt && /^\s*build-args:\s*\|/.test(line))
    expect(argsAt, 'у шага сборки нет блока build-args').toBeGreaterThan(-1)
    const indent = (lines[argsAt].match(/^\s*/) ?? [''])[0].length
    const block: string[] = []
    for (let i = argsAt + 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (line.trim() === '') continue
      const lead = (line.match(/^\s*/) ?? [''])[0].length
      if (lead <= indent) break
      block.push(line)
    }
    expect(block.some((line) => isLive(line, `${FLAG}=`))).toBe(true)
    // Положительный контроль: соседний build-arg лежит в том же блоке, то есть
    // блок найден правильно, а не оказался пустым.
    expect(block.some((line) => isLive(line, 'VITE_API_BASE_URL='))).toBe(true)
  })

  it('build.yml читает переменную репозитория для всех трёх сред', () => {
    const text = workflow()
    for (const env of ['DEV', 'PREPROD', 'PROD']) {
      expect(text, `среда ${env} осталась без переменной`).toContain(`vars.${FLAG}_${env}`)
    }
  })

  it('пустое значение означает false, а не отказ сборки', () => {
    // Булев флаг, а не адрес: среда, которой блок ещё не выдали, обязана
    // собираться зелёной.
    expect(workflow()).toContain('CREDIT="${CREDIT:-false}"')
  })

  it('значение вне true/false отвергается с именем переменной', () => {
    const text = workflow()
    expect(text).toContain('FAIL: VITE_CREDIT_MODULE_ENABLED_${SUFFIX}')
    expect(text).toMatch(/case "\$CREDIT" in\s*\n\s*true\|false\) ;;/)
  })

  it('код читает ровно то имя, которое везёт конвейер', () => {
    // Смысл всей связки: переименование в одном месте обязано краснеть здесь, а
    // не проявляться пустой вкладкой на стенде.
    const flagSource = Object.entries(
      import.meta.glob('../creditModuleFlag.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }) as Record<string, string>
    )[0]?.[1]
    expect(flagSource, 'исходник флага не прочитан').toBeTruthy()
    expect(flagSource).toContain(`import.meta.env.${FLAG}`)
  })
})
