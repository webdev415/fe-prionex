/**
 * What gets sent for work format, when the store's user arrives incomplete.
 *
 * The page refreshes the auth user on mount because the store copy may be
 * partial - when /users/me fails the store builds the user from the token,
 * which carries no work format at all. So the field the form shows before the
 * refresh and the value the server holds can disagree, and the payload cannot
 * decide what to send by comparing them.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

interface TestUser {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  timezone: string
  language: string
  work_format?: 'office' | 'remote' | null
  is_agent: boolean
  agent_status: string
  permissions: string[]
  projects: never[]
}

const state = vi.hoisted(() => ({ user: null as unknown }))
const updateMyProfile = vi.hoisted(() => vi.fn().mockResolvedValue({}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: state.user, isLoading: false }),
  useUpdateMyProfile: () => ({ mutateAsync: updateMyProfile }),
  ChangePasswordModal: () => null,
  TwoFactorSection: () => null,
}))
// Phone binding has its own tests; here it only must not reach the network.
vi.mock('@/features/appLogin', () => ({ AppLoginSection: () => null }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ refreshUser: vi.fn() }),
}))
vi.mock('@/features/auth/api/authApi', () => ({
  authApi: { changePassword: vi.fn(), uploadAvatar: vi.fn(), deleteAvatar: vi.fn() },
}))
vi.mock('@/components/layout/ProjectSelector', () => ({ ProjectSelector: () => null }))
vi.mock('../AppearanceSettings', () => ({ AppearanceSettings: () => null }))
vi.mock('@/features/auth/hooks/useMyPersonalInformation', () => ({
  useMyPersonalInformation: () => ({ data: undefined }),
  useUpdateMyPersonalInformation: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutateAsync: vi.fn() }),
}))

const { ProfileSettingsPage } = await import('../ProfileSettingsPage')

/** A user as the token fallback builds it: no work format at all. */
function tokenBuiltUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: '1',
    username: 'admin',
    email: 'admin@technofinance.com',
    firstName: 'System',
    lastName: 'Administrator',
    timezone: 'Europe/Kyiv',
    language: 'en',
    is_agent: false,
    agent_status: 'offline',
    permissions: [],
    projects: [],
    ...overrides,
  }
}

function choose(option: 'Office' | 'Remote') {
  const trigger = document.getElementById('work-format') as HTMLButtonElement
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(trigger)
  return screen.findByRole('menu').then((menu) => {
    fireEvent.click(within(menu).getByText(option))
    return trigger
  })
}

const cancelButton = () => screen.queryByRole('button', { name: /^cancel$/i })

describe('work format when the store user arrives incomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.user = tokenBuiltUser()
  })

  it('shows no unsaved changes when the refresh brings a value the form did not have', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    expect(document.getElementById('work-format')).toHaveTextContent('Office')

    // The refresh lands and reports what the server actually holds.
    state.user = tokenBuiltUser({ work_format: 'remote' })
    rerender(<ProfileSettingsPage />)

    await waitFor(() => expect(document.getElementById('work-format')).toHaveTextContent('Remote'))
    // The user changed nothing, so nothing may be offered to save.
    expect(cancelButton()).not.toBeInTheDocument()
  })

  it('sends the choice even when it matches what the field already displayed', async () => {
    render(<ProfileSettingsPage />)

    // The field falls back to Office, but the server may hold remote - picking
    // Office is a real correction and has to travel.
    await choose('Office')

    fireEvent.click(await screen.findByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalled())
    expect(updateMyProfile.mock.calls[0][0].work_format).toBe('office')
  })

  it('omits the field when the user never opened the dropdown', async () => {
    render(<ProfileSettingsPage />)

    fireEvent.change(screen.getByDisplayValue('admin@technofinance.com'), {
      target: { value: 'new@technofinance.com' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalled())
    expect(updateMyProfile.mock.calls[0][0].work_format).toBeUndefined()
  })

  it('stops offering the choice again once it is cancelled', async () => {
    render(<ProfileSettingsPage />)
    await choose('Remote')
    expect(cancelButton()).toBeInTheDocument()

    fireEvent.click(cancelButton() as HTMLElement)

    await waitFor(() => expect(cancelButton()).not.toBeInTheDocument())
    expect(document.getElementById('work-format')).toHaveTextContent('Office')
  })
})

