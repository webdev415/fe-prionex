/**
 * KAN-1067 — where focus lands when the TA modal opens from a hotkey.
 *
 * The bug was never in the Enter rules: `decideEnterSave` correctly stands
 * aside for a focused button, because activating one AND saving would run two
 * actions from a single press. The defect was that the focused button was
 * MINIMIZE — it is the first focusable element in the dialog, and Modal.tsx
 * passes no `onOpenAutoFocus`, so Radix's default put the caret there.
 *
 * These tests therefore assert on `document.activeElement`, not on mutations
 * alone, and render a Minimize button ahead of the panel exactly as
 * ClientDetailPage does — without it the DOM has nothing for focus to land on
 * wrongly, and the test would pass against the bug.
 */
import { describe, expect, it, vi, afterAll, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
// Before ../ChainExecutor: this registers the module mocks it is rendered with.
import {
  createInteraction,
  harness,
  installDomStubs,
  resetHarness,
  restoreDomStubs,
  scrollIntoView,
  twoStepChain,
} from './chainExecutorHarness'
import { ChainExecutor } from '../ChainExecutor'

beforeAll(installDomStubs)
afterAll(restoreDomStubs)
beforeEach(resetHarness)

const findSave = () => screen.findByRole('button', { name: /saveInteraction/i })
const panel = () => document.querySelector('[data-ta-panel]') as HTMLDivElement

/**
 * Reproduces the real opening sequence in two mounts.
 *
 * Mount 1 is the modal chrome alone — Minimize and Close — with focus on
 * Minimize, which is where Radix leaves it: it is the first focusable element
 * in the dialog and Modal.tsx sets no `onOpenAutoFocus`.
 * Mount 2 adds the executor, whose Save is reachable straight away.
 *
 * Rendering both at once would be wrong in a way that HIDES the bug: the
 * executor mounts and focuses Save before the test can put focus on Minimize,
 * so the assertion would pass against code that does nothing.
 *
 * `rerender()` builds a FRESH element every call. Re-passing the identical one
 * lets React bail out of the render entirely, which is how the earlier version
 * of the latch test came to pass against a build with no latch in it.
 */
function openModal(initialTemplateId: number | null = null) {
  const onMinimize = vi.fn()
  const shell = (children: ReactNode) => (
    <div role="dialog" tabIndex={-1} data-testid="dialog">
      <button data-testid="minimize" aria-label="Minimize modal" onClick={onMinimize} />
      <button data-testid="close" aria-label="Close modal" />
      {children}
    </div>
  )

  const { rerender } = render(shell(null))
  const minimize = screen.getByTestId('minimize') as HTMLButtonElement
  minimize.focus()
  expect(document.activeElement).toBe(minimize)

  const mount = () =>
    rerender(
      shell(
        <ChainExecutor
          clientId={100}
          clientName="Test client"
          initialTemplateId={initialTemplateId}
        />
      )
    )
  mount()

  return { minimize, onMinimize, rerender: mount }
}

/**
 * Drives `canSaveOnEnter` false and back to true, the way a save in flight
 * does. That is a real change in the opening-focus effect's dependency array,
 * so the effect actually re-runs — without it a re-render proves nothing about
 * whether focus would be grabbed a second time.
 */
async function cycleSaveAvailability(rerender: () => void) {
  harness.createPending = true
  rerender()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /saveInteraction/i })).toBeDisabled()
  )
  harness.createPending = false
  rerender()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /saveInteraction/i })).toBeEnabled()
  )
}

