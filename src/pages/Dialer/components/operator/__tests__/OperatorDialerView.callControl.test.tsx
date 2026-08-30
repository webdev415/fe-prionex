import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DialerQueue, RoutedCall } from '@/features/dialer'

// The operator view is where the two routed-call sources, the queue's
// accept_mode and the operator's own toggle all meet. Under the aggressive
// driver every one of those decides whether a live customer is attended, so the
// combinations are pinned here rather than left to the components below.

const phone = {
  status: 'ready' as const,
  aor: 'operator-c22-u63',
  routedCall: null as null | {
    call_id: string
    client_id: number | null
    client_name: string | null
    phone: string | null
    campaign_id: number | null
  },
  answeredCallId: null as string | null,
  answerCall: vi.fn<(callId: string) => void>(),
  hangupCall: vi.fn<(callId: string) => void>(),
  clearRoutedCall: vi.fn(),
}

const socket = {
  routedCall: null as RoutedCall | null,
  queueComplete: false,
  clearRoutedCall: vi.fn(),
  connected: true,
}

let session: { queue_id: number | null; status: string; auto_connect: boolean } | undefined

const campaign = (over: Partial<DialerQueue> = {}) =>
  ({
    id: 7,
    name: 'Test queue',
    answer_mode: 'manual',
    telephony_type: 'white',
    wait_time_seconds: 8,
    is_active: true,
    ...over,
  }) as DialerQueue

let campaigns: DialerQueue[] = [campaign()]

vi.mock('@/features/dialer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/dialer')>()
  return {
    ...actual,
    useDialerQueues: () => ({ data: campaigns, isLoading: false }),
    useMyDialerSession: () => ({ data: session }),
    useJoinQueue: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useLeaveQueue: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDialerSocket: () => socket,
  }
})

vi.mock('@/features/operatorPhone', () => ({
  useOperatorPhone: () => phone,
  OperatorPhonePanel: () => null,
}))

import { OperatorDialerView } from '../OperatorDialerView'

// The active-call panel pulls the client summary, so the tree needs a client.
function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const result = rtlRender(ui, { wrapper })
  return { ...result, rerender: (next: ReactElement) => result.rerender(next) }
}

const ROUTED = {
  call_id: 'c-1',
  client_id: 218882,
  client_name: 'Олена Коваленко',
  phone: '380501234567',
  campaign_id: 7,
}

beforeEach(() => {
  vi.clearAllMocks()
  phone.routedCall = null
  phone.answeredCallId = null
  socket.routedCall = null
  socket.queueComplete = false
  campaigns = [campaign()]
  session = { queue_id: 7, status: 'active', auto_connect: false }
})

describe('OperatorDialerView call control', () => {
  it('waits for the phone to confirm before showing the call as connected', () => {
    // Accept can be dropped — the frame may still be loading, or hold no live
    // session — and an optimistic panel would time a call nobody answered.
    phone.routedCall = ROUTED
    const { rerender } = render(<OperatorDialerView />)
    expect(screen.getByText('dialer.call.acceptCall')).toBeTruthy()

    phone.answeredCallId = 'c-1'
    rerender(<OperatorDialerView />)
    expect(screen.queryByText('dialer.call.acceptCall')).toBeNull()
  })

  it('does not offer to accept a call the gateway has already bridged', () => {
    // answer_mode 'auto' means the customer is connected with no chance to
    // decline; prompting would show an Accept button over live audio.
    campaigns = [campaign({ answer_mode: 'auto' })]
    phone.routedCall = ROUTED
    render(<OperatorDialerView />)

    expect(screen.queryByText('dialer.call.acceptCall')).toBeNull()
    // The per-operator toggle cannot change that outcome, so it is not offered.
    expect(screen.queryByText('dialer.call.autoConnection')).toBeNull()
  })

  it('shows the call even when the operator is browsing another campaign', () => {
    // With auto-answer pushed down, the phone can connect a customer while the
    // CRM renders some other campaign and no call UI at all.
    campaigns = [campaign(), campaign({ id: 9, name: 'Another queue' })]
    phone.routedCall = ROUTED
    render(<OperatorDialerView />)

    expect(screen.getByText('dialer.call.acceptCall')).toBeTruthy()
  })

  it('seeds the auto-connection toggle from the session, not from off', () => {
    // After a reload while joined, showing "off" while the phone keeps
    // answering puts the display and the thing answering calls in disagreement.
    session = { queue_id: 7, status: 'active', auto_connect: true }
    render(<OperatorDialerView />)

    const toggle = screen.getByText('dialer.call.autoConnection').closest('button')
    expect(toggle?.getAttribute('data-active') ?? toggle?.className).toBeTruthy()
  })

  it('answers the specific call the operator was shown', () => {
    phone.routedCall = ROUTED
    render(<OperatorDialerView />)

    screen.getByText('dialer.call.acceptCall').click()

    expect(phone.answerCall).toHaveBeenCalledWith('c-1')
  })
})
