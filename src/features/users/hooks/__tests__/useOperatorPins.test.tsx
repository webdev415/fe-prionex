/**
 * Pin toggles against a real QueryClient.
 *
 * The component tests mock this hook away, so this is where the cache logic is
 * held up: the optimistic move, a failure undoing only its own operator, and a
 * burst of toggles ending in one read of the server's set.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import {
  operatorPinKeys,
  useOperatorPins,
  usePinOperator,
  useUnpinOperator,
} from '../useOperatorPins'
import * as operatorPinsApi from '../../api/operatorPinsApi'
import type { OperatorPinListResponse } from '../../api/operatorPinsApi'

vi.mock('sonner')
vi.mock('../../api/operatorPinsApi')
vi.mock('@/lib/i18n', () => ({
  default: { t: (_key: string, options: { defaultValue: string }) => options.defaultValue },
}))

const api = vi.mocked(operatorPinsApi)

/** A promise the test settles by hand, to hold a request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(initial: number[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  api.getOperatorPins.mockResolvedValue({ operator_ids: initial })
  const hook = renderHook(
    () => ({ pins: useOperatorPins(), pin: usePinOperator(), unpin: useUnpinOperator() }),
    { wrapper }
  )
  const cached = () =>
    queryClient.getQueryData<OperatorPinListResponse>(operatorPinKeys.all)?.operator_ids
  return { hook, cached }
}

describe('operator pin toggles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('moves the row before the server answers', async () => {
    const { hook, cached } = setup([1])
    await waitFor(() => expect(cached()).toEqual([1]))
    const request = deferred<OperatorPinListResponse>()
    api.pinOperator.mockReturnValue(request.promise)

    act(() => hook.result.current.pin.mutate(2))

    await waitFor(() => expect(cached()).toEqual([1, 2]))
  })

  it('puts a failed pin back and says so', async () => {
    const { hook, cached } = setup([1])
    await waitFor(() => expect(cached()).toEqual([1]))
    api.pinOperator.mockRejectedValue(new Error('503'))

    act(() => hook.result.current.pin.mutate(2))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not pin this employee'))
    expect(cached()).toEqual([1])
  })

  it('puts a failed unpin back and says so', async () => {
    const { hook, cached } = setup([1, 2])
    await waitFor(() => expect(cached()).toEqual([1, 2]))
    api.unpinOperator.mockRejectedValue(new Error('503'))

    act(() => hook.result.current.unpin.mutate(2))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not unpin this employee'))
    expect(cached()).toEqual([1, 2])
  })

  it('ends with the server set, read once the toggle settles', async () => {
    const { hook, cached } = setup([1])
    await waitFor(() => expect(cached()).toEqual([1]))
    api.pinOperator.mockResolvedValue({ operator_ids: [1, 2] })
    api.getOperatorPins.mockResolvedValue({ operator_ids: [1, 2, 9] })

    act(() => hook.result.current.pin.mutate(2))

    await waitFor(() => expect(cached()).toEqual([1, 2, 9]))
    expect(api.getOperatorPins).toHaveBeenCalledTimes(2)
  })

  it('a failed toggle does not undo another that is still in flight', async () => {
    const { hook, cached } = setup([1])
    await waitFor(() => expect(cached()).toEqual([1]))
    const first = deferred<OperatorPinListResponse>()
    const second = deferred<OperatorPinListResponse>()
    api.pinOperator.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    act(() => hook.result.current.pin.mutate(2))
    act(() => hook.result.current.pin.mutate(3))
    await waitFor(() => expect(cached()).toEqual([1, 2, 3]))

    await act(async () => first.reject(new Error('503')))

    // Only operator 2 is taken back; 3 is still waiting on its own request, and
    // nothing is refetched while it is.
    await waitFor(() => expect(cached()).toEqual([1, 3]))
    expect(api.getOperatorPins).toHaveBeenCalledTimes(1)

    api.getOperatorPins.mockResolvedValue({ operator_ids: [1, 3] })
    await act(async () => second.resolve({ operator_ids: [1, 3] }))

    // The last one to settle reads the server's set, once.
    await waitFor(() => expect(api.getOperatorPins).toHaveBeenCalledTimes(2))
    expect(cached()).toEqual([1, 3])
  })
})
