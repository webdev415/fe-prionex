import type { TFunction } from 'i18next'
import { getErrorMessage } from '@/lib/errors'
import type { MailboxProvider } from '../types'

const IMAP_STATUS_PREFIX = /^\[[A-Z0-9]+\]\s*/i
const IMAP_FAILURE_SUFFIX = /\s*\(Failure\)\s*$/i
const BYTES_LITERAL = /^b(['"])(.*)\1$/

export function normalizeImapErrorText(raw: string): string {
  let text = raw.trim()
  const bytesMatch = text.match(BYTES_LITERAL)
  if (bytesMatch) {
    text = bytesMatch[2]
  }
  text = text.replace(IMAP_STATUS_PREFIX, '').trim()
  text = text.replace(IMAP_FAILURE_SUFFIX, '').trim()
  text = text.replace(/^authentication failed:\s*/i, '').trim()
  text = text.replace(/^connection failed:\s*/i, '').trim()
  return text
}

function isAuthFailure(text: string): boolean {
  const lowered = text.toLowerCase()
  return (
    lowered.includes('invalid credentials') ||
    lowered.includes('authentication failed') ||
    (lowered.includes('auth') && lowered.includes('fail')) ||
    (lowered.includes('login') && lowered.includes('fail')) ||
    lowered.includes('missing oauth2')
  )
}

function isTimeout(text: string): boolean {
  const lowered = text.toLowerCase()
  return lowered.includes('timed out') || lowered.includes('timeout')
}

function isConnectionFailure(text: string): boolean {
  const lowered = text.toLowerCase()
  return (
    lowered.includes('connection refused') ||
    lowered.includes('connection failed') ||
    lowered.includes('network is unreachable') ||
    lowered.includes('name or service not known') ||
    lowered.includes('getaddrinfo')
  )
}

export function mapMailboxConnectionError(
  error: unknown,
  provider: MailboxProvider,
  t: TFunction
): string {
  const raw = normalizeImapErrorText(getErrorMessage(error))

  if (isAuthFailure(raw)) {
    if (provider === 'google_workspace') {
      return t(
        'pages.lawyerWorkplace.settings.mailboxes.connectionErrors.authFailedGoogle',
        'Could not sign in. Check the email address and use a Google app password — not your regular Google password.'
      )
    }
    if (provider === 'microsoft365') {
      return t(
        'pages.lawyerWorkplace.settings.mailboxes.connectionErrors.authFailedMicrosoft',
        'Could not sign in. Check the email address and app password or account permissions.'
      )
    }
    return t(
      'pages.lawyerWorkplace.settings.mailboxes.connectionErrors.authFailed',
      'Could not sign in. Check the email address and app password.'
    )
  }

  if (isTimeout(raw)) {
    return t(
      'pages.lawyerWorkplace.settings.mailboxes.connectionErrors.timeout',
      'Connection timed out. Check the server host, port, and firewall settings.'
    )
  }

  if (isConnectionFailure(raw)) {
    return t(
      'pages.lawyerWorkplace.settings.mailboxes.connectionErrors.connectionFailed',
      'Could not reach the mail server. Check the host, port, and network.'
    )
  }

  if (raw) {
    return t(
      'pages.lawyerWorkplace.settings.mailboxes.connectionErrors.generic',
      'Connection test failed: {{message}}',
      { message: raw }
    )
  }

  return t(
    'pages.lawyerWorkplace.settings.mailboxes.connectionErrors.unknown',
    'Connection test failed. Please try again.'
  )
}
