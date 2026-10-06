/* eslint-disable no-console */
import '@testing-library/jest-dom'
import { cleanup, configure } from '@testing-library/react'
import { vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import './mocks/callQaSettings'
import './mocks/aiAssistantSettings'
import './mocks/assistantOverview'
import './mocks/assistantAdmin'

/**
 * Даём догореть отложенным задачам, пока окно ещё живо.
 *
 * `@radix-ui/react-focus-scope` при размонтировании ставит `setTimeout` на
 * возврат фокуса. Если файл тестов успевает закончиться раньше, таймер
 * срабатывает уже ПОСЛЕ сноса jsdom, `dispatchEvent` получает Event от мёртвого
 * окна и падает с TypeError. Vitest считает это unhandled error и роняет ВЕСЬ
 * прогон — при том что ни один тест не сломан: 4548 из 4548 зелёные, а код
 * возврата 1.
 *
 * За вечер 31.08 это трижды подряд отклонило коммит в разных файлах
 * (`KanbanTaskDetailPanel`, `AddTaskModal`, `AiAssistantBetaPage.composerHub`) —
 * то есть виноват не тест, а порядок сноса. Один такт реального таймера после
 * каждого теста даёт таймеру Radix сработать в живом окружении.
 *
 * Ошибки при этом НЕ глушатся: если задача упадёт по-настоящему, она упадёт
 * здесь же и будет видна как обычный отказ.
 *
 * `isFakeTimers()` обязателен: под подменёнными таймерами `setTimeout` не
 * пойдёт сам, и ожидание повисло бы навсегда.
 */
afterEach(async () => {
  // `cleanup()` пришёл из main: размонтирует дерево ДО такта, чтобы отложенная
  // задача Radix успела сработать на живом окне, а не догорала уже после того,
  // как vitest начал сносить окружение.
  cleanup()
  // Под подменёнными таймерами `setTimeout` сам не пойдёт, и ожидание повисло
  // бы навсегда. В main этой защиты нет; здесь она обязательна, потому что
  // часть файлов подменяет таймеры целиком.
  if (vi.isFakeTimers()) return
  await new Promise((resolve) => setTimeout(resolve, 0))
})

/**
 * `scrollIntoView` в jsdom не реализован вовсе.
 *
 * Нужен `@radix-ui/react-select`: при открытии он прокручивает список к
 * выбранному пункту. Без заглушки эффект падает `TypeError: candidate?.
 * scrollIntoView is not a function` — и падает НЕ в тесте, а в отложенном
 * эффекте, поэтому виден как unhandled error, роняющий весь прогон при
 * зелёных тестах.
 *
 * До такта выше дефект прятался: файл успевал закончиться раньше, чем эффект
 * доходил до прокрутки. То есть это не новая поломка, а старая, которую
 * теперь видно.
 */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

/**
 * Pointer capture, for the same reason and the same component.
 *
 * jsdom implements no part of the Pointer Capture API, and Radix's Select
 * trigger calls `hasPointerCapture` on pointer-down. Without these a test that
 * merely opens a dropdown dies with `target.hasPointerCapture is not a
 * function` — thrown from Radix's own handler, so it surfaces as an unhandled
 * error that fails the whole file rather than the assertion that was running.
 */
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false
  }
  Element.prototype.setPointerCapture = function setPointerCapture() {}
  Element.prototype.releasePointerCapture = function releasePointerCapture() {}
}

// Testing Library's own async budget, which `testTimeout` does NOT cover:
// every `findBy*` and bare `waitFor` gives up after 1s regardless of the 20s
// per-test limit in vitest.config.ts. That second is the tightest deadline in
// the suite and the one that breaks first on CI — `AiAssistantBetaPage.sidebar`
// runs in ~840ms locally, so its mobile case (resize, render, open the drawer,
// select, wait for the drawer to unmount, then wait for the conversation to
// load through react-query) has nothing left to spare once the runner is under
// load. With `pool: 'forks'`, `maxWorkers: 1` and `fileParallelism: false`
// every file shares one core, so "slower than local" is the normal case.
//
// 5s keeps a hang visible well inside the 20s test timeout while removing the
// flake. Raise the per-query timeout locally instead of this global if a single
// test genuinely needs longer — that keeps the slow one honest about being slow.
configure({ asyncUtilTimeout: 5000 })

