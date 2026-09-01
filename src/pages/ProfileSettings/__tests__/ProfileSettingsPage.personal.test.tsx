/**
 * The card fields somebody keeps about themselves, on Profile Settings.
 *
 * They sit in the same form as the name and phone above them, with one Save
 * between them: to the person filling it in they are all the same kind of
 * thing, and only the table behind them differs. That the second write is a
 * second request is an implementation detail the form must not leak - so what
 * these cover is the seam. One button, both writes, and the card write only
 * when a card field actually changed.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const USER = {
  id: '7',
  username: 'operator1',
  email: 'op@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  middle_name: '',
  phone: '',
  language: 'en',
  timezone: 'Europe/Kyiv',
  agent_status: 'offline',
  work_format: 'office',
  permissions: [],
  active_department_id: null,
}

const updateProfile = vi.hoisted(() => vi.fn())
const updatePersonal = vi.hoisted(() => vi.fn())
const stored = vi.hoisted(() => ({
  value: {
    date_of_birth: '1994-05-12',
    telegram: '@ada',
    city: 'Kyiv',
    address: 'Khreshchatyk 1',
    nova_poshta_branch: 'Branch No. 5',
  } as Record<string, string | null> | undefined,
}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: USER, isLoading: false }),
  useUpdateMyProfile: () => ({ mutateAsync: updateProfile }),
  ChangePasswordModal: () => null,
  TwoFactorSection: () => null,
}))
vi.mock('@/features/auth/hooks/useMyPersonalInformation', () => ({
  useMyPersonalInformation: () => ({ data: stored.value }),
  useUpdateMyPersonalInformation: () => ({ mutateAsync: updatePersonal }),
}))
vi.mock('@/features/auth/api/authApi', () => ({ authApi: { changePassword: vi.fn() } }))
vi.mock('@/stores/authStore', () => {
  const state = { user: { permissions: [] }, refreshUser: vi.fn() }
  return { useAuthStore: (sel?: (s: unknown) => unknown) => (sel ? sel(state) : state) }
})
vi.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutateAsync: vi.fn() }) }))
vi.mock('../AppearanceSettings', () => ({ AppearanceSettings: () => null }))
vi.mock('@/components/layout/ProjectSelector', () => ({ ProjectSelector: () => null }))
vi.mock('@/features/taHotkeys/components/KeyboardShortcutsSettings', () => ({
  KeyboardShortcutsSettings: () => null,
}))

const { ProfileSettingsPage } = await import('../ProfileSettingsPage')

const field = (label: string) => screen.getByLabelText(label)
const saveButtons = () => screen.queryAllByRole('button', { name: /pages.profile.saveChanges/ })

describe('Profile Settings: the card fields', () => {
  beforeEach(() => {
    updateProfile.mockReset().mockResolvedValue({})
    updatePersonal.mockReset().mockResolvedValue({})
    stored.value = {
      date_of_birth: '1994-05-12',
      telegram: '@ada',
      city: 'Kyiv',
      address: 'Khreshchatyk 1',
      nova_poshta_branch: 'Branch No. 5',
    }
  })

  it('shows what is stored, once it has arrived', async () => {
    render(<ProfileSettingsPage />)

    await waitFor(() => expect(field('pages.employeeCard.fields.city')).toHaveValue('Kyiv'))
    expect(field('pages.employeeCard.fields.telegram')).toHaveValue('@ada')
  })

  /*
   * The complaint that produced this: two headed sections, two buttons, for
   * fields that are all personal information. One button is the whole point.
   */
  it('offers a single save for the whole form', async () => {
    render(<ProfileSettingsPage />)

    await userEvent.type(field('pages.employeeCard.fields.city'), '!')

    expect(saveButtons()).toHaveLength(1)
  })

  it('keeps them in the one form rather than a section of their own', () => {
    const { container } = render(<ProfileSettingsPage />)

    const forms = container.querySelectorAll('form')
    expect(forms).toHaveLength(1)
    expect(forms[0]).toContainElement(field('pages.employeeCard.fields.city'))
    expect(forms[0]).toContainElement(field('pages.users.forms.firstName'))
  })

  /*
   * The form paired its fields only from 2xl - 1536px - so on any ordinary
   * laptop every field ran the full width, one per row, and the form was a
   * very long single column with nothing beside it.
   */
  it('pairs its fields on a laptop, not only on a very wide screen', () => {
    const { container } = render(<ProfileSettingsPage />)

    const rows = Array.from(container.querySelectorAll('form div')).filter((node) =>
      node.className.includes('flex-row')
    )

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.className).toContain('md:flex-row')
      expect(row.className).not.toContain('2xl:flex-row')
    }
  })

  it('leaves no empty cell beside the last field', () => {
    const { container } = render(<ProfileSettingsPage />)

    const empties = Array.from(container.querySelectorAll('form div')).filter(
      (node) => node.className.trim() === 'w-full' && node.children.length === 0
    )

    expect(empties).toHaveLength(0)
  })

  it('picks a date of birth with the date control rather than a bare input', () => {
    const { container } = render(<ProfileSettingsPage />)

    expect(container.querySelector('input[type="date"]')).toBeNull()
  })

  it('sends a changed card field when the one button is pressed', async () => {
    render(<ProfileSettingsPage />)
    await waitFor(() => expect(field('pages.employeeCard.fields.city')).toHaveValue('Kyiv'))

    await userEvent.clear(field('pages.employeeCard.fields.city'))
    await userEvent.type(field('pages.employeeCard.fields.city'), 'Lviv')
    await userEvent.click(saveButtons()[0])

    await waitFor(() => expect(updatePersonal).toHaveBeenCalledWith({ city: 'Lviv' }))
  })

  it('sends only the card fields that changed', async () => {
    render(<ProfileSettingsPage />)
    await waitFor(() => expect(field('pages.employeeCard.fields.city')).toHaveValue('Kyiv'))

    await userEvent.type(field('pages.employeeCard.fields.telegram'), '_k')
    await userEvent.click(saveButtons()[0])

    await waitFor(() => expect(updatePersonal).toHaveBeenCalled())
    expect(Object.keys(updatePersonal.mock.calls[0][0])).toEqual(['telegram'])
  })

  /*
   * A language switch is not a card write. Sending one anyway would give the
   * save a second way to fail for something nobody touched.
   */
  it('does not write the card when only a profile field changed', async () => {
    render(<ProfileSettingsPage />)
    await waitFor(() => expect(field('pages.employeeCard.fields.city')).toHaveValue('Kyiv'))

    await userEvent.type(field('pages.users.forms.firstName'), 'x')
    await userEvent.click(saveButtons()[0])

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updatePersonal).not.toHaveBeenCalled()
  })

  it('sends an emptied card field as null, so it can be taken back', async () => {
    render(<ProfileSettingsPage />)
    await waitFor(() => expect(field('pages.employeeCard.fields.city')).toHaveValue('Kyiv'))

    await userEvent.clear(field('pages.employeeCard.fields.city'))
    await userEvent.click(saveButtons()[0])

    await waitFor(() => expect(updatePersonal).toHaveBeenCalledWith({ city: null }))
  })

  it('puts a card field back when the edit is abandoned', async () => {
    render(<ProfileSettingsPage />)
    await waitFor(() => expect(field('pages.employeeCard.fields.city')).toHaveValue('Kyiv'))

    await userEvent.clear(field('pages.employeeCard.fields.city'))
    await userEvent.type(field('pages.employeeCard.fields.city'), 'Lviv')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(field('pages.employeeCard.fields.city')).toHaveValue('Kyiv')
    expect(updatePersonal).not.toHaveBeenCalled()
  })

  it('renders the fields empty rather than blank-looking when nothing is stored', () => {
    stored.value = undefined
    render(<ProfileSettingsPage />)

    expect(field('pages.employeeCard.fields.city')).toHaveValue('')
  })
})
