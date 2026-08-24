import { describe, expect, it } from 'vitest'
import bar from '../../components/UserFiltersBar.tsx?raw'

const WRAPPERS = [...bar.matchAll(/className="(flex min-w-\[[^"]*flex-col[^"]*)"/g)].map(
  (m) => m[1]
)

describe('the filter bar row', () => {
  it('has one wrapper shape, so no control is wider than its neighbours', () => {
    expect(WRAPPERS.length).toBeGreaterThan(1)
    expect(new Set(WRAPPERS).size).toBe(1)
  })

  it('lets the controls share the whole row rather than stopping short', () => {
    for (const wrapper of WRAPPERS) {
      expect(wrapper).toContain('flex-1')
      expect(wrapper).not.toMatch(/max-w-/)
    }
  })

  it('still wraps rather than crushing the controls on a narrow screen', () => {
    expect(bar).toContain('flex flex-wrap items-end gap-3')
    for (const wrapper of WRAPPERS) {
      expect(wrapper).toMatch(/min-w-\[\d+px\]/)
    }
  })
})