// Set default API base URL for tests (deployed backend) if not already set
// This ensures tests use the deployed backend URL
// Note: import.meta.env is read-only, so we use vi.stubEnv which works at test runtime
vi.stubEnv('VITE_API_BASE_URL', 'https://api.dev.crm-prionex.online')

// ── No real network from a unit test ─────────────────────────────────────────
// The base URL above is a REAL, reachable host, so any request a test forgets
// to mock actually leaves the machine — and the dev API answers 401. That 401
// hits the interceptor in lib/api.ts, which calls triggerAuthExpired() and
// wipes the auth store (user: null, isAuthenticated: false) out from under a
// test that never logged anybody out. The visible tell is jsdom's "Not
// implemented: navigation to another Document", from the `location.href =
// '/login'` on the same path.
//
// It lands as a race, not a hard failure: whether the reply arrives before or
// after the test's own assertions depends purely on how loaded the runner is.
// AiAssistantBetaPage.sidebar's mobile case is where it showed up — with auth
// cleared, handleSelectConversation closes the drawer, hits `if (userId ==
// null) return`, and the conversation is silently never selected. Green
// locally, red on CI, and a different subset of tests each run.
//
// So cut the transport. Axios goes through XMLHttpRequest under jsdom; both it
// and fetch now fail the way an offline machine would — a network error with
// NO response, which is exactly what keeps `error.response?.status === 401`
// false and leaves the auth store alone. Tests that mock their API module are
// untouched; a test that wants a response still has to say what it is.
const failOffline = () => new Error('Network request blocked in tests')
class BlockedXHR {
  status = 0
  readyState = 0
  responseText = ''
  onerror: ((this: unknown, ev: unknown) => unknown) | null = null
  open() {}
  setRequestHeader() {}
  abort() {}
  getAllResponseHeaders() {
    return ''
  }
  addEventListener(type: string, cb: (ev: unknown) => void) {
    if (type === 'error') this.onerror = cb
  }
  removeEventListener() {}
  send() {
    setTimeout(() => this.onerror?.call(this, new Event('error')), 0)
  }
}
// Installed by ASSIGNMENT, not vi.stubGlobal, and re-applied before every test.
// Ten files (most of them AiAssistant ones) call vi.unstubAllGlobals() in their
// teardown, which restores whatever vitest recorded when the stub was created —
// the REAL XMLHttpRequest, if the block were a stub. That switched the block off
// for the rest of those files, which is precisely where it is needed. A plain
// assignment is not vitest's to revert, and the beforeEach covers a file that
// reaches for the global itself.
//
// The hook runs before any hook the test file registers, so a file that wants
// its own fetch (SSE, TTS, transcribe sockets) still overrides this and wins.
const blockedFetch = () => Promise.reject(failOffline())
const installNetworkBlock = () => {
  globalThis.XMLHttpRequest = BlockedXHR as unknown as typeof XMLHttpRequest
  globalThis.fetch = blockedFetch as unknown as typeof fetch
}
installNetworkBlock()
beforeEach(installNetworkBlock)

// jsdom's URL persists across tests within a file. Pages that mirror state into
// the address bar (AiAssistant deep-link ?conversation=, tabs with
// useSearchParams) would otherwise leak query params from one test into the
// mount of the next — e.g. a hydrated dialog id resurfacing as a deep-link in a
// test that expects a pristine page. Reset to a bare path before every test; a
// test that needs its own URL sets it after this hook runs.
beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
})

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

