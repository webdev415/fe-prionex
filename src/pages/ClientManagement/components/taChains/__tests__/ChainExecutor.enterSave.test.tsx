/**
 * KAN-974 — Enter-to-save through the ACTUAL ChainExecutor.
 *
 * The other tests in this folder cover the rules (`decideEnterSave`) and the
 * Radix integration through a hand-built harness. Neither touches the
 * component, and that gap is where every bug in this ticket lived: the wiring
 * looked right in a harness that did not have the app's shape.
 *
 * So this renders the real thing on a real last step and asserts the two
 * halves that a harness cannot: that `canSaveOnEnter` agrees with the Save
 * button actually on screen, and that Enter reaches the same mutation the
 * button does.
 */
import { describe, expect, it, afterAll, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Before ../ChainExecutor: this registers the module mocks it is rendered with.
import {
  createInteraction,
  getClientRects,
  harness,
  installDomStubs,
  resetHarness,
  restoreDomStubs,
} from './chainExecutorHarness'
import { ChainExecutor } from '../ChainExecutor'

beforeAll(installDomStubs)
afterAll(restoreDomStubs)
beforeEach(resetHarness)

/** Wraps the executor the way the client card does: inside a role="dialog". */
function renderInDialog() {
  return render(
    <div role="dialog" tabIndex={-1} data-testid="dialog">
      <ChainExecutor clientId={100} clientName="Test client" />
    </div>
  )
}

describe('ChainExecutor — Enter to save (KAN-974)', () => {
  it('saves via the same mutation as the Save button, with focus on the dialog', async () => {
    const user = userEvent.setup()
    renderInDialog()

    // The premise: this really is a last step with a Save button on screen.
    // Without this the test could pass against a screen that cannot save.
    const saveButton = await screen.findByRole('button', { name: /saveInteraction/i })
    expect(saveButton).toBeInTheDocument()

    // Focus where Radix puts it when a modal opens — the wrapper, not the panel.
    screen.getByTestId('dialog').focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(createInteraction).toHaveBeenCalledTimes(1))
  })

  it('does not save from inside the notes field', async () => {
    const user = userEvent.setup()
    renderInDialog()
    await screen.findByRole('button', { name: /saveInteraction/i })

    const notes = document.querySelector('[data-ta-notes]') as HTMLTextAreaElement
    expect(notes).toBeTruthy()

    notes.focus()
    await user.keyboard('a{Enter}b')

    expect(createInteraction).not.toHaveBeenCalled()
    // And Enter did what it is supposed to do there.
    expect(notes.value).toBe('a\nb')
  })

  it('does not read layout while the operator is typing', async () => {
    // The scoping check forces a synchronous layout, so it must sit behind the
    // key test. Without that ordering every character typed into the notes
    // field reflows the page, once per mounted executor.
    const user = userEvent.setup()
    renderInDialog()
    await screen.findByRole('button', { name: /saveInteraction/i })

    const notes = document.querySelector('[data-ta-notes]') as HTMLTextAreaElement
    notes.focus()
    getClientRects.mockClear()

    await user.keyboard('hello')
    expect(getClientRects).not.toHaveBeenCalled()

    // ...and it still runs when the key actually matters.
    await user.keyboard('{Enter}')
    expect(getClientRects).toHaveBeenCalled()
  })

  it('does not save while the chain list is still loading', async () => {
    // `activeChain` can resolve from the by-id query while the LIST is still
    // loading, so the panel shows a skeleton with no Save button — but the
    // wizard state alone would have said "yes, save".
    harness.isLoadingChains = true
    const user = userEvent.setup()
    renderInDialog()

    expect(screen.queryByRole('button', { name: /saveInteraction/i })).not.toBeInTheDocument()
    screen.getByTestId('dialog').focus()
    await user.keyboard('{Enter}')

    expect(createInteraction).not.toHaveBeenCalled()
  })

  it('does not save when the operator has no manual chains', async () => {
    // The panel renders a "no chains" message instead of the body; an
    // auto-launched instance can still make the wizard state look savable.
    harness.chains = []
    const user = userEvent.setup()
    renderInDialog()

    expect(screen.queryByRole('button', { name: /saveInteraction/i })).not.toBeInTheDocument()
    screen.getByTestId('dialog').focus()
    await user.keyboard('{Enter}')

    expect(createInteraction).not.toHaveBeenCalled()
  })

  it('does not save from a press outside the dialog', async () => {
    const user = userEvent.setup()
    renderInDialog()
    await screen.findByRole('button', { name: /saveInteraction/i })

    expect(document.activeElement).toBe(document.body)
    await user.keyboard('{Enter}')

    expect(createInteraction).not.toHaveBeenCalled()
  })
})
