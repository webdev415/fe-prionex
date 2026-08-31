/**
 * KAN-973 / KAN-975 — the bridge between the settings screen and the client card.
 *
 * Both read the same query key. What matters, and was untested, is that the
 * client card gets its bindings as a lookup map, and that saving a shortcut in
 * settings marks that shared data stale — otherwise the new key would not fire
 * until the operator reloaded the page.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const getTAHotkeys = vi.fn()
const assignTAHotkey = vi.fn()
const clearTAHotkey = vi.fn()

vi.mock('../api/taHotkeysApi', () => ({
  getTAHotkeys: () => getTAHotkeys(),
  assignTAHotkey: (p: unknown) => assignTAHotkey(p),
  clearTAHotkey: (id: number) => clearTAHotkey(id),
}))

import {
  useAssignTAHotkey,
  useClearTAHotkey,
  useTAHotkeyBindings,
  useTAHotkeyList,
} from '../hooks/useTAHotkeys'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

beforeEach(() => {
  getTAHotkeys.mockReset()
  assignTAHotkey.mockReset().mockResolvedValue({
    hotkey: 'Alt+2',
    quick_pick_id: 11,
    reassigned_from: null,
  })
  clearTAHotkey.mockReset().mockResolvedValue(undefined)
})

describe('useTAHotkeyBindings', () => {
  it('turns the list into a combination → template lookup', async () => {
    getTAHotkeys.mockResolvedValue([
      { hotkey: 'Ctrl+1', quick_pick_id: 10 },
      { hotkey: 'Alt+2', quick_pick_id: 11 },
    ])
    const client = freshClient()
    const { result } = renderHook(() => useTAHotkeyBindings(), { wrapper: wrapper(client) })

    await waitFor(() => expect(result.current).toEqual({ 'Ctrl+1': 10, 'Alt+2': 11 }))
  })

  it('is an empty map before the request lands', () => {
    // Reads as "nothing is bound", which is what an unassigned key does — so an
    // early keypress does nothing rather than opening the wrong template.
    getTAHotkeys.mockReturnValue(new Promise(() => {}))
    const client = freshClient()
    const { result } = renderHook(() => useTAHotkeyBindings(), { wrapper: wrapper(client) })

    expect(result.current).toEqual({})
  })

  it('keeps the same object across renders while the data is unchanged', () => {
    // The client card puts this into a ref on every render; a new object each
    // time would churn without meaning anything.
    getTAHotkeys.mockReturnValue(new Promise(() => {}))
    const client = freshClient()
    const { result, rerender } = renderHook(() => useTAHotkeyBindings(), {
      wrapper: wrapper(client),
    })

    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})

describe('the settings screen and the client card share one query', () => {
  it('serves the list and the map from a single request', async () => {
    getTAHotkeys.mockResolvedValue([{ hotkey: 'Ctrl+1', quick_pick_id: 10 }])
    const client = freshClient()
    const { result } = renderHook(() => ({ list: useTAHotkeyList(), map: useTAHotkeyBindings() }), {
      wrapper: wrapper(client),
    })

    await waitFor(() => expect(result.current.map).toEqual({ 'Ctrl+1': 10 }))
    expect(result.current.list.data).toEqual([{ hotkey: 'Ctrl+1', quick_pick_id: 10 }])
    // One key, one fetch — the two hooks must not each pull their own copy.
    expect(getTAHotkeys).toHaveBeenCalledTimes(1)
  })

  it('refetches after a shortcut is assigned', async () => {
    getTAHotkeys.mockResolvedValue([])
    const client = freshClient()
    const { result } = renderHook(
      () => ({ map: useTAHotkeyBindings(), assign: useAssignTAHotkey() }),
      { wrapper: wrapper(client) }
    )
    await waitFor(() => expect(getTAHotkeys).toHaveBeenCalledTimes(1))

    getTAHotkeys.mockResolvedValue([{ hotkey: 'Alt+2', quick_pick_id: 11 }])
    await result.current.assign.mutateAsync({ hotkey: 'Alt+2', quick_pick_id: 11 })

    // Without the invalidation the new key would not fire until a reload — the
    // read side caches for five minutes.
    await waitFor(() => expect(result.current.map).toEqual({ 'Alt+2': 11 }))
  })

  it('refetches after a shortcut is cleared', async () => {
    getTAHotkeys.mockResolvedValue([{ hotkey: 'Alt+2', quick_pick_id: 11 }])
    const client = freshClient()
    const { result } = renderHook(
      () => ({ map: useTAHotkeyBindings(), clear: useClearTAHotkey() }),
      { wrapper: wrapper(client) }
    )
    await waitFor(() => expect(result.current.map).toEqual({ 'Alt+2': 11 }))

    getTAHotkeys.mockResolvedValue([])
    await result.current.clear.mutateAsync(11)

    await waitFor(() => expect(result.current.map).toEqual({}))
  })

  it('passes the payload straight through to the API', async () => {
    getTAHotkeys.mockResolvedValue([])
    const client = freshClient()
    const { result } = renderHook(() => useAssignTAHotkey(), { wrapper: wrapper(client) })

    await result.current.mutateAsync({ hotkey: 'Ctrl+Shift+A', quick_pick_id: 7 })
    expect(assignTAHotkey).toHaveBeenCalledWith({ hotkey: 'Ctrl+Shift+A', quick_pick_id: 7 })
  })
})
