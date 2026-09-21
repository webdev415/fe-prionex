import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useClampPage } from '../useClampPage'

describe('useClampPage', () => {
  it('moves a page left over from a bigger list to the last page', () => {
    const setPage = vi.fn()

    renderHook(() => useClampPage(1302, 1, true, setPage))

    expect(setPage).toHaveBeenCalledWith(1)
  })

  it('keeps the last existing page when the list shrinks', () => {
    const setPage = vi.fn()

    renderHook(() => useClampPage(50, 45, true, setPage))

    expect(setPage).toHaveBeenCalledWith(45)
  })

  it('waits for the answer to the current request', () => {
    const setPage = vi.fn()

    renderHook(() => useClampPage(1302, 1, false, setPage))

    expect(setPage).not.toHaveBeenCalled()
  })

  it('leaves a page that exists alone', () => {
    const setPage = vi.fn()

    renderHook(() => useClampPage(3, 10, true, setPage))

    expect(setPage).not.toHaveBeenCalled()
  })
})
