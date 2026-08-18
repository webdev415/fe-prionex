/**
 * Profile Settings tabs (KAN-975).
 *
 * KAN-975 split the right-hand column into Account | Keyboard Shortcuts. The
 * page had no tests before that, so the restructure could have moved the
 * account form inside or outside the wrong branch and nothing would have
 * noticed. These cover the split itself: both tabs reachable, and the account
 * form still rendered where it was.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Hoisted, not rebuilt per call: the page syncs its form in an effect keyed on
// `user`, so a fresh object each render would loop. The real hook returns a
// cached object, which is what this reproduces.
const USER = {
  username: 'operator1',
  email: 'op@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  middle_name: '',
  phone: '',
  language: 'en',
  timezone: 'Europe/Kyiv',
  asterisk_extension: '2099',
  agent_status: 'online',
  role_name: 'Operator',
  permissions: [],
  active_department_id: null,
}

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: USER, isLoading: false }),
  useUpdateMyProfile: () => ({ mutateAsync: vi.fn() }),
  ChangePasswordModal: () => null,
  TwoFactorSection: () => <div>Two-Factor</div>,
}))
vi.mock('@/features/auth/api/authApi', () => ({ authApi: { changePassword: vi.fn() } }))
// The store object is built once, not per call: the page selects `refreshUser`
// and depends on it in an effect, so a fresh function each render would loop.
vi.mock('@/stores/authStore', () => {
  const state = {
    user: { permissions: [], active_department_id: null },
    refreshUser: vi.fn(),
  }
  return {
    useAuthStore: (sel?: (s: unknown) => unknown) => (sel ? sel(state) : state),
  }
})
vi.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutateAsync: vi.fn() }) }))
vi.mock('../AppearanceSettings', () => ({ AppearanceSettings: () => <div>Appearance</div> }))
vi.mock('@/components/layout/LanguageSwitcher', () => ({ LanguageSwitcher: () => null }))
vi.mock('@/components/layout/ProjectSelector', () => ({ ProjectSelector: () => null }))
// The tab's own behaviour is covered in the taHotkeys tests; here it only needs
// to be identifiable so the switch can be asserted.
vi.mock('@/features/taHotkeys/components/KeyboardShortcutsSettings', () => ({
  KeyboardShortcutsSettings: () => <div>Shortcuts panel</div>,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k),
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
  }
})

import { ProfileSettingsPage } from '../ProfileSettingsPage'

describe('ProfileSettingsPage tabs', () => {
  it('opens on Account, with the profile form and appearance settings', () => {
    render(<ProfileSettingsPage />)
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByDisplayValue('operator1')).toBeInTheDocument()
    expect(screen.queryByText('Shortcuts panel')).not.toBeInTheDocument()
  })

  it('switches to Keyboard Shortcuts and back', async () => {
    const user = userEvent.setup()
    render(<ProfileSettingsPage />)

    await user.click(screen.getByRole('tab', { name: 'Keyboard Shortcuts' }))
    expect(screen.getByText('Shortcuts panel')).toBeInTheDocument()
    // The account form is gone, not merely hidden behind it.
    expect(screen.queryByDisplayValue('operator1')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Account' }))
    expect(screen.getByDisplayValue('operator1')).toBeInTheDocument()
    expect(screen.queryByText('Shortcuts panel')).not.toBeInTheDocument()
  })

  it('keeps the account column outside the tabs', () => {
    // Identity, password and 2FA are about the account itself, so they stay
    // visible whichever tab is showing.
    render(<ProfileSettingsPage />)
    expect(screen.getByText('Two-Factor')).toBeInTheDocument()
  })
})
