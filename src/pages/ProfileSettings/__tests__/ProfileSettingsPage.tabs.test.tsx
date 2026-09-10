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
vi.mock('@/features/auth/hooks/useMyPersonalInformation', () => ({
  useMyPersonalInformation: () => ({ data: undefined }),
  useUpdateMyPersonalInformation: () => ({ mutateAsync: vi.fn() }),
}))
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

  it('wires each tab to the panel it controls', () => {
    // `role="tab"` on its own promises a widget that was not there: the panel
    // has to be reachable from the tab, or a screen reader announces "tab 1 of
    // 2" with nothing to move to.
    render(<ProfileSettingsPage />)

    const [account, shortcuts] = screen.getAllByRole('tab')
    const panel = screen.getByRole('tabpanel')

    expect(account).toHaveAttribute('aria-controls', panel.id)
    expect(panel).toHaveAttribute('aria-labelledby', account.id)
    // Only the selected panel is mounted, so the other tab must not advertise
    // one: an aria-controls pointing at nothing is worse than none at all.
    expect(shortcuts).not.toHaveAttribute('aria-controls')
    for (const tab of screen.getAllByRole('tab')) {
      const target = tab.getAttribute('aria-controls')
      if (target) expect(document.getElementById(target)).not.toBeNull()
    }
    // Only the selected tab holds a tab stop; the arrows reach the other one.
    expect(account).toHaveAttribute('tabindex', '0')
    expect(shortcuts).toHaveAttribute('tabindex', '-1')
  })

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<ProfileSettingsPage />)

    const [account] = screen.getAllByRole('tab')
    account.focus()
    await user.keyboard('{ArrowRight}')

    const [, shortcuts] = screen.getAllByRole('tab')
    expect(shortcuts).toHaveAttribute('aria-selected', 'true')
    // Focus follows the selection, or the next arrow press starts over from
    // the tab the operator has already left.
    expect(shortcuts).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', shortcuts.id)

    // On to the third tab, then wrapping round to the first, so the widget
    // has no dead end however many tabs it grows.
    await user.keyboard('{ArrowRight}')
    const [, , presets] = screen.getAllByRole('tab')
    expect(presets).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowRight}')
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true')

    // And backwards from the first, which must land on the last rather
    // than stopping.
    await user.keyboard('{ArrowLeft}')
    expect(screen.getAllByRole('tab')[2]).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the account column outside the tabs', () => {
    // Identity, password and 2FA are about the account itself, so they stay
    // visible whichever tab is showing.
    render(<ProfileSettingsPage />)
    expect(screen.getByText('Two-Factor')).toBeInTheDocument()
  })
})
