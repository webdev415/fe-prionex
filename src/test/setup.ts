/* eslint-disable no-console */
import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll } from 'vitest'
import './mocks/callQaSettings'
import './mocks/aiAssistantSettings'
import './mocks/assistantOverview'
import './mocks/assistantAdmin'

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
        'pages.profileSettings.photo.upload': 'Upload photo',
        'pages.profileSettings.photo.replace': 'Replace photo',
        'pages.profileSettings.photo.remove': 'Remove photo',
        'pages.profileSettings.photo.wrongType': 'Choose a JPEG, PNG or WebP image',
        'pages.profileSettings.photo.tooLarge': 'The photo must be 2 MB or smaller',
        'pages.profileSettings.photo.uploaded': 'Photo updated',
        'pages.profileSettings.photo.removed': 'Photo removed',
        'pages.profileSettings.workFormat.label': 'Work format',
        'pages.profileSettings.workFormat.unset': 'Not specified',
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
