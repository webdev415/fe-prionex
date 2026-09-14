import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// The editor reads the operator's own project and fetches the option lists
// behind its dropdowns. Neither is what this file is about — it covers the shell
// around the form — so both are stubbed at their own seam, which also keeps the
// editor's several react-query hooks out of these tests entirely.
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { active_project_id: '1' }, isLoading: false }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: '1' } }),
}))
vi.mock('../hooks/usePresetFilterOptions', () => ({
  usePresetFilterOptions: () => ({
    portfolios: [],
    tags: [],
    rrStatuses: [],
    chains: [],
    employees: [],
    interactionUsers: [],
    searchers: [],
  }),
}))

const { ClientFilterPresetsSettings } = await import('../components/ClientFilterPresetsSettings')
const { useClientFilterPresetStore } = await import('../store/clientFilterPresetStore')

// Radix measures and scrolls its triggers; jsdom implements neither.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

// Presets now live in a persisted store, which is a module singleton — without
// this, each test starts with whatever the previous one saved.
beforeEach(() => {
  useClientFilterPresetStore.setState({ byUser: {} })
})

// The ticket is specific about this screen's behaviour, and most of it is easy
// to get subtly wrong: the editor must stay hidden until asked for, the card
// body must not open it, a nameless preset must not save, and deleting the
// preset being edited must not leave the form describing something gone.

/**
 * Deleting now asks first, so every delete in these tests goes through the
 * dialog. Matched by role and a loose name: the shared `actions.*` keys resolve
 * to real words in the test bundle while feature keys fall through as keys, and
 * this reads the same either way. Scoped to the dialog because the trash icon
 * carries a label of its own.
 */
function dialogButton(pattern: RegExp) {
  return within(screen.getByRole('dialog')).getByRole('button', { name: pattern })
}

async function deleteFirstPreset(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('pages.profile.presets.delete'))
  await user.click(dialogButton(/delete/i))
}

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

    await deleteFirstPreset(user)

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

  it('keeps the preset when the delete is called off', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Spared')
    await user.click(screen.getByText('pages.profile.presets.save'))

    await user.click(screen.getByLabelText('pages.profile.presets.delete'))
    await user.click(dialogButton(/cancel/i))

    // Deleting is irreversible, so backing out must genuinely back out.
    expect(screen.getByText('Spared')).toBeTruthy()
  })

  it('refuses a second preset with a name already in use', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Overdue')
    await user.click(screen.getByText('pages.profile.presets.save'))

    await user.click(screen.getByText('pages.profile.presets.new'))
    // Case and surrounding space do not make it a different name — the menu
    // shows names alone, so the two would be indistinguishable there.
    await user.type(screen.getByLabelText('pages.profile.presets.name'), '  overdue  ')
    await user.click(screen.getByText('pages.profile.presets.save'))

    expect(screen.getByText('pages.profile.presets.nameDuplicate')).toBeTruthy()
    expect(screen.getAllByLabelText('pages.profile.presets.edit')).toHaveLength(1)
  })

  it('lets a preset keep its own name when edited', async () => {
    const user = userEvent.setup()
    render(<ClientFilterPresetsSettings />)
    await user.click(screen.getByText('pages.profile.presets.new'))
    await user.type(screen.getByLabelText('pages.profile.presets.name'), 'Stable')
    await user.click(screen.getByText('pages.profile.presets.save'))

    await user.click(screen.getByLabelText('pages.profile.presets.edit'))
    await user.click(screen.getByText('pages.profile.presets.save'))

    // A preset is not a duplicate of itself.
    expect(screen.queryByText('pages.profile.presets.nameDuplicate')).toBeNull()
    expect(screen.getByText('Stable')).toBeTruthy()
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
