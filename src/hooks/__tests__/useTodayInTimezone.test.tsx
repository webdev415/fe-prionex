import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { useTodayInTimezone } from '../useTodayInTimezone'

/**
 * The behaviour under test is a ROLLOVER RULE, not a formatting one: which
 * instant the displayed day changes at. `getDateStringInTimezone` has its own
 * suite for the formatting; here the clock is moved and the window is focused.
 *
 * These cases mirror the three the five migrated tabs already pin through
 * their own UI (15 focus tests across them, untouched by the extraction) —
 * kept here as well because the hook now owns the rule, and a tab suite proves
 * only that ONE tab still behaves; this proves the rule itself.
 */
describe('useTodayInTimezone', () => {
  beforeEach(() => {
    // Only Date is faked — the convention of the five tab suites this rule
    // came from: real timers keep waitFor / React Query / userEvent flowing,
    // while setSystemTime moves what "now" (and thus "today") is. Faking
    // everything would also freeze the machinery the rule runs inside.
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const focusWindow = () => act(() => void window.dispatchEvent(new Event('focus')))

  it('resolves today in the PROFILE zone, not the browser one', () => {
    // 23:30 UTC on the 8th is already the 9th in Kyiv (+03:00). A browser-zone
    // read would show the 8th to an operator whose day has already turned.
    vi.setSystemTime(new Date('2026-09-08T23:30:00Z'))
    const { result } = renderHook(() => useTodayInTimezone('Europe/Kyiv'))
    expect(result.current).toBe('2026-09-09')
  })

  it('keeps yesterday until the window is focused, then rolls over', () => {
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    const { result } = renderHook(() => useTodayInTimezone('Europe/Kyiv'))
    expect(result.current).toBe('2026-09-08')

    // The clock crosses midnight while the tab sits unfocused: the value must
    // NOT move on its own — that is the whole point of holding it in state.
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'))
    expect(result.current).toBe('2026-09-08')

    focusWindow()
    expect(result.current).toBe('2026-09-09')
  })

  it('returns the SAME string on a same-day focus, so nothing re-renders', () => {
    // Identity, not equality: `refetchOnWindowFocus` is off globally, so this
    // listener is the only thing reacting to focus on the reports page. A new
    // string each focus would be a new request each focus.
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useTodayInTimezone('Europe/Kyiv')
    })
    const before = renders
    const value = result.current

    focusWindow()
    focusWindow()

    expect(result.current).toBe(value)
    expect(renders).toBe(before)
  })

  it('re-resolves immediately when the profile zone changes, with the clock standing still', () => {
    // The zone loads or changes after mount, which changes what "today" means
    // without time passing. 18:00 UTC is 21:00 on the 8th in Kyiv (+03:00 in
    // summer) but already 03:00 on the 9th in Tokyo (+09:00).
    vi.setSystemTime(new Date('2026-09-08T18:00:00Z'))
    const { result, rerender } = renderHook(({ zone }) => useTodayInTimezone(zone), {
      initialProps: { zone: 'Europe/Kyiv' },
    })
    expect(result.current).toBe('2026-09-08')

    rerender({ zone: 'Asia/Tokyo' })
    expect(result.current).toBe('2026-09-09')
  })

  it('removes the LISTENER IT ADDED when the component unmounts', () => {
    // `expect.any(Function)` would be satisfied by a cleanup that removed
    // somebody else's focus listener and left this one attached — a leak that
    // survives every remount of the tab. So the reference added is captured
    // and the reference removed is compared against it.
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    const { unmount } = renderHook(() => useTodayInTimezone('Europe/Kyiv'))

    const added = add.mock.calls.filter(([event]) => event === 'focus')
    expect(added).toHaveLength(1)

    unmount()

    expect(remove).toHaveBeenCalledWith('focus', added[0][1])
    add.mockRestore()
    remove.mockRestore()
  })

  it('survives a missing profile zone and resolves again once it arrives', () => {
    // `undefined` is not an edge case: it is the FIRST render of all five
    // tabs, before the profile has loaded. `getDateStringInTimezone` falls
    // back to the browser zone, and the value must then follow the real zone
    // the moment it appears — with the clock standing still.
    //
    // The browser-zone day is DERIVED, not hardcoded: vitest.config.ts only
    // DEFAULTS `TZ` to UTC and documents `TZ=America/New_York npx vitest run`
    // as the way to hunt for exactly this class of bug, so a literal here
    // would break that workflow and go red on any dev box with `TZ` set.
    // 12:00 UTC is the same calendar day in every zone from UTC-12 to
    // UTC+11, and the re-resolve is proven with UTC+14 (Kiritimati), where
    // it is already the next day.
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    const { result, rerender } = renderHook(
      ({ zone }: { zone: string | null | undefined }) => useTodayInTimezone(zone),
      { initialProps: { zone: undefined as string | null | undefined } }
    )
    expect(result.current).toBe(getDateStringInTimezone(new Date(), undefined))

    rerender({ zone: 'Pacific/Kiritimati' })
    expect(result.current).toBe('2026-09-09')
  })

  it('falls back to the browser zone for an unusable zone string', () => {
    // A profile carrying junk (a hand-edited value, a zone that ICU does not
    // know) must not throw an unhandled RangeError out of a render and take
    // the whole tab down with it — the fallback inside
    // `getDateStringInTimezone` is what keeps a bad profile field a cosmetic
    // problem.
    // Same derivation as above: the expected value is whatever the browser
    // zone says, so the test is honest under any process `TZ`.
    vi.setSystemTime(new Date('2026-09-08T12:00:00Z'))
    const { result } = renderHook(() => useTodayInTimezone('Mars/Olympus'))
    expect(result.current).toBe(getDateStringInTimezone(new Date(), undefined))
  })
})
