import type { MessagingService } from './api/types'

export type IntegrationCredentialFieldType = 'text' | 'password' | 'email'

export interface IntegrationCredentialFieldDef {
  key: string
  label: string
  type?: IntegrationCredentialFieldType
  required: boolean
  placeholder?: string
}

export const INTEGRATION_CREDENTIAL_FIELDS: Record<
  MessagingService,
  IntegrationCredentialFieldDef[]
> = {
  turbosms: [
    { key: 'api_key', label: 'API key', type: 'password', required: true },
    { key: 'sender', label: 'Sender', type: 'text', required: true },
  ],
  omnicell: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'sender', label: 'SMS sender (Alpha name)', type: 'text', required: true },
  ],
  vodafone_obm: [
    {
      key: 'username',
      label: 'OBM login (Settings → Logins)',
      type: 'text',
      required: true,
      placeholder: 'Legal-entity login string, or phone/email if cabinet allows',
    },
    { key: 'password', label: 'Cabinet password', type: 'password', required: true },
    {
      key: 'sender',
      label: 'Sender (Alpha name)',
      type: 'text',
      required: true,
      placeholder: 'Approved sender, e.g. TechnoFin',
    },
    {
      key: 'sender_id',
      label: 'Sender ID (optional)',
      type: 'text',
      required: false,
      placeholder: 'Numeric id from OBM Sender name, e.g. 5581072',
    },
  ],
  my2_viber: [
    {
      key: 'api_key',
      label: 'API token',
      type: 'password',
      required: true,
      placeholder: 'From my2.viber.net.ua → Profile → API',
    },
    {
      key: 'sender',
      label: 'Sender (Alpha name)',
      type: 'text',
      required: true,
      placeholder: 'Approved Viber sender from cabinet, e.g. default',
    },
  ],
  intel_tele: [
    {
      key: 'username',
      label: 'Cabinet login',
      type: 'text',
      required: true,
      placeholder: 'e.g. fc.technofinance@gmail.com',
    },
    {
      key: 'api_key',
      label: 'API key / SMTP password',
      type: 'password',
      required: true,
      placeholder: 'e.intel-tele.com → Automation → API and SMTP (same value for both)',
    },
    {
      key: 'from_email',
      label: 'From email',
      type: 'email',
      required: true,
      placeholder: 'Verified sender, e.g. info@techno-finance.com',
    },
    { key: 'from_name', label: 'From name', type: 'text', required: false },
    { key: 'reply_to_email', label: 'Reply-to email', type: 'email', required: false },
    { key: 'reply_to_name', label: 'Reply-to name', type: 'text', required: false },
  ],
}

export function getIntegrationCredentialFields(service: string): IntegrationCredentialFieldDef[] {
  return (
    INTEGRATION_CREDENTIAL_FIELDS[service as MessagingService] ?? [
      { key: 'api_key', label: 'API key', type: 'password', required: true },
    ]
  )
}

export function emptyCredentialForm(service: string): Record<string, string> {
  return Object.fromEntries(getIntegrationCredentialFields(service).map((field) => [field.key, '']))
}

/** Merge stored preview hints into form (secrets are redacted; leave blank to keep). */
export function credentialFormFromPreview(
  service: string,
  preview: Record<string, unknown>
): Record<string, string> {
  const form = emptyCredentialForm(service)
  for (const field of getIntegrationCredentialFields(service)) {
    const raw = preview[field.key]
    if (typeof raw === 'string' && raw && !raw.startsWith('***')) {
      form[field.key] = raw
    }
  }
  return form
}

/** Hydrate the form from a plaintext credentials payload (reveal endpoint).
 *
 * Unlike `credentialFormFromPreview`, every defined field is populated when
 * the payload contains a non-empty string for it, including secrets — this is
 * intended for in-place editing right after the user clicks the edit pencil.
 */
export function credentialFormFromPlaintext(
  service: string,
  plaintext: Record<string, unknown>
): Record<string, string> {
  const form = emptyCredentialForm(service)
  for (const field of getIntegrationCredentialFields(service)) {
    const raw = plaintext[field.key]
    if (typeof raw === 'string' && raw.length > 0) {
      form[field.key] = raw
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      form[field.key] = String(raw)
    }
  }
  return form
}

export function buildCredentialsPayload(
  service: string,
  form: Record<string, string>
): Record<string, string> {
  const payload: Record<string, string> = {}
  for (const field of getIntegrationCredentialFields(service)) {
    const value = (form[field.key] ?? '').trim()
    if (value) {
      payload[field.key] = value
    }
  }
  return payload
}

export function formCredentialsComplete(
  service: string,
  form: Record<string, string>,
  preview: Record<string, unknown>
): boolean {
  for (const field of getIntegrationCredentialFields(service)) {
    if (!field.required) continue
    const formValue = (form[field.key] ?? '').trim()
    if (formValue) continue
    const stored = preview[field.key]
    if (typeof stored === 'string' && stored.length > 0) continue
    return false
  }
  return true
}

export function formCredentialsChanged(service: string, form: Record<string, string>): boolean {
  return getIntegrationCredentialFields(service).some((field) => (form[field.key] ?? '').trim())
}
