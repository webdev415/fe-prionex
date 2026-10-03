/**
 * Both user modals offer one list of time zones (story 17-66a, board #1700).
 *
 * The create and the edit form used to carry their own copies of the zones, and
 * the copies had drifted from `timezoneOptions` and from each other. A zone
 * saved on a user but missing from the form's copy (America/Edmonton, set for
 * the Canadian operators) rendered as an empty picker. Both forms now render
 * `timezoneOptions`, so a zone added there reaches both of them.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { timezoneOptions } from '../schemas/userSchemas'
import type { UserDetailResponse } from '../types'

vi.mock('../hooks/useCreateUser', () => ({
  useCreateUser: () => ({ mutate: vi.fn(), isError: false, error: null }),
}))

vi.mock('../hooks/useUpdateUser', () => ({
  useUpdateUser: () => ({ mutate: vi.fn(), isError: false, error: null }),
}))

vi.mock('@/features/projects', () => ({
  useProjects: () => ({ data: { projects: [] }, isLoading: false }),
}))

const { CreateUserForm } = await import('../components/CreateUserForm')
const { EditUserForm } = await import('../components/EditUserForm')

function aUser(timezone: string) {
  return {
    id: 42,
    username: 'operator',
    email: 'operator@example.com',
    first_name: 'Test',
    last_name: 'Operator',
    middle_name: '',
    phone: '+1-4035550100',
    language: 'en',
    timezone,
    asterisk_extension: null,
    dialer_extension: null,
    is_agent: false,
    status: 'active',
    projects: [],
  } as unknown as UserDetailResponse
}

const KYIV_LABEL = 'Europe/Kyiv (EET/EEST)'
const EDMONTON_LABEL = 'America/Edmonton (MST/MDT) — Alberta'

/** The picker of the time zone: the one combobox that shows the given zone. */
function timezonePicker(shownLabel: string) {
  const pickers = screen
    .getAllByRole('combobox')
    .filter((el) => el.textContent?.includes(shownLabel))
  expect(pickers).toHaveLength(1)
  return pickers[0]
}

/** Opens the picker and reads the offered options in the order shown. */
async function offeredOptions(picker: HTMLElement) {
  const user = userEvent.setup()
  await user.click(picker)
  const listbox = await screen.findByRole('listbox')
  return within(listbox)
    .getAllByRole('option')
    .map((option) => option.textContent)
}

describe('User forms - the time zone picker', () => {
  it('edit form lists every timezone option', async () => {
    render(<EditUserForm user={aUser('Europe/Kyiv')} onSuccess={vi.fn()} />)

    const options = await offeredOptions(timezonePicker(KYIV_LABEL))

    expect(options).toEqual(timezoneOptions.map((o) => o.label))
  })

  it('create form lists every timezone option', async () => {
    render(<CreateUserForm projects={[]} onSuccess={vi.fn()} />)

    const options = await offeredOptions(timezonePicker(KYIV_LABEL))

    expect(options).toEqual(timezoneOptions.map((o) => o.label))
  })

  it('edit form shows a stored Canadian zone selected', () => {
    render(<EditUserForm user={aUser('America/Edmonton')} onSuccess={vi.fn()} />)

    // Before: the zone was missing from the form's own list and the picker
    // stayed empty. The one picker that names the stored zone is found by its
    // label (timezonePicker asserts exactly one), and no picker shows Kyiv.
    timezonePicker(EDMONTON_LABEL)
    expect(
      screen.getAllByRole('combobox').filter((el) => el.textContent?.includes(KYIV_LABEL))
    ).toHaveLength(0)
  })

  it('edit form falls back to Kyiv for a user without a zone', () => {
    // AC-3: the default Europe/Kyiv is kept for an empty stored value.
    render(<EditUserForm user={aUser('')} onSuccess={vi.fn()} />)

    timezonePicker(KYIV_LABEL)
  })
})
