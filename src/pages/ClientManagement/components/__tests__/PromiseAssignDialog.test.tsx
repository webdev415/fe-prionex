/**
 * PromiseAssignDialog — the onAssigned contract.
 *
 * Selecting a requires_payload tag routes here instead of through
 * TagSelectorModal's handleSave, so this dialog is the only place that can tell
 * the parent a payload tag was assigned. Without it, promise_to_pay -- a
 * requires_payload tag, and the one most likely to have a chain attached --
 * never armed auto-open of the chain executor, so the feature missed its most
 * probable case.
 *
 * Cases:
 *   - assign succeeds -> called once, and the dialog closes
 *   - assign rejects   -> never called, and the dialog stays open
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { PromiseAssignDialog } from '../PromiseAssignDialog'

// --- mocks ------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === 'object' && 'defaultValue' in opts) {
        return (opts as { defaultValue: string }).defaultValue
      }
      return key
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const assignSpy = vi.hoisted(() => vi.fn())
vi.mock('@/features/tags/api/tagsApi', () => ({
  assignTagExtended: assignSpy,
}))

// --- helpers ----------------------------------------------------------------

function renderDialog(overrides: { onAssigned?: () => void; onClose?: () => void } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onAssigned = overrides.onAssigned ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()
  render(
    <QueryClientProvider client={qc}>
      <PromiseAssignDialog
        open
        clientId={42}
        clientName="Test Client"
        tagId={7}
        tagName="Promise To Pay"
        onAssigned={onAssigned}
        onClose={onClose}
      />
    </QueryClientProvider>
  )
  return { onAssigned, onClose }
}

/** The dialog defaults promise_date to tomorrow, so Save is enabled on open. */
async function save() {
  const buttons = screen.getAllByRole('button')
  await userEvent.click(buttons[buttons.length - 1])
}

// --- tests ------------------------------------------------------------------

describe('PromiseAssignDialog onAssigned contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignSpy.mockResolvedValue(undefined)
  })

  it('fires once after a payload tag is assigned', async () => {
    const { onAssigned, onClose } = renderDialog()

    await save()

    await waitFor(() => expect(assignSpy).toHaveBeenCalledTimes(1))
    expect(onAssigned).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
  })

  it('sends the promise payload the tag requires', async () => {
    renderDialog()

    await save()

    await waitFor(() => expect(assignSpy).toHaveBeenCalled())
    const [clientId, tagId, body] = assignSpy.mock.calls[0]
    expect([clientId, tagId]).toEqual([42, 7])
    expect(body.payload).toHaveProperty('promise_date')
  })

  it('does not fire when the assign rejects', async () => {
    assignSpy.mockRejectedValue(new Error('boom'))
    const { onAssigned, onClose } = renderDialog()

    await save()

    await waitFor(() => expect(assignSpy).toHaveBeenCalled())
    expect(onAssigned).not.toHaveBeenCalled()
    // The dialog stays open so the operator can retry.
    expect(onClose).not.toHaveBeenCalled()
  })
})
