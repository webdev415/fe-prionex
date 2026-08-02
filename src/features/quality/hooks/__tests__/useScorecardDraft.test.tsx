/**
 * useScorecardDraft hook tests.
 *
 * Regression coverage for KAN-707: before the fix the "flush on unmount"
 * effect (and the debounce effect) depended on `flush`, whose identity
 * changed every render — so their cleanups fired on every commit, firing a
 * stale-state PUT per keystroke. These tests drive the hook with the default
 * config (enabled / flushOnUnmount = true), which the shipped ScorecardPanel
 * opts out of, so the symptom is only reachable here.
 */
import { beforeEach, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useScorecardDraft } from '../useScorecardDraft'
import { updateScorecard } from '../../api/qualityService'
import type { Scorecard } from '../../types'

vi.mock('../../api/qualityService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/qualityService')>()
  return { ...original, updateScorecard: vi.fn() }
})

const mockUpdate = vi.mocked(updateScorecard)

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

const SCORECARD_ID = 1
const INITIAL = { scores: {}, overall_comment: '' }

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdate.mockResolvedValue({ id: SCORECARD_ID, status: 'draft' } as unknown as Scorecard)
})

it('does not PUT on keystrokes before the debounce elapses', async () => {
  const { result } = renderHook(
    () => useScorecardDraft({ scorecardId: SCORECARD_ID, initial: INITIAL, debounceMs: 1000 }),
    { wrapper: createWrapper(createQueryClient()) }
  )

  act(() => result.current.setScore('c1', 3))
  act(() => result.current.setScore('c1', 5))

  expect(mockUpdate).not.toHaveBeenCalled()
})

it('debounces to a single PUT carrying the latest state', async () => {
  const { result } = renderHook(
    () => useScorecardDraft({ scorecardId: SCORECARD_ID, initial: INITIAL, debounceMs: 20 }),
    { wrapper: createWrapper(createQueryClient()) }
  )

  act(() => result.current.setScore('c1', 3))
  act(() => result.current.setScore('c1', 5))
  act(() => result.current.setOverallComment('good call'))

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
  expect(mockUpdate).toHaveBeenCalledWith(SCORECARD_ID, {
    scores: { c1: { value: 5, comment: null } },
    overall_comment: 'good call',
  })
})

it('flushes the latest state exactly once on unmount', async () => {
  const { result, unmount } = renderHook(
    // enabled:false isolates the unmount path from the debounce timer.
    () =>
      useScorecardDraft({
        scorecardId: SCORECARD_ID,
        initial: INITIAL,
        enabled: false,
        flushOnUnmount: true,
      }),
    { wrapper: createWrapper(createQueryClient()) }
  )

  act(() => result.current.setScore('c1', 4))
  unmount()

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
  expect(mockUpdate).toHaveBeenCalledWith(SCORECARD_ID, {
    scores: { c1: { value: 4, comment: null } },
    overall_comment: null,
  })
})

it('does not flush on unmount when the caller opts out', async () => {
  const { result, unmount } = renderHook(
    () =>
      useScorecardDraft({
        scorecardId: SCORECARD_ID,
        initial: INITIAL,
        enabled: false,
        flushOnUnmount: false,
      }),
    { wrapper: createWrapper(createQueryClient()) }
  )

  act(() => result.current.setScore('c1', 4))
  unmount()

  await Promise.resolve()
  expect(mockUpdate).not.toHaveBeenCalled()
})