describe('ChainExecutor — opening focus (KAN-1067)', () => {
  it('moves focus off Minimize and onto Save for a hotkey launch', async () => {
    const { minimize } = openModal(5)

    const save = await findSave()
    await waitFor(() => expect(document.activeElement).toBe(save))
    expect(document.activeElement).not.toBe(minimize)
  })

  it('so the first Enter saves instead of minimizing', async () => {
    const user = userEvent.setup()
    const { onMinimize } = openModal(5)

    const save = await findSave()
    await waitFor(() => expect(document.activeElement).toBe(save))

    // No click, no tab — the operator's very first keystroke, which is the
    // whole complaint in the ticket.
    await user.keyboard('{Enter}')
    await waitFor(() => expect(createInteraction).toHaveBeenCalledTimes(1))
    expect(onMinimize).not.toHaveBeenCalled()
  })

  it('focuses Save without dragging the modal body down to it', async () => {
    // Save is the last element of a column inside ModalContent, which is
    // `overflow-auto max-h-[calc(90vh-140px)]`. A plain focus() scrolls that
    // container to the bottom, so a panel taller than the viewport would open
    // on the end of a form the operator has not filled in yet.
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus')
    try {
      openModal(5)
      const save = await findSave()
      await waitFor(() => expect(document.activeElement).toBe(save))

      const saveFocusIndex = focusSpy.mock.contexts.indexOf(save)
      expect(saveFocusIndex).toBeGreaterThanOrEqual(0)
      expect(focusSpy.mock.calls[saveFocusIndex][0]).toEqual({ preventScroll: true })
    } finally {
      focusSpy.mockRestore()
    }

    // ...and the panel is brought to its own top instead, so the form still
    // reads from the beginning.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('leaves a manual open alone', async () => {
    // Third criterion. Focus was never on Minimize in this flow in production,
    // and moving it here would be a new bug rather than a fix.
    const { minimize } = openModal(null)

    await findSave()
    await waitFor(() => expect(document.activeElement).toBe(minimize))
  })

  it('does not pull the caret out of a field when Save comes back', async () => {
    // Save comes and goes as the wizard advances and as a save flies. Focus
    // the operator has moved INTO the panel is theirs; re-focusing Save on
    // every reappearance would interrupt whatever they are typing.
    const { rerender } = openModal(5)

    const save = await findSave()
    await waitFor(() => expect(document.activeElement).toBe(save))

    const notes = document.querySelector('[data-ta-notes]') as HTMLTextAreaElement
    expect(notes).toBeTruthy()
    notes.focus()
    await cycleSaveAvailability(rerender)

    expect(document.activeElement).toBe(notes)
  })

  it('does not chase focus back once the operator has left the panel', async () => {
    // The latch, on its own. Focus outside the panel is exactly what the
    // opening effect exists to correct, so the "operator got there first"
    // guard does NOT cover this case — only the once-per-mount latch does.
    // An operator who tabbed back to Minimize while a save was in flight must
    // not have the caret yanked to Save when the button re-enables.
    const { minimize, rerender } = openModal(5)

    const save = await findSave()
    await waitFor(() => expect(document.activeElement).toBe(save))

    minimize.focus()
    await cycleSaveAvailability(rerender)

    expect(document.activeElement).toBe(minimize)
  })

  it('still moves focus off Minimize when the chain has more steps to go', async () => {
    // `canSaveOnEnter` needs `isLastStep`, so on step 1 of 2 there is no Save
    // button to focus. Leaving the caret where Radix put it would leave the
    // ticket's complaint intact for every multi-step chain, so focus is parked
    // on the panel itself: focusable, but nothing Enter can activate.
    harness.chain = twoStepChain
    harness.chains = [twoStepChain]
    const user = userEvent.setup()
    const { minimize, onMinimize } = openModal(5)

    await waitFor(() => expect(panel()).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /saveInteraction/i })).not.toBeInTheDocument()

    await waitFor(() => expect(document.activeElement).toBe(panel()))
    expect(document.activeElement).not.toBe(minimize)

    // The point of all of it: the first Enter no longer minimizes the modal,
    // and it does not save from a step that has no Save either.
    await user.keyboard('{Enter}')
    expect(onMinimize).not.toHaveBeenCalled()
    expect(createInteraction).not.toHaveBeenCalled()
  })

  it('still lets Minimize be clicked normally', async () => {
    // Fourth criterion: the button keeps working, it just no longer starts
    // with the caret on it.
    const user = userEvent.setup()
    const { onMinimize } = openModal(5)

    await findSave()
    await user.click(screen.getByTestId('minimize'))
    expect(onMinimize).toHaveBeenCalledTimes(1)
  })
})
