/**
 * KAN-973 — the listener that turns a keypress into an open TA modal.
 *
 * Every rule it consults is unit-tested next door (`hotkey.ts`,
 * `decideHotkeyLaunch.ts`). What was never covered is the wiring: that the
 * listener is attached at all, that it reads *current* state rather than the
 * values captured when it mounted, and that it detaches on unmount.
 *
 * That gap is worth closing on its own evidence — the same shape of bug (rules
 * right, wiring wrong) cost four rounds in KAN-974.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const toastInfo = vi.fn()
let bindings: Record<string, number> = {}
let hasMinimized = false

vi.mock('../hooks/useTAHotkeys', () => ({
  useTAHotkeyBindings: () => bindings,
}))
vi.mock('@/stores/chainExecutorStore', () => ({
  useChainExecutorStore: (sel: (s: { minimized: unknown }) => unknown) =>
    sel({ minimized: hasMinimized ? { some: 'session' } : null }),
}))
vi.mock('sonner', () => ({ toast: { info: (...a: unknown[]) => toastInfo(...a) } }))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, d?: string) => d ?? k,
      i18n: { language: 'en' },
    }),
  }
})

import { useTAHotkeyLaunch } from '../useTAHotkeyLaunch'

function Harness({
  enabled = true,
  isExecutorOpen = false,
  onLaunch,
}: {
  enabled?: boolean
  isExecutorOpen?: boolean
  onLaunch: (id: number) => void
}) {
  useTAHotkeyLaunch({ enabled, isExecutorOpen, onLaunch })
  return (
    <div>
      <input aria-label="notes" />
      <div role="dialog">
        <input aria-label="inside modal" />
      </div>
    </div>
  )
}

beforeEach(() => {
  toastInfo.mockClear()
  bindings = { 'Ctrl+1': 12 }
  hasMinimized = false
})

describe('useTAHotkeyLaunch', () => {
  it('launches the template bound to the combination', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).toHaveBeenCalledWith(12)
  })

  it('does nothing for a combination nobody assigned', async () => {
    // Bare-key bindings mean most presses reaching this listener are not ours,
    // so silence — no toast, no modal — is the required behaviour.
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}9{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('ignores the combination while the operator is typing', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { getByLabelText } = render(<Harness onLaunch={onLaunch} />)

    await user.click(getByLabelText('notes'))
    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('ignores the combination inside an open dialog', async () => {
    // A hotkey pressed while a modal is up must not reach the page behind it.
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { getByLabelText } = render(<Harness onLaunch={onLaunch} />)

    await user.click(getByLabelText('inside modal'))
    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('refuses to open a second modal, and says why', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness isExecutorOpen onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
    expect(toastInfo).toHaveBeenCalledWith('Finish or close the open target action first')
  })

  it('refuses while a session is minimized, with its own message', async () => {
    hasMinimized = true
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
    expect(toastInfo).toHaveBeenCalledWith('Restore or finish the minimized target action first')
  })

  it('does not listen at all when disabled', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    render(<Harness enabled={false} onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('sees state that changed after it was attached', async () => {
    // The listener is attached once and reads through a ref. If it closed over
    // its first render instead, reassigning a shortcut in settings would not
    // take effect until the page was reloaded.
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<Harness onLaunch={onLaunch} />)

    bindings = { 'Ctrl+1': 99 }
    rerender(<Harness onLaunch={onLaunch} />)

    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).toHaveBeenCalledWith(99)
  })

  it('stops listening once the page unmounts', async () => {
    const onLaunch = vi.fn()
    const user = userEvent.setup()
    const { unmount } = render(<Harness onLaunch={onLaunch} />)

    unmount()
    await user.keyboard('{Control>}1{/Control}')
    expect(onLaunch).not.toHaveBeenCalled()
  })
})
