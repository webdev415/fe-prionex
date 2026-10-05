/**
 * The build flag of the role chat settings (board #1621, story 4): its value
 * AND its road to the built image.
 *
 * Made after `src/features/credit/api/__tests__/creditModuleFlag.test.ts`, for
 * the same reason: Vite inlines `import.meta.env.VITE_*` at BUILD time and the
 * image serves a built `dist`. A flag declared nowhere but in the code reads
 * `undefined` in every CI image - the chat settings would stay off on every
 * stand, indistinguishable from "switched off on purpose".
 *
 * One flag, three places, held together here:
 *   1. `Dockerfile.prod` - the `ARG` + `ENV` pair, before `npm run build`;
 *   2. `.forgejo/workflows/build.yml` - the `--build-arg` from the step that
 *      picks the value of the environment's repository variable;
 *   3. `roleChatSettingsFlag.ts` - the read in the code.
 *
 * The pipeline files are read through the bundler's glob with `?raw`, not the
 * file system module: the project compiles without Node types (the reason the
 * credit test gives).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const FLAG = 'VITE_ROLE_CHAT_SETTINGS_ENABLED'

const PIPELINE = import.meta.glob('../../../../{Dockerfile.prod,.forgejo/workflows/build.yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function pipelineFile(tail: string): string {
  const found = Object.entries(PIPELINE).find(([path]) => path.endsWith(tail))
  if (!found) {
    throw new Error(`the glob brought no ${tail} - the checks below would pass on an empty set`)
  }
  return found[1]
}

async function loadFlagModule() {
  vi.resetModules()
  return await import('../roleChatSettingsFlag')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('isRoleChatSettingsEnabled - the value', () => {
  it.each(['true', '1'])('is on for %o', async (value) => {
    vi.stubEnv(FLAG, value)
    const mod = await loadFlagModule()
    expect(mod.isRoleChatSettingsEnabled()).toBe(true)
  })

  it('is off when the variable is not there at all (every stand not switched on)', async () => {
    vi.stubEnv(FLAG, undefined as unknown as string)
    const mod = await loadFlagModule()
    expect(mod.isRoleChatSettingsEnabled()).toBe(false)
  })

  it.each(['false', '0', '', 'True', 'TRUE', 'yes', ' true'])(
    'is off for %o - a string compare, not "looks true"',
    async (value) => {
      vi.stubEnv(FLAG, value)
      const mod = await loadFlagModule()
      expect(mod.isRoleChatSettingsEnabled()).toBe(false)
    }
  )

  it('is read on every call, so a test can switch it after import', async () => {
    const mod = await loadFlagModule()
    vi.stubEnv(FLAG, 'true')
    expect(mod.isRoleChatSettingsEnabled()).toBe(true)
    vi.stubEnv(FLAG, 'false')
    expect(mod.isRoleChatSettingsEnabled()).toBe(false)
  })

  it('exports the name it reads', async () => {
    const mod = await loadFlagModule()
    expect(mod.ROLE_CHAT_SETTINGS_FLAG).toBe(FLAG)
  })
})

describe('the flag reaches the built image - three places of one truth', () => {
  const dockerfile = () => pipelineFile('Dockerfile.prod')
  const workflow = () => pipelineFile('build.yml')

  function lineIndex(text: string, predicate: (line: string) => boolean, what: string): number {
    const index = text.split('\n').findIndex(predicate)
    if (index < 0) throw new Error(`no such line in the file: ${what}`)
    return index
  }

  /** A line starting with `#` declares nothing. */
  const isLive = (line: string, needle: string) => line.includes(needle) && !/^\s*#/.test(line)

  it('Dockerfile.prod declares ARG and ENV before the bundle is built, in the build stage', () => {
    const text = dockerfile()
    // Positive control: the neighbour flag is there, so "ours is missing"
    // would be said of the live file, not of an empty string.
    expect(text).toContain('ARG VITE_CREDIT_MODULE_ENABLED')
    const arg = lineIndex(text, (line) => isLive(line, `ARG ${FLAG}`), `ARG ${FLAG}`)
    const env = lineIndex(text, (line) => isLive(line, `ENV ${FLAG}=$${FLAG}`), `ENV ${FLAG}`)
    const build = lineIndex(text, (line) => isLive(line, 'RUN npm run build'), 'RUN npm run build')
    const secondStage = lineIndex(text, (line) => isLive(line, 'FROM nginx:'), 'FROM nginx:')
    expect(arg).toBeLessThan(env)
    expect(env).toBeLessThan(build)
    expect(build).toBeLessThan(secondStage)
  })

  it('build.yml passes the value as a build-arg INSIDE the build-args of the image step', () => {
    const lines = workflow().split('\n')
    const stepAt = lines.findIndex((line) => line.includes('docker/build-push-action'))
    expect(stepAt, 'no image build step in the file').toBeGreaterThan(-1)
    const argsAt = lines.findIndex((line, i) => i > stepAt && /^\s*build-args:\s*\|/.test(line))
    expect(argsAt, 'the image build step has no build-args block').toBeGreaterThan(-1)
    const indent = (lines[argsAt].match(/^\s*/) ?? [''])[0].length
    const block: string[] = []
    for (let i = argsAt + 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (line.trim() === '') continue
      const lead = (line.match(/^\s*/) ?? [''])[0].length
      if (lead <= indent) break
      block.push(line)
    }
    // Positive control: the block was found, it is not empty.
    expect(block.some((line) => isLive(line, 'VITE_API_BASE_URL='))).toBe(true)
    expect(
      block.some((line) =>
        isLive(line, `${FLAG}=\${{ steps.role_chat_flag.outputs.role_chat_enabled }}`)
      ),
      `no live ${FLAG} build-arg in the build-args block`
    ).toBe(true)
  })

  it('build.yml reads the repository variable for all three environments', () => {
    const text = workflow()
    for (const env of ['DEV', 'PREPROD', 'PROD']) {
      expect(text, `environment ${env} has no variable`).toContain(`vars.${FLAG}_${env}`)
    }
  })

  it('an empty value means false (the old field), not a failed build', () => {
    expect(workflow()).toContain('ROLE_CHAT="${ROLE_CHAT:-false}"')
  })

  it('the code reads exactly the name the pipeline carries', () => {
    const source = Object.values(
      import.meta.glob('../roleChatSettingsFlag.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }) as Record<string, string>
    )[0]
    expect(source, 'the flag source was not read').toBeTruthy()
    expect(source).toContain(`import.meta.env.${FLAG}`)
  })
})
