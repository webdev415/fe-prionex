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
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ refreshUser: vi.fn() }),
}))
vi.mock('@/features/auth/api/authApi', () => ({
  authApi: { changePassword: vi.fn(), uploadAvatar: vi.fn(), deleteAvatar: vi.fn() },
}))
vi.mock('@/components/layout/ProjectSelector', () => ({ ProjectSelector: () => null }))
vi.mock('../AppearanceSettings', () => ({ AppearanceSettings: () => null }))
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
