/**
 * Component tests for the Generate Document Modal.
 *
 * Focus areas:
 *   - template availability is driven by the backend per-debt verdict
 *     (available templates are selectable, unavailable ones are hidden with
 *     a muted filtered-count note);
 *   - the generate call sends the correct body (client/debt/type; index_num
 *     only when the operator typed one);
 *   - a 409 surfaces the server's reason to the operator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      if (typeof fallback === 'string') return fallback
      // Object form: t(key, {defaultValue, ...interpolationValues})
      if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
        const opts = fallback as Record<string, unknown>
        let out = String(opts.defaultValue)
        for (const [k, v] of Object.entries(opts)) {
          if (k !== 'defaultValue') out = out.replaceAll(`{{${k}}}`, String(v))
        }
        return out
      }
      return key
    },
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Generation API — both endpoints are spied so we can assert the request body
// and drive success / 409 responses.
const { getOptionsMock, generateMock } = vi.hoisted(() => ({
  getOptionsMock: vi.fn(),
  generateMock: vi.fn(),
}))
vi.mock('@/features/documents/api/generationApi', () => ({
  getGenerationOptions: getOptionsMock,
  generateDocument: generateMock,
}))

// Document types dropdown — same swap as the upload modal test.
vi.mock('@/features/documentTypes/api/documentTypesApi', () => ({
  documentTypesApi: {
    list: vi.fn(async () => [
      {
        id: 42,
        project_id: 1,
        name: 'Insurance',
        color: '#22C55E',
        is_hidden: false,
        doc_count: 0,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      },
    ]),
    create: vi.fn(),
    update: vi.fn(),
    updateVisibility: vi.fn(),
    remove: vi.fn(),
  },
}))

import { GenerateDocumentModal } from '../GenerateDocumentModal'
import { legalRegistryKeys } from '@/features/lawyerWorkplace/hooks/useLegalRegistry'

// jsdom lacks the pointer-capture APIs Radix Select relies on.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
})

const LOAN = { id: 555, loanNumber: 'L-001', counterparty: 'Acme LLC', status: 'active' }

function optionsWith(available: boolean, reason: string) {
  return {
    templates: [
      {
        id: 10,
        name: 'Demand letter',
        activation_rule: 'active_debt',
        document_type: null,
        debts: [{ debt_id: LOAN.id, available: true, reason: 'ok' }],
      },
      {
        id: 11,
        name: 'Closure notice',
        activation_rule: 'closed_debt',
        document_type: null,
        debts: [{ debt_id: LOAN.id, available, reason }],
      },
    ],
  }
}

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <GenerateDocumentModal open onClose={() => undefined} clientId={100} loans={[LOAN]} />
    </QueryClientProvider>
  )
  return { ...utils, queryClient, invalidateSpy }
}

/** Open the document-type Select (2nd combobox after credit) and pick a value. */
async function pickDocumentType(user: ReturnType<typeof userEvent.setup>) {
  const combos = await screen.findAllByRole('combobox')
  await user.click(combos[1])
  await user.click(await screen.findByText('Insurance'))
}

/** Open the delivery-channel Select (3rd combobox) and pick an option by label. */
async function pickDeliveryChannel(user: ReturnType<typeof userEvent.setup>, label: string) {
  const combos = await screen.findAllByRole('combobox')
  await user.click(combos[2])
  await user.click(await screen.findByRole('option', { name: label }))
}

