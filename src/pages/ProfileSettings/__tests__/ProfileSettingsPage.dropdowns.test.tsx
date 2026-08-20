/**
 * The choice fields on Profile Settings are dropdown menus, not selects.
 *
 * Radix gives a Select trigger role="combobox" and a DropdownMenu trigger
 * role="button", so the absence of any combobox on the page is what pins the
 * swap - a field quietly reverting to Select would put one back.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const user = {
  id: '1',
  username: 'admin',
  email: 'admin@technofinance.com',
  firstName: 'System',
  lastName: 'Administrator',
  fullName: 'System Administrator',
  timezone: 'Europe/Kyiv',
  language: 'en',
  work_format: 'office' as const,
  avatar_url: null,
  is_agent: false,
  agent_status: 'offline',
  permissions: [],
  projects: [],
}

const updateMyProfile = vi.hoisted(() => vi.fn().mockResolvedValue({}))

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user, isLoading: false }),
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

function openField(id: string) {
  const trigger = document.getElementById(id) as HTMLButtonElement
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(trigger)
  return trigger
}

describe('ProfileSettingsPage choice fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    render(<ProfileSettingsPage />)
  })

  it('uses dropdown menus rather than selects', () => {
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)

    for (const id of ['language', 'work-format', 'timezone']) {
      expect(document.getElementById(id)?.tagName).toBe('BUTTON')
    }
  })

  it('offers office and remote and nothing else', async () => {
    openField('work-format')

    const menu = await screen.findByRole('menu')
    const items = within(menu).getAllByRole('menuitem')

    expect(items.map((item) => item.textContent?.trim())).toEqual(['Office', 'Remote'])
  })

  it('shows the chosen work format on the trigger', async () => {
    const trigger = openField('work-format')
    expect(trigger).toHaveTextContent('Office')

    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByText('Remote'))

    await waitFor(() => expect(trigger).toHaveTextContent('Remote'))
  })

  it('lists the timezones', async () => {
    const trigger = openField('timezone')
    expect(trigger).toHaveTextContent('Europe/Kyiv')

    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').length).toBeGreaterThan(1)
  })
})