describe('a refresh landing in the middle of an edit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.user = tokenBuiltUser({ work_format: 'office' })
  })

  it('keeps what the user typed', async () => {
    // The photo control refreshes the auth user after every upload, so this
    // lands while the form is dirty rather than only on mount.
    const { rerender } = render(<ProfileSettingsPage />)
    const firstName = screen.getByDisplayValue('System')
    fireEvent.change(firstName, { target: { value: 'Olena' } })

    state.user = tokenBuiltUser({ work_format: 'office' })
    rerender(<ProfileSettingsPage />)

    await waitFor(() => expect(screen.getByDisplayValue('Olena')).toBeInTheDocument())
  })

  it('still offers to save what the user typed', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    fireEvent.change(screen.getByDisplayValue('System'), { target: { value: 'Olena' } })
    expect(cancelButton()).toBeInTheDocument()

    state.user = tokenBuiltUser({ work_format: 'office' })
    rerender(<ProfileSettingsPage />)

    // The bar disappearing here would be the edit vanishing with no signal.
    await waitFor(() => expect(cancelButton()).toBeInTheDocument())
  })

  it('does not revert a work format the user just picked', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    await choose('Remote')

    state.user = tokenBuiltUser({ work_format: 'office' })
    rerender(<ProfileSettingsPage />)

    await waitFor(() => expect(document.getElementById('work-format')).toHaveTextContent('Remote'))
  })

  it('saves the format the user picked, not the one the refresh carried', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    await choose('Remote')

    state.user = tokenBuiltUser({ work_format: 'office' })
    rerender(<ProfileSettingsPage />)

    fireEvent.click(await screen.findByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalled())
    expect(updateMyProfile.mock.calls[0][0].work_format).toBe('remote')
  })

  it('still adopts server values for fields the user has not touched', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    fireEvent.change(screen.getByDisplayValue('System'), { target: { value: 'Olena' } })

    state.user = tokenBuiltUser({ work_format: 'office', lastName: 'Kovalchuk' })
    rerender(<ProfileSettingsPage />)

    await waitFor(() => expect(screen.getByDisplayValue('Kovalchuk')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Olena')).toBeInTheDocument()
  })
})

describe('a refresh landing after the user picked the value already displayed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The token fallback carries no work format, so the field shows its office
    // default while the server may well hold remote.
    state.user = tokenBuiltUser()
  })

  it('does not let the refresh overwrite the pick', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    await choose('Office')

    state.user = tokenBuiltUser({ work_format: 'remote' })
    rerender(<ProfileSettingsPage />)

    // Nothing here is comparable - the pick matched what was on screen - so
    // only the record that the user chose can keep it.
    await waitFor(() => expect(document.getElementById('work-format')).toHaveTextContent('Office'))
  })

  it('saves the pick rather than the value the refresh carried', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    await choose('Office')

    state.user = tokenBuiltUser({ work_format: 'remote' })
    rerender(<ProfileSettingsPage />)

    fireEvent.click(await screen.findByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalled())
    expect(updateMyProfile.mock.calls[0][0].work_format).toBe('office')
  })
})

describe('agent status across a refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.user = tokenBuiltUser({ is_agent: true, agent_status: 'offline' })
  })

  async function chooseStatus(label: 'Online' | 'Busy' | 'Offline') {
    const trigger = document.getElementById('agent-status') as HTMLButtonElement
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(trigger)
    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByText(label))
    return trigger
  }

  it('offers to save a status change on its own', async () => {
    render(<ProfileSettingsPage />)

    await chooseStatus('Online')

    // Nothing else was edited, so the bar exists only if the status counts.
    await waitFor(() => expect(cancelButton()).toBeInTheDocument())
  })

  it('does not revert a status the user just picked', async () => {
    // The photo control refreshes the auth user after every upload, so this
    // lands while the pick is unsaved.
    const { rerender } = render(<ProfileSettingsPage />)
    const trigger = await chooseStatus('Online')

    state.user = tokenBuiltUser({ is_agent: true, agent_status: 'offline' })
    rerender(<ProfileSettingsPage />)

    await waitFor(() => expect(trigger).toHaveTextContent('Online'))
  })

  it('saves the status the user picked, not the one the refresh carried', async () => {
    const { rerender } = render(<ProfileSettingsPage />)
    await chooseStatus('Online')

    state.user = tokenBuiltUser({ is_agent: true, agent_status: 'offline' })
    rerender(<ProfileSettingsPage />)

    fireEvent.click(await screen.findByRole('button', { name: /save/i }))

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalled())
    expect(updateMyProfile.mock.calls[0][0].agent_status).toBe('online')
  })

  it('puts the status back when the edit is cancelled', async () => {
    render(<ProfileSettingsPage />)
    const trigger = await chooseStatus('Online')

    fireEvent.click(cancelButton() as HTMLElement)

    await waitFor(() => expect(trigger).toHaveTextContent('Offline'))
    expect(cancelButton()).not.toBeInTheDocument()
  })

  it('still adopts a status the user has not touched', async () => {
    const { rerender } = render(<ProfileSettingsPage />)

    state.user = tokenBuiltUser({ is_agent: true, agent_status: 'busy' })
    rerender(<ProfileSettingsPage />)

    await waitFor(() => expect(document.getElementById('agent-status')).toHaveTextContent('Busy'))
    expect(cancelButton()).not.toBeInTheDocument()
  })
})