describe('GenerateDocumentModal', () => {
  beforeEach(() => {
    getOptionsMock.mockReset()
    generateMock.mockReset()
  })

  it('shows only available templates and a hidden-count note for the rest', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(false, 'debt_not_closed'))
    renderModal()

    // Available template — selectable radio.
    const available = await screen.findByRole('radio', { name: /Demand letter/i })
    expect(available).toBeEnabled()

    // Unavailable one is HIDDEN entirely (CEO decision 23.07); a muted
    // counter reveals that one template was filtered for this credit.
    expect(screen.queryByRole('radio', { name: /Closure notice/i })).not.toBeInTheDocument()
    expect(
      screen.getByText(/Приховано шаблонів, недоступних для цього кредиту: 1/)
    ).toBeInTheDocument()
  })

  it('sends the correct body and omits index_num when left blank', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockResolvedValue({
      document_id: 1,
      document_name: 'Demand letter #7',
      index_num: 7,
      pdf_document: { id: 1 },
      docx_base64: 'AAA=',
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [templateId, payload] = generateMock.mock.calls[0]
    expect(templateId).toBe(10)
    expect(payload).toEqual({ client_id: 100, debt_id: 555, document_type_id: 42 })
    expect('index_num' in payload).toBe(false)
  })

  it('invalidates the correspondence registry after a successful generation', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockResolvedValue({
      document_id: 1,
      document_name: 'Demand letter #7',
      index_num: 7,
      pdf_document: { id: 1 },
      docx_base64: 'AAA=',
    })
    const user = userEvent.setup()
    const { invalidateSpy } = renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    // The generated letter must show up in the outgoing registry without a
    // manual refresh — the modal invalidates the whole registry family.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: legalRegistryKeys.root() })
    )
  })

  it('sends delivery_channel and delivery_contact when a channel is chosen', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockResolvedValue({
      document_id: 1,
      document_name: 'Demand letter #7',
      index_num: 7,
      pdf_document: { id: 1 },
      docx_base64: 'AAA=',
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await pickDeliveryChannel(user, 'Telegram')
    await user.type(screen.getByPlaceholderText(/380/), '@client_tg')
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [, payload] = generateMock.mock.calls[0]
    expect(payload).toMatchObject({
      delivery_channel: 'telegram',
      delivery_contact: '@client_tg',
    })
  })

  it('omits delivery fields when no channel is chosen', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockResolvedValue({
      document_id: 1,
      document_name: 'Demand letter #7',
      index_num: 7,
      pdf_document: { id: 1 },
      docx_base64: 'AAA=',
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [, payload] = generateMock.mock.calls[0]
    expect('delivery_channel' in payload).toBe(false)
    expect('delivery_contact' in payload).toBe(false)
  })

  it('includes index_num when the operator types one', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockResolvedValue({
      document_id: 1,
      document_name: 'Demand letter #99',
      index_num: 99,
      pdf_document: { id: 1 },
      docx_base64: 'AAA=',
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await user.type(screen.getByPlaceholderText('Авто'), '99')
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [, payload] = generateMock.mock.calls[0]
    expect(payload).toMatchObject({ document_type_id: 42, index_num: 99 })
  })

  it('hides the manual number field and omits index_num when registry numbering is on', async () => {
    getOptionsMock.mockResolvedValue({
      registry_numbering: true,
      templates: [
        {
          id: 10,
          name: 'Demand letter',
          activation_rule: 'active_debt',
          debts: [{ debt_id: LOAN.id, available: true, reason: 'ok' }],
        },
      ],
    })
    generateMock.mockResolvedValue({
      document_id: 1,
      // Kept free of the number so the success-screen assertion below is
      // unambiguous (document_name and index_num render in the same panel).
      document_name: 'Demand letter (registry)',
      // Registry numbering returns a string index_num like "2307/01".
      index_num: '2307/01',
      pdf_document: { id: 1 },
      docx_base64: 'AAA=',
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))

    // Manual number input is hidden; the registry hint replaces it.
    expect(screen.queryByPlaceholderText('Авто')).not.toBeInTheDocument()
    expect(
      screen.getByText('Вихідний № буде присвоєно автоматично з реєстру кореспонденції')
    ).toBeInTheDocument()

    await pickDocumentType(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [, payload] = generateMock.mock.calls[0]
    expect('index_num' in payload).toBe(false)

    // The string index_num from the registry renders on the success screen.
    expect(await screen.findByText(/2307\/01/)).toBeInTheDocument()
  })

  it('auto-applies the template-bound type and omits it from the payload', async () => {
    getOptionsMock.mockResolvedValue({
      templates: [
        {
          id: 12,
          name: 'Typed letter',
          activation_rule: 'active_debt',
          document_type: { id: 14, name: 'Гарантійний лист', color: '#2563EB' },
          debts: [{ debt_id: LOAN.id, available: true, reason: 'ok' }],
        },
      ],
    })
    generateMock.mockResolvedValue({
      document_id: 5,
      document_name: 'Typed letter #1',
      index_num: 1,
      pdf_document: { id: 5 },
      docx_base64: 'AAA=',
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Typed letter/i }))
    // Bound type shown as a pill with the auto-applied note; no type select.
    expect(await screen.findByText('Гарантійний лист')).toBeInTheDocument()
    expect(screen.getByText('застосовується автоматично з шаблону')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [, payload] = generateMock.mock.calls[0]
    expect('document_type_id' in payload).toBe(false)
  })

  it('surfaces the reason on a 409 response', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockRejectedValue({
      // Real backend shape: detail is an object {message, reason}.
      response: {
        status: 409,
        data: {
          detail: { message: 'Rule not satisfied', reason: 'no_active_promise' },
        },
      },
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    expect(await screen.findByText('Немає актуальної обіцянки платежу')).toBeInTheDocument()
  })
})
