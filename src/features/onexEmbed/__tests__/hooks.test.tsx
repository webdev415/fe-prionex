import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useIsOnexDockEmbed, useOnexAsk, useOnexDockReady, useOnexPageContext } from '../hooks'
import { ONEX_ASK_EVENT, ONEX_PAGE_CONTEXT_EVENT } from '../embedContext'

/** Point `window.location` at a URL without navigating (jsdom). */
function setSearch(search: string): void {
  window.history.replaceState({}, '', `/dashboard/ai-assistant${search}`)
}

beforeEach(() => {
  setSearch('')
  delete window.__onexPageContext
  delete window.__onexDockReady
})

afterEach(() => {
  setSearch('')
})

describe('useIsOnexDockEmbed', () => {
  it('is false without the dock query and true with it', () => {
    const plain = renderHook(() => useIsOnexDockEmbed())
    expect(plain.result.current).toBe(false)

    setSearch('?embed=dock')
    const docked = renderHook(() => useIsOnexDockEmbed())
    expect(docked.result.current).toBe(true)
  })

  it('re-reads the location on back/forward', () => {
    const { result } = renderHook(() => useIsOnexDockEmbed())
    expect(result.current).toBe(false)

    act(() => {
      setSearch('?embed=dock')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current).toBe(true)
  })
})

describe('useOnexPageContext', () => {
  it('seeds from the global the host published before mount', () => {
    window.__onexPageContext = { title: 'Картка клієнта', clientId: 42 }
    const { result } = renderHook(() => useOnexPageContext(true))
    expect(result.current.context).toMatchObject({ title: 'Картка клієнта', clientId: 42 })
  })

  it('follows onex:page-context events and clears on demand', () => {
    const { result } = renderHook(() => useOnexPageContext(true))
    expect(result.current.context).toBeNull()

    act(() => {
      window.dispatchEvent(
        new CustomEvent(ONEX_PAGE_CONTEXT_EVENT, { detail: { title: 'Борги', clientId: 7 } })
      )
    })
    expect(result.current.context).toMatchObject({ title: 'Борги', clientId: 7 })

    act(() => result.current.clearContext())
    expect(result.current.context).toBeNull()
  })

  it('drops a stale page when the host publishes an unusable payload', () => {
    const { result } = renderHook(() => useOnexPageContext(true))
    act(() => {
      window.dispatchEvent(new CustomEvent(ONEX_PAGE_CONTEXT_EVENT, { detail: { title: 'Борги' } }))
    })
    expect(result.current.context).not.toBeNull()

    act(() => {
      window.dispatchEvent(new CustomEvent(ONEX_PAGE_CONTEXT_EVENT, { detail: null }))
    })
    expect(result.current.context).toBeNull()
  })

  it('stays inert outside the dock', () => {
    window.__onexPageContext = { title: 'Картка клієнта' }
    const { result } = renderHook(() => useOnexPageContext(false))
    act(() => {
      window.dispatchEvent(new CustomEvent(ONEX_PAGE_CONTEXT_EVENT, { detail: { title: 'Борги' } }))
    })
    expect(result.current.context).toBeNull()
  })
})

describe('useOnexAsk', () => {
  it('forwards valid commands and ignores empty ones', () => {
    const onAsk = vi.fn()
    renderHook(() => useOnexAsk(true, onAsk))

    act(() => {
      window.dispatchEvent(new CustomEvent(ONEX_ASK_EVENT, { detail: { text: 'Підсумуй' } }))
      window.dispatchEvent(new CustomEvent(ONEX_ASK_EVENT, { detail: { text: '   ' } }))
    })

    expect(onAsk).toHaveBeenCalledTimes(1)
    expect(onAsk).toHaveBeenCalledWith({ text: 'Підсумуй', preset: null })
  })

  it('keeps listening when the handler identity changes each render', () => {
    const calls: string[] = []
    const { rerender } = renderHook(
      ({ tag }: { tag: string }) => useOnexAsk(true, () => calls.push(tag)),
      { initialProps: { tag: 'first' } }
    )

    rerender({ tag: 'second' })
    act(() => {
      window.dispatchEvent(new CustomEvent(ONEX_ASK_EVENT, { detail: { preset: 'summary' } }))
    })

    expect(calls).toEqual(['second'])
  })

  it('stays inert outside the dock', () => {
    const onAsk = vi.fn()
    renderHook(() => useOnexAsk(false, onAsk))
    act(() => {
      window.dispatchEvent(new CustomEvent(ONEX_ASK_EVENT, { detail: { text: 'Підсумуй' } }))
    })
    expect(onAsk).not.toHaveBeenCalled()
  })
})

describe('useOnexDockReady', () => {
  it('flags the window while the dock is mounted', () => {
    const { unmount } = renderHook(() => useOnexDockReady(true))
    expect(window.__onexDockReady).toBe(true)
    unmount()
    expect(window.__onexDockReady).toBe(false)
  })

  it('leaves the flag alone outside the dock', () => {
    renderHook(() => useOnexDockReady(false))
    expect(window.__onexDockReady).toBeUndefined()
  })
})
