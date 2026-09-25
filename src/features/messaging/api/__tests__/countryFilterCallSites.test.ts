import { describe, expect, it } from 'vitest'

const DEFINITION_OWNER = 'src/features/messaging/api/types.ts'
const MIN_FILES_SCANNED = 1200
const CALLEE = 'isMessagingIntegrationUsable('

const SOURCES = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function toRepoPath(globPath: string): string {
  return globPath.replace(/^\//, '')
}

function isTestFile(path: string): boolean {
  return path.includes('/__tests__/') || path.startsWith('src/test/')
}

function argumentListAt(source: string, openParen: number): string | null {
  let depth = 0
  for (let i = openParen; i < source.length; i += 1) {
    const char = source[i]
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return source.slice(openParen + 1, i)
    }
  }
  return null
}

function topLevelArgumentCount(args: string): number {
  if (args.trim() === '') return 0
  let depth = 0
  let count = 1
  for (const char of args) {
    if (char === '(' || char === '[' || char === '{') depth += 1
    else if (char === ')' || char === ']' || char === '}') depth -= 1
    else if (char === ',' && depth === 0) count += 1
  }
  return count
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

interface CallSite {
  path: string
  line: number
  argumentCount: number
}

function collectCallSites(): { sites: CallSite[]; scanned: number } {
  const sites: CallSite[] = []
  let scanned = 0

  for (const [globPath, source] of Object.entries(SOURCES)) {
    const path = toRepoPath(globPath)
    if (isTestFile(path)) continue
    scanned += 1
    if (path === DEFINITION_OWNER) continue

    let from = 0
    for (;;) {
      const found = source.indexOf(CALLEE, from)
      if (found === -1) break
      const openParen = found + CALLEE.length - 1
      const args = argumentListAt(source, openParen)
      if (args !== null) {
        sites.push({
          path,
          line: lineOf(source, found),
          argumentCount: topLevelArgumentCount(args),
        })
      }
      from = found + CALLEE.length
    }
  }

  return { sites, scanned }
}

describe('messaging provider pickers filter by project country', () => {
  const { sites, scanned } = collectCallSites()

  it('scans the source tree', () => {
    expect(scanned).toBeGreaterThan(MIN_FILES_SCANNED)
    expect(sites.length).toBeGreaterThan(0)
  })

  it('passes a project country at every call site', () => {
    const missing = sites
      .filter((site) => site.argumentCount < 3)
      .map((site) => `${site.path}:${site.line}`)

    expect(missing).toEqual([])
  })
})
