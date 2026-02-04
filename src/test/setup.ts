import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll } from 'vitest'

// Set default API base URL for tests (deployed backend) if not already set
// This ensures tests use the deployed backend URL
// Note: import.meta.env is read-only, so we use vi.stubEnv which works at test runtime
vi.stubEnv('VITE_API_BASE_URL', 'https://api.dev.crm-prionex.online')

// Suppress console warnings in tests
const originalError = console.error
const originalWarn = console.warn
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Suppress specific warnings
    const message = args[0]?.toString() || ''
    if (
      message.includes('DialogContent') ||
      message.includes('DialogTitle') ||
      message.includes('Not implemented: HTMLMediaElement')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
  console.warn = (...args: unknown[]) => {
    const message = args[0]?.toString() || ''
    if (message.includes('DialogContent') || message.includes('DialogTitle')) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Mock ResizeObserver
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

// Mock HTMLAudioElement
if (typeof globalThis.HTMLAudioElement === 'undefined') {
  class MockHTMLAudioElement {
    src = ''
    currentTime = 0
    duration = 0
    playbackRate = 1.0
    paused = true
    volume = 1.0
    muted = false
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    play = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    load = vi.fn()
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.HTMLAudioElement = MockHTMLAudioElement as any
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
        // Call-related translations
        'pages.clients.modals.callDialog.callClient': 'Call Client',
        'pages.clients.modals.callDialog.clientName': 'Client Name',
        'pages.clients.modals.callDialog.phoneNumber': 'Phone Number',
        'pages.clients.modals.callDialog.callType': 'Call Type',
        'pages.clients.modals.callDialog.whiteLine': 'White Line',
        'pages.clients.modals.callDialog.grayLine': 'Gray Line',
        'pages.clients.modals.callDialog.spamCalls': 'Spam Calls',
        'pages.clients.modals.callDialog.callNow': 'Call Now',
        'pages.clients.modals.callDialog.calling': 'Calling',
        'pages.clients.modals.callDialog.connected': 'Connected',
        'pages.clients.modals.callDialog.callEnded': 'Call Ended',
        'pages.clients.modals.callDialog.elapsedTime': 'Elapsed Time',
        'pages.clients.modals.callDialog.talkTime': 'Talk Time',
        'pages.clients.modals.callDialog.duration': 'Duration',
        'pages.clients.modals.callDialog.answered': 'Answered',
        'pages.clients.modals.callDialog.autoClosingIn': 'Auto-closing in',
        'pages.clients.modals.callDialog.seconds': 'seconds',
        'pages.clients.modals.callDialog.mute': 'Mute',
        'pages.clients.modals.callDialog.hold': 'Hold',
        'pages.clients.modals.callDialog.hangUp': 'Hang Up',
        'pages.clients.modals.callDialog.incomingCall': 'Incoming Call',
        'pages.clients.modals.callDialog.answerCall': 'Answer Call',
        'pages.clients.modals.callDialog.reject': 'Reject',
        'pages.clients.modals.callDialog.ringing': 'Ringing',
        'pages.clients.modals.callDialog.dialing': 'Dialing',
        'pages.clients.modals.callDialog.activeCall': 'Active Call',
        'pages.clients.modals.callDialog.primary': 'Primary',
        'pages.clients.modals.callDialog.primaryLoans': 'Primary Loans',
        'pages.clients.modals.callDialog.thirdPartyLoans': 'Third-Party Loans',
        'pages.clients.modals.callDialog.viewAllLoans': 'View All Loans',
        'pages.clients.modals.callDialog.loanPrincipal': 'Loan Principal',
        'pages.clients.modals.callDialog.lastContact': 'Last Contact',
        'pages.clients.modals.callDialog.viewClient': 'View Client',
        'pages.clients.modals.callDialog.callInProgress': 'Another call is already in progress',
        'pages.clients.modals.callLogCard.message': 'Message',
        'pages.clients.modals.callLogCard.template': 'Template',
        'pages.clients.modals.callLogCard.operator': 'Operator',
        'pages.clients.modals.callLogCard.type': 'Type',
        'pages.clients.modals.callLogCard.phone': 'Phone',
        'pages.clients.modals.callLogCard.line': 'Line',
        'pages.clients.modals.callLogCard.callTypes.incoming': 'Incoming',
        'pages.clients.modals.callLogCard.callTypes.outgoing': 'Outgoing',
        'pages.clients.modals.callLogCard.callTypes.incomingCall': 'Incoming Call',
        'pages.clients.modals.callRecording.title': 'Call Recording',
        'pages.clients.modals.callRecording.operator': 'Operator',
        'pages.clients.modals.callRecording.duration': 'Duration',
        'pages.clients.modals.callRecording.phone': 'Phone',
        'pages.clients.modals.callRecording.play': 'Play',
        'pages.clients.modals.callRecording.pause': 'Pause',
        'pages.clients.modals.callRecording.speed': 'Speed',
        'pages.clients.modals.callRecording.download': 'Download',
        'pages.clients.modals.callRecording.audioProgress': 'Audio Progress',
        'pages.clients.modals.callRecording.months.january': 'January',
        'pages.clients.modals.callRecording.months.february': 'February',
        'pages.clients.modals.callRecording.months.march': 'March',
        'pages.clients.modals.callRecording.months.april': 'April',
        'pages.clients.modals.callRecording.months.may': 'May',
        'pages.clients.modals.callRecording.months.june': 'June',
        'pages.clients.modals.callRecording.months.july': 'July',
        'pages.clients.modals.callRecording.months.august': 'August',
        'pages.clients.modals.callRecording.months.september': 'September',
        'pages.clients.modals.callRecording.months.october': 'October',
        'pages.clients.modals.callRecording.months.november': 'November',
        'pages.clients.modals.callRecording.months.december': 'December',
        'pages.clients.modals.sendSMS.customMessage': 'Custom Message',
        'pages.clients.statuses.answered': 'Answered',
        'pages.clients.statuses.noAnswer': 'No Answer',
        'pages.clients.statuses.delivered': 'Delivered',
        'pages.clients.statuses.failed': 'Failed',
        'pages.clients.statuses.pending': 'Pending',
        'pages.clients.detail.tableHeaders.loanNumber': 'Loan Number',
        'pages.clients.detail.tableHeaders.counterparty': 'Counterparty',
        'pages.clients.detail.tableHeaders.saleDate': 'Sale Date',
        'pages.clients.detail.tableHeaders.debt': 'Debt',
        'pages.clients.detail.tableHeaders.status': 'Status',
        'actions.cancel': 'Cancel',
        'actions.close': 'Close',
      }
      return translations[key] || key
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }): React.ReactNode => children,
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
