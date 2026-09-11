import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// The editor reads the operator's own project to build its employee options.
// Neither that nor the option query is what this file is about — it covers the
// shell around the form — so both are stubbed to their simplest shape.
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { active_project_id: '1' }, isLoading: false }),
}))
vi.mock('@/pages/ClientManagement/hooks/useOperatorFilterOptions', () => ({
  useOperatorFilterOptions: () => ({
    employeeOptions: [],
    interactionUserOptions: [],
    searcherOptions: [],
    isReady: true,
  }),
}))

const { ClientFilterPresetsSettings } = await import('../components/ClientFilterPresetsSettings')

// Radix measures and scrolls its triggers; jsdom implements neither.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

// The ticket is specific about this screen's behaviour, and most of it is easy
// to get subtly wrong: the editor must stay hidden until asked for, the card
// body must not open it, a nameless preset must not save, and deleting the
// preset being edited must not leave the form describing something gone.

describe('ClientFilterPresetsSettings', () => {
  it('starts with no presets and no editor', () => {
    render(<ClientFilterPresetsSettings />)
    expect(screen.getByText('pages.profile.presets.empty')).toBeTruthy()
    expect(screen.queryByLabelText('pages.profile.presets.name')).toBeNull()
  })

  it('opens an empty editor from "New preset"', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))

    expect(screen.getByText('pages.profile.presets.newTitle')).toBeTruthy()
    expect(screen.getByLabelText('pages.profile.presets.name')).toHaveValue('')
  })

  it('refuses to save a preset with no name', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.click(screen.getByText('pages.profile.presets.save'))

    expect(screen.getByText('pages.profile.presets.nameRequired')).toBeTruthy()
    // Nothing was added to the list.
    expect(screen.getByText('pages.profile.presets.empty')).toBeTruthy()
  })

  it('refuses a name that is only whitespace', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), '   ')
    await user.click(screen.getByText('pages.profile.presets.save'))

    expect(screen.getByText('pages.profile.presets.nameRequired')).toBeTruthy()
  })

  it('saves a named preset and confirms it', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Overdue 30+')
    await user.click(screen.getByText('pages.profile.presets.save'))

    expect(screen.getByText('Overdue 30+')).toBeTruthy()
    expect(screen.getByRole('status')).toHaveTextContent('pages.profile.presets.saved')
    expect(screen.queryByText('pages.profile.presets.empty')).toBeNull()
  })

  it('opens the editor from the pencil, not from the card body', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Weekly')
    await user.click(screen.getByText('pages.profile.presets.save'))

    // Clicking the name does nothing — a stray click must not replace whatever
    // is currently being edited.
    await user.click(screen.getByText('Weekly'))
    expect(screen.queryByText('pages.profile.presets.editTitle')).toBeNull()

    await user.click(screen.getByLabelText('pages.profile.presets.edit'))
    expect(screen.getByText('pages.profile.presets.editTitle')).toBeTruthy()
    expect(screen.getByLabelText('pages.profile.presets.name')).toHaveValue('Weekly')
  })

  it('closes the editor when the preset being edited is deleted', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Doomed')
    await user.click(screen.getByText('pages.profile.presets.save'))
    await user.click(screen.getByLabelText('pages.profile.presets.edit'))

    await user.click(screen.getByLabelText('pages.profile.presets.delete'))

    await waitFor(() => expect(screen.queryByText('Doomed')).toBeNull())
    // The form described a preset that no longer exists, so it closed with it.
    expect(screen.queryByText('pages.profile.presets.editTitle')).toBeNull()
  })

  it('renames an existing preset rather than adding a second one', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Before')
    await user.click(screen.getByText('pages.profile.presets.save'))

    await user.click(screen.getByLabelText('pages.profile.presets.edit'))
    await user.clear(screen.getByLabelText('pages.profile.presets.name'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'After')
    await user.click(screen.getByText('pages.profile.presets.save'))

    expect(screen.getByText('After')).toBeTruthy()
    expect(screen.queryByText('Before')).toBeNull()
    expect(screen.getAllByLabelText('pages.profile.presets.edit')).toHaveLength(1)
  })

  it('keeps the typed name when clearing the filter fields', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Keep me')
    await user.click(screen.getByText('pages.profile.presets.clearFields'))

    expect(screen.getByLabelText('pages.profile.presets.name')).toHaveValue('Keep me')
  })
})
