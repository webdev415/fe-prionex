import { describe, it, expect, vi, beforeAll } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { CallInteractionForm } from '../CallInteractionForm'

// Radix Select drives its trigger through pointer capture, which jsdom lacks.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const results = [
  { id: 1, name: 'Refusal' },
  { id: 2, name: 'Client informed' },
]
const reasons = [{ id: 10, name: 'Debt restructuring' }]
const channels = [
  { id: 100, name: 'Phone' },
  { id: 101, name: 'SMS' },
]

function renderForm(props: Partial<Parameters<typeof CallInteractionForm>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <CallInteractionForm
      results={results}
      reasons={reasons}
      channels={channels}
      onSave={onSave}
      {...props}
    />
  )
  return { onSave }
}

// Queried by id and role rather than by label text: the i18n mock returns the
// key instead of the translation, so a text query would assert against
// `pages.clients...` and pass for the wrong reason.
const resultSelect = () => document.querySelector('#call-interaction-result') as HTMLElement
const comment = () => screen.getByRole('textbox')
const saveButton = () => screen.getByRole('button')

async function chooseResult(name: string) {
  fireEvent.click(resultSelect())
  fireEvent.click(await screen.findByRole('option', { name }))
}

describe('CallInteractionForm', () => {
  it('cannot be saved until a result is chosen', () => {
    renderForm()

    // The only required field in the spec; everything else is optional, so this
    // is the one thing standing between the operator and a saved interaction.
    expect(saveButton()).toBeDisabled()
  })

  it('enables saving once a result is chosen', async () => {
    renderForm()

    await chooseResult('Refusal')

    await waitFor(() => expect(saveButton()).toBeEnabled())
  })

  it('reports what the operator entered', async () => {
    const { onSave } = renderForm()

    await chooseResult('Client informed')
    fireEvent.change(comment(), { target: { value: '  Promised to pay Friday  ' } })
    fireEvent.click(saveButton())

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        resultId: 2,
        reasonId: null,
        channelId: 100,
        comment: 'Promised to pay Friday',
      })
    )
  })

  it('defaults the channel rather than leaving it empty', async () => {
    const { onSave } = renderForm()

    await chooseResult('Refusal')
    fireEvent.click(saveButton())

    // The id, not the label: only the id can be filed, and reporting the name
    // is how this field came to be collected and then silently dropped.
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ channelId: 100 }))
    )
  })

  it('shows the confirmation in place of the form once saved', () => {
    renderForm({ saved: true })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('keeps what was typed when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('nope'))
    render(
      <CallInteractionForm
        results={results}
        reasons={reasons}
        channels={channels}
        onSave={onSave}
      />
    )

    await chooseResult('Refusal')
    fireEvent.change(comment(), { target: { value: 'Long note the operator typed' } })
    fireEvent.click(saveButton())

    // Losing a comment written during a live call is not recoverable — the
    // caller is on the line and the operator would have to type it again.
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(comment()).toHaveValue('Long note the operator typed')
    await waitFor(() => expect(saveButton()).toBeEnabled())
  })
})
