/**
 * Catalogue of template variables that can be inserted into a Document
 * Template body. The `sample` values are used by the live preview block.
 *
 * The actual server-side rendering will resolve these against a real client
 * + credit record at generation time; the list here is just the design-time
 * directory the operator picks from.
 */

export interface TemplateVariableEntry {
  /** Token written into the body as `{{name}}`. */
  name: string
  /** i18n key for the human-readable description shown in the variables panel. */
  descriptionKey: string
  /** Fallback English description (for environments without i18n). */
  fallback: string
  /** Sample value used by the preview block. */
  sample: string
  /** Group label used to bucket variables in the UI. */
  group: 'client' | 'credit' | 'system'
}

export const TEMPLATE_VARIABLES: TemplateVariableEntry[] = [
  // --- Client ---------------------------------------------------------------
  {
    name: 'client_full_name',
    descriptionKey: 'pages.documentGeneration.templates.variables.clientFullName',
    fallback: "Client's full name",
    sample: 'John A. Smith',
    group: 'client',
  },
  {
    name: 'client_first_name',
    descriptionKey: 'pages.documentGeneration.templates.variables.clientFirstName',
    fallback: "Client's first name",
    sample: 'John',
    group: 'client',
  },
  {
    name: 'client_last_name',
    descriptionKey: 'pages.documentGeneration.templates.variables.clientLastName',
    fallback: "Client's last name",
    sample: 'Smith',
    group: 'client',
  },
  {
    name: 'client_tax_id',
    descriptionKey: 'pages.documentGeneration.templates.variables.clientTaxId',
    fallback: 'Tax ID (TIN)',
    sample: '123456789012',
    group: 'client',
  },
  {
    name: 'client_phone',
    descriptionKey: 'pages.documentGeneration.templates.variables.clientPhone',
    fallback: 'Primary phone',
    sample: '+1 555 010 1234',
    group: 'client',
  },
  {
    name: 'client_email',
    descriptionKey: 'pages.documentGeneration.templates.variables.clientEmail',
    fallback: 'Primary email',
    sample: 'john.smith@example.com',
    group: 'client',
  },
  {
    name: 'client_address',
    descriptionKey: 'pages.documentGeneration.templates.variables.clientAddress',
    fallback: 'Registered address',
    sample: '221B Baker Street, London',
    group: 'client',
  },
  // --- Credit ---------------------------------------------------------------
  {
    name: 'credit_id',
    descriptionKey: 'pages.documentGeneration.templates.variables.creditId',
    fallback: 'Credit ID / contract number',
    sample: 'CR-2024-000123',
    group: 'credit',
  },
  {
    name: 'creditor_name',
    descriptionKey: 'pages.documentGeneration.templates.variables.creditorName',
    fallback: 'Creditor name',
    sample: 'Acme Bank Ltd.',
    group: 'credit',
  },
  {
    name: 'debt_amount',
    descriptionKey: 'pages.documentGeneration.templates.variables.debtAmount',
    fallback: 'Outstanding debt amount',
    sample: '$12,540.00',
    group: 'credit',
  },
  {
    name: 'debt_currency',
    descriptionKey: 'pages.documentGeneration.templates.variables.debtCurrency',
    fallback: 'Debt currency',
    sample: 'USD',
    group: 'credit',
  },
  {
    name: 'contract_date',
    descriptionKey: 'pages.documentGeneration.templates.variables.contractDate',
    fallback: 'Contract sign date',
    sample: '2023-04-15',
    group: 'credit',
  },
  {
    name: 'due_date',
    descriptionKey: 'pages.documentGeneration.templates.variables.dueDate',
    fallback: 'Next payment due date',
    sample: '2026-05-31',
    group: 'credit',
  },
  // --- System ---------------------------------------------------------------
  {
    name: 'today',
    descriptionKey: 'pages.documentGeneration.templates.variables.today',
    fallback: "Today's date",
    sample: new Date().toISOString().slice(0, 10),
    group: 'system',
  },
  {
    name: 'operator_name',
    descriptionKey: 'pages.documentGeneration.templates.variables.operatorName',
    fallback: 'Operator full name',
    sample: 'Jane Operator',
    group: 'system',
  },
]

/** Replace every {{name}} in `body` with values from `mapping`. Unknown vars are left in place. */
export function substituteVariables(body: string, mapping: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key] : full
  )
}

/** Mapping `{ name: sample }` derived from `TEMPLATE_VARIABLES` for the preview block. */
export const SAMPLE_VARIABLE_MAP: Record<string, string> = TEMPLATE_VARIABLES.reduce(
  (acc, v) => {
    acc[v.name] = v.sample
    return acc
  },
  {} as Record<string, string>
)
