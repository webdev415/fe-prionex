import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
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
  endedCallId: null as string | null,
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

let lastPhoneOptions: { autoAnswer?: boolean } | undefined
vi.mock('@/features/operatorPhone', () => ({
  useOperatorPhone: (_ref: unknown, options?: { autoAnswer?: boolean }) => {
    lastPhoneOptions = options
    return phone
  },
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
  // cloneElement, not `ui`: React bails out of a re-render when handed the
  // referentially identical element, so the mutated mock would never be read.
  lastRerender = () => result.rerender(cloneElement(ui))
  return result
}

// The phone hook is mocked with a mutable object, so a state change is made by
// reassigning a field and re-rendering.
let lastRerender: (() => void) | null = null
function rerenderView() {
  lastRerender?.()
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
  phone.endedCallId = null
  lastPhoneOptions = undefined
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
    render(<OperatorDialerView />)
    expect(screen.getByText('dialer.call.acceptCall')).toBeTruthy()

    phone.answeredCallId = 'c-1'
    rerenderView()
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

    // Nor is it claimed connected before the phone says the leg is up: an
    // 'auto' queue means the gateway will bridge the call, not that it has.
    expect(screen.queryByText('dialer.call.taChain')).toBeNull()

    phone.answeredCallId = 'c-1'
    rerenderView()
    expect(screen.getByText('dialer.call.taChain')).toBeTruthy()
  })

  it('shows the call even when the operator is browsing another campaign', () => {
    // With auto-answer pushed down, the phone can connect a customer while the
    // CRM renders some other campaign and no call UI at all. The operator has
    // to actually select the other campaign for this to mean anything.
    campaigns = [campaign(), campaign({ id: 9, name: 'Another queue' })]
    render(<OperatorDialerView />)
    screen.getByText('Another queue').click()
    expect(screen.queryByText('dialer.call.acceptCall')).toBeNull()

    phone.routedCall = ROUTED
    rerenderView()

    expect(screen.getByText('dialer.call.acceptCall')).toBeTruthy()
  })

  it('seeds the auto-connection toggle from the session, not from off', () => {
    // After a reload while joined, showing "off" while the phone keeps
    // answering puts the display and the thing answering calls in disagreement.
    // Asserted through the phone rather than through markup: what matters is
    // the value reaching the thing that actually answers calls.
    session = { queue_id: 7, status: 'active', auto_connect: true }
    render(<OperatorDialerView />)

    expect(lastPhoneOptions?.autoAnswer).toBe(true)
  })

  it('arms the phone on an auto-accept queue even with the toggle off', () => {
    // The toggle is hidden on such a queue, so if its stored value were the only
    // input the operator would have no way to make the phone answer at all.
    campaigns = [campaign({ answer_mode: 'auto' })]
    session = { queue_id: 7, status: 'active', auto_connect: false }
    render(<OperatorDialerView />)

    expect(lastPhoneOptions?.autoAnswer).toBe(true)
  })

  it('withdraws an offer that is abandoned before it is answered', () => {
    // A customer hanging up while the phone rings is routine on an outbound
    // dialer. Leaving the prompt up strands an Accept button over a dead leg
    // with no way to dismiss it, and pins campaign navigation to it.
    phone.routedCall = ROUTED
    render(<OperatorDialerView />)
    expect(screen.getByText('dialer.call.acceptCall')).toBeTruthy()

    phone.endedCallId = 'c-1'
    rerenderView()

    expect(screen.queryByText('dialer.call.acceptCall')).toBeNull()
    expect(screen.queryByText('dialer.call.taChain')).toBeNull()
  })

  it('keeps a null client out of the client-bound sections', () => {
    // parsePhoneMessage normalises a missing client to null and the panel
    // guards on it — but only if the view stops substituting id 0, which would
    // otherwise post an interaction to /clients/0/interactions.
    phone.routedCall = { ...ROUTED, client_id: null, client_name: null }
    phone.answeredCallId = 'c-1'
    render(<OperatorDialerView />)

    expect(screen.getByText('dialer.call.noClientInteraction')).toBeTruthy()
    expect(screen.getByText('dialer.call.noClientChain')).toBeTruthy()
    expect(screen.queryByText('dialer.call.viewClient')).toBeNull()
  })

  it('keeps the call on screen for wrap-up after the customer hangs up', () => {
    // The interaction note lives in component state with no draft persistence,
    // so unmounting the panel on call-ended discards whatever was typed — on
    // the most common way a call ends.
    phone.routedCall = ROUTED
    phone.answeredCallId = 'c-1'
    render(<OperatorDialerView />)
    expect(screen.getByText('dialer.call.taChain')).toBeTruthy()

    phone.endedCallId = 'c-1'
    rerenderView()

    expect(screen.getByText('dialer.call.taChain')).toBeTruthy()
    // In wrap-up, so the operator can still save before moving on.
    expect(screen.getByText('dialer.call.skip')).toBeTruthy()
  })

  it('ignores an end reported for a call that has been superseded', () => {
    phone.routedCall = ROUTED
    phone.answeredCallId = 'c-1'
    phone.endedCallId = 'c-0'
    render(<OperatorDialerView />)

    expect(screen.queryByText('dialer.call.skip')).toBeNull()
  })

  it('drops the leg when Hang up is pressed, not when wrap-up ends', () => {
    // The button starts wrap-up rather than calling onHangup, so releasing the
    // leg on onHangup alone would hold the customer on an open line for the
    // whole post-call countdown.
    phone.routedCall = ROUTED
    phone.answeredCallId = 'c-1'
    render(<OperatorDialerView />)

    const end = screen.getByLabelText('dialer.call.hangUp')
    end.click()

    expect(phone.hangupCall).toHaveBeenCalledWith('c-1')
  })

  it('sends the accept once, however often the operator clicks', () => {
    // The prompt stays up until the phone confirms, so a second click is easy —
    // and a repeat accept reaches a call that is already up, which the phone
    // cannot apply.
    phone.routedCall = ROUTED
    render(<OperatorDialerView />)

    const accept = screen.getByText('dialer.call.acceptCall')
    accept.click()
    rerenderView()
    accept.click()

    expect(phone.answerCall).toHaveBeenCalledTimes(1)
  })

  it('does not carry a finished call into the next session', async () => {
    // Neither call source is tied to the session, and answeredCallId is what
    // makes the phone path show a call as connected — so a call left behind
    // returns as a live panel for a customer who hung up long ago.
    phone.routedCall = ROUTED
    phone.answeredCallId = 'c-1'
    render(<OperatorDialerView />)
    expect(screen.getByText('dialer.call.taChain')).toBeTruthy()

    screen.getByText('dialer.operator.leaveDialer').click()

    await waitFor(() => expect(phone.clearRoutedCall).toHaveBeenCalled())
  })

  it('answers the specific call the operator was shown', () => {
    phone.routedCall = ROUTED
    render(<OperatorDialerView />)

    screen.getByText('dialer.call.acceptCall').click()

    expect(phone.answerCall).toHaveBeenCalledWith('c-1')
  })
})
