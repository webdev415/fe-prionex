import { describe, expect, it } from 'vitest'
import { getDockDesktopBoxClasses } from '../dockGeometry'

/**
 * The fixed dock box must be geometrically identical to the chat content box:
 * left = dashboard rail + 28px main padding + history reserve (panel + 1rem
 * gap), right = 28px main padding, width = auto (an explicit width together
 * with `left` would over-constrain the box and make the browser ignore
 * `right` — the original misalignment bug).
 */
describe('getDockDesktopBoxClasses', () => {
  const combos: Array<{
    isOpenSideBar: boolean
    isHistoryCollapsed: boolean
    expectedLeft: string
  }> = [
    // rail 72 + main 28 + (panel 56 + gap 16) = 172px
    { isOpenSideBar: false, isHistoryCollapsed: true, expectedLeft: 'lg:left-[10.75rem]' },
    // rail 72 + main 28 + (panel 280 + gap 16) = 396px
    { isOpenSideBar: false, isHistoryCollapsed: false, expectedLeft: 'lg:left-[24.75rem]' },
    // rail 240 + main 28 + (panel 56 + gap 16) = 340px
    { isOpenSideBar: true, isHistoryCollapsed: true, expectedLeft: 'lg:left-[21.25rem]' },
    // rail 240 + main 28 + (panel 280 + gap 16) = 564px
    { isOpenSideBar: true, isHistoryCollapsed: false, expectedLeft: 'lg:left-[35.25rem]' },
  ]

  it.each(combos)(
    'sidebar open=$isOpenSideBar, history collapsed=$isHistoryCollapsed → $expectedLeft',
    ({ isOpenSideBar, isHistoryCollapsed, expectedLeft }) => {
      const classes = getDockDesktopBoxClasses(isOpenSideBar, isHistoryCollapsed).split(' ')
      expect(classes).toContain(expectedLeft)
    }
  )

  it.each(combos)(
    'sidebar open=$isOpenSideBar, history collapsed=$isHistoryCollapsed → right pinned to main padding, width auto',
    ({ isOpenSideBar, isHistoryCollapsed }) => {
      const classes = getDockDesktopBoxClasses(isOpenSideBar, isHistoryCollapsed).split(' ')
      // 28px = <main> right padding at lg; w-auto lets left+right define the box.
      expect(classes).toContain('lg:right-7')
      expect(classes).toContain('lg:w-auto')
    }
  )

  it('returns a unique left offset per combination', () => {
    const lefts = combos.map(({ isOpenSideBar, isHistoryCollapsed }) =>
      getDockDesktopBoxClasses(isOpenSideBar, isHistoryCollapsed)
        .split(' ')
        .find((c) => c.startsWith('lg:left-'))
    )
    expect(new Set(lefts).size).toBe(4)
  })

  it.each(combos)(
    'OneX dock keeps the full-width box (open=$isOpenSideBar, collapsed=$isHistoryCollapsed)',
    ({ isOpenSideBar, isHistoryCollapsed }) => {
      // No rail and no history panel in the dock — any lg: offset here would
      // push the composer off a host window wider than the lg breakpoint.
      expect(getDockDesktopBoxClasses(isOpenSideBar, isHistoryCollapsed, true)).toBe('')
    }
  )
})
