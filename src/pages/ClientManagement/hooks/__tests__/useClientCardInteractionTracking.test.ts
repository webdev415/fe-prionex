/**
 * The events a client card sends while it is open — the producing side of the
 * activity feed and of screen-time. Each hook is driven through re-renders,
 * because what matters is exactly when an event fires and when it must not.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useCardSelectionTracking,
  useInteractionFormOpenTracking,
  useModalOpenTracking,
} from '../useClientCardInteractionTracking'

const trackEvent = vi.fn()

type Track = typeof trackEvent
type TabProps = { id: string | undefined; tab: string; track?: Track }
type ModalProps = { flags: Record<string, boolean>; track?: Track }
type FormProps = { open: boolean; track?: Track }

beforeEach(() => trackEvent.mockReset())

describe('useCardSelectionTracking', () => {
  const useTab = (props: TabProps) =>
    useCardSelectionTracking(
      'client_card_tab_switch',
      'tab',
      props.id,
      props.tab,
      props.track ?? trackEvent
    )

  it('records the tab a card loads on, marked initial', () => {
    renderHook<void, TabProps>(useTab, { initialProps: { id: '5', tab: 'personal' } })

    expect(trackEvent.mock.calls).toEqual([
      ['client_card_tab_switch', { clientId: 5, meta: { tab: 'personal', initial: true } }],
    ])
  })

  it('records a switch the operator made, not marked initial', () => {
    const { rerender } = renderHook<void, TabProps>(useTab, {
      initialProps: { id: '5', tab: 'personal' },
    })
    rerender({ id: '5', tab: 'loans' })

    expect(trackEvent).toHaveBeenLastCalledWith('client_card_tab_switch', {
      clientId: 5,
      meta: { tab: 'loans' },
    })
    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it('does not record a re-render that changed nothing', () => {
    // `trackEvent` is a useCallback and can change identity on its own.
    const { rerender } = renderHook<void, TabProps>(useTab, {
      initialProps: { id: '5', tab: 'personal' },
    })
    const sameFunctionNewIdentity = vi.fn()
    rerender({ id: '5', tab: 'personal', track: sameFunctionNewIdentity })

    expect(trackEvent).toHaveBeenCalledTimes(1)
    expect(sameFunctionNewIdentity).not.toHaveBeenCalled()
  })

  it('marks the load of another client initial, on the same tab', () => {
    // The card switches client without remounting; screen-time needs the
    // boundary, the feed needs to know nobody clicked.
    const { rerender } = renderHook<void, TabProps>(useTab, {
      initialProps: { id: '5', tab: 'personal' },
    })
    rerender({ id: '6', tab: 'personal' })

    expect(trackEvent).toHaveBeenLastCalledWith('client_card_tab_switch', {
      clientId: 6,
      meta: { tab: 'personal', initial: true },
    })
  })

  it('records nothing without a client', () => {
    renderHook<void, TabProps>(useTab, { initialProps: { id: undefined, tab: 'personal' } })

    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('names sections under their own event and key', () => {
    renderHook(() =>
      useCardSelectionTracking('client_card_section_open', 'section', '5', 'documents', trackEvent)
    )

    expect(trackEvent).toHaveBeenCalledWith('client_card_section_open', {
      clientId: 5,
      meta: { section: 'documents', initial: true },
    })
  })
})

describe('useModalOpenTracking', () => {
  const closed = { writeoff: false, task: false, tag: false }
  const useModals = (props: ModalProps) =>
    useModalOpenTracking('5', props.flags, props.track ?? trackEvent)

  it('records nothing for the state the card loads in', () => {
    // A modal already open on load was not opened by anyone just now.
    renderHook<void, ModalProps>(useModals, { initialProps: { flags: { ...closed, task: true } } })

    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('records a modal being opened, by name', () => {
    const { rerender } = renderHook<void, ModalProps>(useModals, {
      initialProps: { flags: closed },
    })
    rerender({ flags: { ...closed, writeoff: true } })

    expect(trackEvent.mock.calls).toEqual([
      ['client_modal_open', { clientId: 5, meta: { modal: 'writeoff' } }],
    ])
  })

  it('does not record a modal again while it stays open', () => {
    const { rerender } = renderHook<void, ModalProps>(useModals, {
      initialProps: { flags: closed },
    })
    rerender({ flags: { ...closed, writeoff: true } })
    rerender({ flags: { ...closed, writeoff: true } }) // a new object, same state

    expect(trackEvent).toHaveBeenCalledTimes(1)
  })

  it('records it again when it is closed and reopened', () => {
    const { rerender } = renderHook<void, ModalProps>(useModals, {
      initialProps: { flags: closed },
    })
    rerender({ flags: { ...closed, tag: true } })
    rerender({ flags: closed })
    rerender({ flags: { ...closed, tag: true } })

    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it('records each modal that opens in the same change', () => {
    const { rerender } = renderHook<void, ModalProps>(useModals, {
      initialProps: { flags: closed },
    })
    rerender({ flags: { ...closed, task: true, tag: true } })

    expect(trackEvent.mock.calls.map(([, e]) => e.meta.modal).sort()).toEqual(['tag', 'task'])
  })
})

describe('useInteractionFormOpenTracking', () => {
  const useForm = (props: FormProps) =>
    useInteractionFormOpenTracking('5', props.open, props.track ?? trackEvent)

  it('records the form being opened', () => {
    renderHook<void, FormProps>(useForm, { initialProps: { open: true } })

    expect(trackEvent.mock.calls).toEqual([['interaction_form_open', { clientId: 5 }]])
  })

  it('does not record it twice while it stays open', () => {
    // The effect re-runs when `trackEvent` changes identity, and the re-run
    // calls the new one -- so that is the one that must stay silent.
    const { rerender } = renderHook<void, FormProps>(useForm, { initialProps: { open: true } })
    const sameFunctionNewIdentity = vi.fn()
    rerender({ open: true, track: sameFunctionNewIdentity })

    expect(trackEvent).toHaveBeenCalledTimes(1)
    expect(sameFunctionNewIdentity).not.toHaveBeenCalled()
  })

  it('records it again when it is closed and reopened', () => {
    const { rerender } = renderHook<void, FormProps>(useForm, { initialProps: { open: true } })
    rerender({ open: false })
    rerender({ open: true })

    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it('records nothing while the form is closed', () => {
    renderHook<void, FormProps>(useForm, { initialProps: { open: false } })

    expect(trackEvent).not.toHaveBeenCalled()
  })
})