// Unmount, then let the timers that unmounting schedules actually run — while the
// jsdom realm that owns them is still alive.
//
// The failure this prevents is a whole-suite flake that never reproduces on a
// single file. Radix's FocusScope restores focus in a `setTimeout(..., 0)`
// registered by its cleanup function (`@radix-ui/react-focus-scope`, the returned
// teardown): it constructs a `CustomEvent` and dispatches it on the container.
// Nothing awaits that timer. When a test file ends with a Radix overlay still
// mounted — any Dialog, Popover, Select or Dropdown — the timer is still pending
// as the file finishes.
//
// `pool: 'forks'` + `maxWorkers: 1` + `fileParallelism: false` means files run
// sequentially in ONE process, each with a FRESH jsdom environment. So the pending
// timer fires during the *next* file, by which time `globalThis.CustomEvent` belongs
// to the new realm while `container` still belongs to the old one. jsdom rejects the
// cross-realm object with:
//
//   TypeError: Failed to execute 'dispatchEvent' on 'EventTarget':
//              parameter 1 is not of type 'Event'.
//
// Every test still passes — it is an *unhandled error*, not an assertion failure —
// but Vitest reports it and exits non-zero, so a fully green suite fails the run.
// Measured on 2026-08-13: 2 failures in 6 full-suite runs, and it rejected a commit
// of its own fix's story. Story 2.5 needs five consecutive green runs and Story 2.6
// puts required status checks on top of that, so at a ~33% rate merges would have
// blocked at random with nothing wrong in the code.
//
// `cleanup()` is called explicitly rather than relying on RTL's auto-cleanup so this
// hook does not depend on hook ordering: whichever runs first, by the time the
// `await` below resolves the tree is unmounted and its timers have run in the realm
// that created them. Calling `cleanup()` twice is a no-op.
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
    // Third arg carries the interpolation values for the `t(key, fallback, vars)`
    // call form; `options` holds them for the two-arg `t(key, vars)` form.
    t: (
      key: string,
      options?: Record<string, unknown>,
      interpolation?: Record<string, unknown>
    ) => {
      const vars = interpolation ?? options
      if (key === 'common.selectItem') {
        return `Select item ${String(vars?.id)}`
      }
      if (key === 'pages.imports.operatorAssignment.preview.fileInfo' && options) {
        return `File: ${String(options.filename)} · ${String(options.totalRecords)} records · Batch: ${String(options.batchId)}`
      }
      if (key === 'pages.imports.operatorAssignment.preview.previewRows' && options) {
        return `Preview (first ${String(options.count)} rows)`
      }
      if (key === 'pages.imports.operatorAssignment.preview.errors' && options) {
        return `Errors (${String(options.count)})`
      }
      if (key === 'pages.imports.operatorAssignment.preview.confirm' && options) {
        return `Confirm & Assign ${String(options.count)} Clients`
      }
      // A count-based plural key (locales hold floorHint_one/_few/_many/_other).
      // The month count is the whole point of this hint — it now comes from the
      // feed's response, so a test has to be able to see the VALUE and not just
      // the key. Rendered as `<key>:<count>`, deterministic and still key-based.
      if (key === 'pages.reports.lowVerification.floorHint') {
        return `${key}:${String(vars?.count)}`
      }
      // Same shape, same reason: the operator-promises totals block states WHEN
      // the numbers were computed (the report is re-served from a 15-minute
      // server-side cache), so the stamp itself has to be assertable and not
      // just the key it rides on.
      if (key === 'pages.reports.operatorPromises.totals.generatedAt') {
        return `${key}:${String(vars?.value)}`
      }
      // Same shape, same reason: the contact-tag feed's hint states the sale-date
      // upper bound the BACKEND applied when the tab sent none — the whole point
      // of the line is the date, so it has to be assertable and not just the key.
      if (key === 'pages.reports.contactTag.sellToDefaultHint') {
        return `${key}:${String(vars?.date)}`
      }
      // Same shape, same reason: the dialogs-list loan cell collapses extra
      // active loans into a "+N more" badge — the N is the whole point of the
      // badge, so it has to be assertable and not just the key it rides on.
      if (key === 'pages.training.dialogue.list.moreLoans') {
        return `${key}:${String(vars?.count)}`
      }
      // Same shape, same reason: the OneX dock's context chip exists to tell
      // the operator WHICH page will be sent along, so the label has to be
      // assertable and not just the key it rides on.
      if (key === 'pages.aiAssistant.onexContextChip') {
        return `${key}:${String(vars?.label)}`
      }
      if (key === 'pages.aiAssistant.onexContextClientFallback') {
        return `${key}:${String(vars?.id)}`
      }
      // Same shape, same reason: the workday tabs' lines carry NUMBERS that
      // come from the answer — the red threshold from `meta` (never a
      // constant), the seconds of a 503's retry hint, the stale-day count —
      // and the number is the whole point of each line.
      if (key === 'pages.reports.workday.legend' || key === 'pages.reports.workmonth.legend') {
        return `${key}:${String(vars?.red)}`
      }
      if (key === 'pages.reports.workday.retryAfter') {
        return `${key}:${String(vars?.seconds)}`
      }
      if (key === 'pages.reports.workmonth.notReady.body') {
        return `${key}:${String(vars?.days)}`
      }
      // Map translation keys to readable text for testing
      const translations: Record<string, string> = {
        'login.title': 'Sign In',
        'login.subtitle': 'Enter your credentials to access your account',
        'login.username': 'Username or Email',
        'login.usernamePlaceholder': 'Enter your username or email',
        'login.password': 'Password',
        'login.passwordPlaceholder': 'Enter your password',
        'login.submit': 'Sign In',
        'validation.usernameRequired': 'Username or email is required',
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
        'common.selectAll': 'Select all',
        'common.selectionOptions': 'Selection options',
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
        'pages.clients.modals.callDialog.multipleClientsTitle': 'Several clients found',
        'pages.clients.modals.callDialog.multipleClientsHint':
          'Choose who is calling — the interaction will be filed against this client.',
        'pages.clients.modals.callDialog.clientNotFound': 'Client not found',
        'pages.clients.modals.callDialog.clientNotFoundHint':
          'This number is not linked to any client in your projects.',
        'pages.clients.modals.callDialog.searchByNumber': 'Search by this number',
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
        // Carries an interpolation, so it needs a template here for the
        // formatted value to be observable in assertions.
        'pages.clients.detail.closedInline': 'Closed: {{date}}',
        'pages.clients.detail.tableHeaders.status': 'Status',
        'actions.cancel': 'Cancel',
        'actions.close': 'Close',
        'actions.delete': 'Delete',
        'pages.users.filterTemplates.label': 'Save as template',
        'pages.users.filters.clearFilters': 'Clear filters',
        'pages.users.filterTemplates.saveCurrent': 'Save current filters',
        'pages.users.filterTemplates.nameLabel': 'Template name',
        'pages.users.filterTemplates.saved': 'Filter template saved',
        'pages.users.filterTemplates.deleted': 'Filter template deleted',
        'pages.users.filterTemplates.empty': 'No saved templates yet',
        'pages.users.filterTemplates.loading': 'Loading templates...',
        'pages.users.filterTemplates.loadFailed': 'Could not load templates - tap to retry',
        'pages.users.filterTemplates.confirmDeleteTitle': 'Delete this template?',
        'pages.users.filterTemplates.confirmDeleteMessage':
          '"{{name}}" is removed from your saved filters. The filters themselves are not changed.',
        // Two-Factor Authentication
        'twoFactor.title': 'Two-Factor Authentication',
        'twoFactor.subtitle': 'Enter the 6-digit code from your authenticator app',
        'twoFactor.subtitleBackup': 'Enter one of your backup recovery codes',
        'twoFactor.signedInAs': `Signed in as ${options?.username ?? '{{username}}'}`,
        'twoFactor.codeLabel': 'Authentication code',
        'twoFactor.codePlaceholder': '123456',
        'twoFactor.backupCodeLabel': 'Backup code',
        'twoFactor.backupCodePlaceholder': 'xxxxxxxx-xxxxxxxx',
        'twoFactor.submit': 'Verify',
        'twoFactor.useBackupCode': 'Use a backup code instead',
        'twoFactor.useAuthenticatorApp': 'Use authenticator code instead',
        'twoFactor.backToLogin': 'Cancel and back to login',
        'twoFactor.errors.codeFormat': 'Enter the 6-digit code from your authenticator app',
        'twoFactor.errors.backupTooShort': 'Backup code looks too short',
        'twoFactor.errors.verifyFailed': 'Verification failed',
        'twoFactor.section.title': 'Two-Factor Authentication',
        'twoFactor.section.description': 'Protect your account with Google Authenticator',
        'twoFactor.section.statusEnabled': 'Enabled',
        'twoFactor.section.statusDisabled': 'Disabled',
        'twoFactor.section.loading': 'Loading status…',
        'twoFactor.section.enable': 'Enable Google Authenticator',
        'twoFactor.section.disable': 'Disable',
        'twoFactor.section.regenerate': 'New backup codes',
        'twoFactor.section.backupRemaining': `${options?.count ?? 0} backup codes remaining`,
        'twoFactor.section.lowBackupWarning': '— consider regenerating.',
        // Setup modal
        'twoFactor.setup.title': 'Enable Two-Factor Authentication',
        'twoFactor.setup.backupTitle': 'Save your backup codes',
        'twoFactor.setup.qrInstructions': 'Scan this QR code with Google Authenticator.',
        'twoFactor.setup.qrAlt': 'Two-factor authentication QR code',
        'twoFactor.setup.manualEntry': 'Manual entry secret:',
        'twoFactor.setup.copySecret': 'Copy',
        'twoFactor.setup.verifyInstructions':
          'Enter the 6-digit code your authenticator app shows now.',
        'twoFactor.setup.verifyAndEnable': 'Verify and enable',
        'twoFactor.setup.next': 'Next',
        'twoFactor.setup.back': 'Back',
        'twoFactor.setup.cancel': 'Cancel',
        'twoFactor.setup.done': 'Done',
        'twoFactor.setup.backupIntro': 'Save these backup codes somewhere safe.',
        'twoFactor.setup.acknowledge': 'I have saved my backup codes in a safe place.',
        'twoFactor.setup.errors.cannotStart': 'Could not start setup.',
        'twoFactor.setup.errors.mustSaveCodes': 'Confirm that you have saved the backup codes.',
        // Disable modal
        'twoFactor.disable.title': 'Disable Two-Factor Authentication',
        'twoFactor.disable.warning': 'Disabling 2FA makes your account easier to compromise.',
        'twoFactor.disable.passwordLabel': 'Current password',
        'twoFactor.disable.codeLabel': 'Authenticator code or backup code',
        'twoFactor.disable.codePlaceholder': '123456 or xxxx-xxxx',
        'twoFactor.disable.cancel': 'Cancel',
        'twoFactor.disable.confirm': 'Disable 2FA',
        'twoFactor.disable.success': 'Two-factor authentication disabled',
        'twoFactor.disable.errors.passwordRequired': 'Password is required',
        'twoFactor.disable.errors.codeRequired': 'Authentication code is required',
        'twoFactor.disable.errors.failed': 'Failed to disable 2FA',
        'twoFactor.disable.errors.backupAlreadyUsedHint':
          'If you’ve already used this backup code, it cannot be used again — try a different one from your saved list.',
        // Regenerate modal
        'twoFactor.regenerate.title': 'Regenerate backup codes',
        'twoFactor.regenerate.intro': 'Generate a fresh batch of backup codes.',
        'twoFactor.regenerate.successIntro': 'Your new backup codes are ready.',
        'twoFactor.regenerate.invalidatesOld': 'Save these now.',
        'twoFactor.regenerate.confirm': 'Regenerate',
        'twoFactor.regenerate.success': 'New backup codes generated',
        'twoFactor.regenerate.errors.failed': 'Failed to regenerate backup codes',
        // Backup codes panel
        'twoFactor.backupCodes.warning': 'These codes are shown only once.',
        'twoFactor.backupCodes.copyAll': 'Copy all',
        'twoFactor.backupCodes.copied': 'Copied',
        'twoFactor.backupCodes.copyFailed': 'Could not copy to clipboard',
        'twoFactor.backupCodes.download': 'Download .txt',
        // Profile settings: photo + work format.
        'pages.profile.agentStatus.online': 'Online',
        'pages.profile.agentStatus.offline': 'Offline',
        'pages.profile.agentStatus.busy': 'Busy',
        'pages.profile.agentStatus.onCall': 'On Call',
        'pages.profileSettings.photo.upload': 'Upload photo',
        'pages.profileSettings.photo.replace': 'Replace photo',
        'pages.profileSettings.photo.confirmRemoveTitle': 'Remove your photo?',
        'pages.profileSettings.photo.confirmRemoveMessage':
          'Your initials will be shown instead. You can upload a new photo at any time.',
        'pages.profileSettings.photo.remove': 'Remove photo',
        'pages.profileSettings.photo.wrongType': 'Choose a JPEG, PNG or WebP image',
        'pages.profileSettings.photo.tooLarge': 'The photo must be 2 MB or smaller',
        'pages.profileSettings.photo.uploaded': 'Photo updated',
        'pages.profileSettings.photo.removed': 'Photo removed',
        'pages.profileSettings.workFormat.label': 'Work format',
        'pages.profileSettings.workFormat.office': 'Office',
        'pages.profileSettings.workFormat.remote': 'Remote',
        // Shared soft-delete section labels.
        'softDelete.columns.deletedAt': 'Deleted',
        'softDelete.columns.expires': 'Expires',
        'softDelete.columns.actions': 'Actions',
        'softDelete.actions.restore': 'Restore',
        'softDelete.expiry.noDeadline': 'No deadline',
        'softDelete.expiry.today': 'Removed today',
        'softDelete.sectionHint':
          'These were deleted and can still be restored until the date shown.',
        'pages.smsTemplates.deleted.title': 'Deleted templates',
        'pages.messagingDrafts.deleted.title': 'Deleted drafts',
        // Soft delete is a recovery promise, so these two say Trash, not
        // "permanently removed" — the copy they replaced was untrue.
        'pages.smsTemplates.modals.delete.recoverableTitle':
          'The template will be removed from the active list',
        'pages.smsTemplates.modals.delete.recoverableDescription':
          'It moves to the deleted list at the bottom of this page, where a supervisor can restore it.',
        'pages.messagingDrafts.delete.confirmMessage':
          'Are you sure you want to delete the draft "{{name}}"?',
        'pages.messagingDrafts.delete.recoverableTitle':
          'The draft will be removed from the active list',
        'pages.messagingDrafts.delete.recoverableDescription':
          'It moves to the deleted list at the bottom of this page, where a supervisor can restore it.',
        'pages.clients.modals.deleteClient.title': 'Delete Client',
        'pages.clients.modals.deleteClient.softDeleteWarning':
          'This action will remove the client from active records (soft delete). Data can be recovered by administrators if needed.',
        'pages.clients.modals.deleteClient.clientDetails': 'Client Details',
        'pages.clients.modals.deleteClient.fieldName': 'Name:',
        'pages.clients.modals.deleteClient.fieldTaxId': 'Tax ID:',
        'pages.clients.modals.deleteClient.fieldPhone': 'Phone:',
        'pages.clients.modals.deleteClient.fieldTotalDebt': 'Total Debt:',
        'pages.clients.modals.deleteClient.impactTitle': 'What Will Happen:',
        'pages.clients.modals.deleteClient.impact1':
          'Client will be marked as deleted (soft delete)',
        'pages.clients.modals.deleteClient.impact2': 'Client will disappear from client lists',
        'pages.clients.modals.deleteClient.impact3':
          'Historical data (notes, calls, payments) will be preserved',
        'pages.clients.modals.deleteClient.impact4':
          'This action cannot be undone without admin intervention',
        'pages.clients.modals.deleteClient.debtsSummary':
          'Associated debts: {{count}} debt(s) totaling {{amount}}',
        'pages.clients.modals.deleteClient.confirmCheckbox':
          'I understand this action will remove the client from active records',
        'pages.clients.modals.deleteClient.submitDelete': 'Delete Client',
        'pages.clients.modals.deleteClient.deleting': 'Deleting...',
        'pages.clients.modals.deleteClient.deletedSuccess': 'Client deleted successfully',
        'pages.clients.modals.deleteClient.deleteFailed': 'Failed to delete client',
        'pages.clients.detail.tagsDropdown.searchTags': 'Search tags...',
        'pages.clients.detail.tagsDropdown.noTagsFound': 'No tags found',
        'pages.clients.detail.tagsDropdown.clear': 'Clear',
        'pages.clients.detail.tagsDropdown.apply': 'Apply',
        'pages.clients.modals.tagsDropdown.searchTags': 'Search tags...',
        'pages.clients.modals.tagsDropdown.noTagsFound': 'No tags found',
        'pages.clients.modals.tagsDropdown.clear': 'Clear',
        'pages.clients.modals.tagsDropdown.apply': 'Apply',
        'pages.clients.filters.min': 'Min',
        'pages.clients.filters.max': 'Max',
        'components.pagination.rowsPerPage': 'Rows per page:',
        'components.pagination.previousPage': 'Previous page',
        'components.pagination.nextPage': 'Next page',
        'components.pagination.goToPage': 'Go to page {{page}}',
        'components.pagination.page': 'Page',
        'components.pagination.of': 'of',
        // AI assistant markdown surface (code blocks + foldable tables)
        'pages.aiAssistant.codeCopy': 'Copy',
        'pages.aiAssistant.codeCopied': 'Copied',
        'pages.aiAssistant.showAllRows': 'Show all ({{count}})',
        'pages.aiAssistant.collapseRows': 'Collapse',
        // Assistant-generated files (charts, exports) rendered in the bubble
        'pages.aiAssistant.filePreview.loading': 'Loading…',
        'pages.aiAssistant.filePreview.loadFailed': 'Could not load the file',
        'pages.aiAssistant.filePreview.imageFailed': 'Could not load the image “{{name}}”',
        'pages.aiAssistant.filePreview.openFull': 'Open “{{name}}” full size',
        'pages.aiAssistant.filePreview.close': 'Close',
        'pages.aiAssistant.filePreview.download': 'Download',
        'pages.aiAssistant.filePreview.downloadFailed': 'Download failed — try again',
        'pages.aiAssistant.filePreview.downloaded': 'Sent to browser ✓',
        'pages.aiAssistant.filePreview.downloadedHint':
          'If the file is missing, check your browser downloads (Ctrl+J) or the Downloads folder',
        'pages.aiAssistant.filePreview.alreadyDownloaded':
          'The file was already sent to the browser. If it is missing, check your browser downloads (Ctrl+J) or the Downloads folder',
        'pages.aiAssistant.filePreview.downloadAgain': 'Download again',
        'pages.aiAssistant.filePreview.openPreview': 'Open preview',
        'pages.aiAssistant.filePreview.externalLink': 'external link',
        'pages.aiAssistant.filePreview.blocked': 'Attachment not shown',
        'pages.aiAssistant.filePreview.linkLost':
          'The link to this file was lost — ask the assistant to send it again',
        'pages.aiAssistant.filePreview.errorNotFound': 'The file is no longer available',
        'pages.aiAssistant.filePreview.errorTooLarge':
          'The file is too large to open here — ask for a smaller export',
        'pages.aiAssistant.filePreview.errorBrainUnavailable':
          'The assistant is unavailable — try again in a moment',
        // День расчёта кредитной строки приезжает ПЕРЕМЕННОЙ. Без шаблона здесь
        // мок возвращает сам ключ, подставленная дата в DOM не попадает вовсе,
        // и сцена «класс А целиком» не может утверждать «станом на» ни одним
        // числом — проверяла бы наличие ключа.
        'credit.card.asOf': 'As of {{date}}',
      }
      const template = translations[key] || key
      // Interpolate from `vars`, not `options`: in the `t(key, fallback, vars)`
      // form `options` is the fallback string, and indexing into it throws.
      if (vars && typeof vars === 'object' && template.includes('{{')) {
        return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
          name in (vars as Record<string, unknown>)
            ? String((vars as Record<string, unknown>)[name])
            : `{{${name}}}`
        )
      }
      return template
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
    // `src/lib/i18n.ts` subscribes to languageChanged at module scope to keep
    // `<html lang>` in step with the active language.
    on: vi.fn(),
    language: 'en',
    // Hooks that toast outside a component call i18n.t directly. Without this
    // the call throws inside onSuccess, React Query turns the mutation into a
    // failure, and any test asserting only on cache state passes while the
    // success path it claims to cover never runs.
    t: (key: string, options?: Record<string, unknown>) => (options?.defaultValue as string) ?? key,
  },
}))

// Mock i18next plugins
vi.mock('i18next-browser-languagedetector', () => ({
  default: {},
}))

vi.mock('i18next-http-backend', () => ({
  default: {},
}))
