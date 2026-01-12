import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock ResizeObserver
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      // Map translation keys to readable text for testing
      const translations: Record<string, string> = {
        'login.title': 'Sign In',
        'login.subtitle': 'Enter your credentials to access your account',
        'login.username': 'Username',
        'login.usernamePlaceholder': 'Enter your username',
        'login.password': 'Password',
        'login.passwordPlaceholder': 'Enter your password',
        'login.submit': 'Sign In',
        'validation.usernameRequired': 'Username is required',
        'validation.usernameMinLength': 'Username must be at least 3 characters',
        'validation.passwordRequired': 'Password is required',
        'validation.passwordMinLength': 'Password must be at least 8 characters',
        'accountLocked.title': 'Account Locked',
        'accountLocked.message': 'Your account is locked due to too many failed attempts.',
        'accountLocked.autoUnlock': `It will be unlocked automatically in ${options?.minutes || '{{minutes}}'} minutes.`,
        'accountLocked.contact': 'Contact your Admin if you need immediate access.',
        'accountLocked.backToLogin': 'Back to Login',
        'alreadyLoggedIn.title': 'Already Logged In',
        'alreadyLoggedIn.message': 'You are already logged in on another device.',
        'alreadyLoggedIn.forceLogout': 'Force Logout Other Session',
        'alreadyLoggedIn.cancel': 'Back to Login',
        'pages.clients.listOfClients': 'List of Clients',
        'pages.clients.clearAll': 'Clear All',
        'pages.clients.filtersLabel': 'Filters',
        'pages.clients.applied': 'applied',
        'pages.clients.filters.tags': 'Tags',
        'pages.clients.filters.more': 'more',
        'pages.clients.priorities.critical': 'Critical',
        'pages.clients.priorities.high': 'High',
        'pages.clients.priorities.medium': 'Medium',
        'pages.clients.priorities.low': 'Low',
        'pages.clients.priorityCards.criticalPriority': 'Critical Priority',
        'pages.clients.priorityCards.totalDebt': 'Total Debt',
      }
      return translations[key] || key
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}))

// Mock i18next core
vi.mock('i18next', () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn(),
  },
}))

// Mock i18next plugins
vi.mock('i18next-browser-languagedetector', () => ({
  default: {},
}))

vi.mock('i18next-http-backend', () => ({
  default: {},
}))
