/**
 * Component tests for the Generate Document Modal.
 *
 * Focus areas:
 *   - template availability is driven by the backend per-debt verdict
 *     (available templates are selectable, unavailable ones are disabled and
 *     show a human-readable reason);
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
        debts: [{ debt_id: LOAN.id, available: true, reason: 'ok' }],
      },
      {
        id: 11,
        name: 'Closure notice',
        activation_rule: 'closed_debt',
        debts: [{ debt_id: LOAN.id, available, reason }],
      },
    ],
  }
}

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <GenerateDocumentModal open onClose={() => undefined} clientId={100} loans={[LOAN]} />
    </QueryClientProvider>
  )
}

/** Open the document-type Select (2nd combobox after credit) and pick a value. */
async function pickDocumentType(user: ReturnType<typeof userEvent.setup>) {
  const combos = await screen.findAllByRole('combobox')
  await user.click(combos[1])
  await user.click(await screen.findByText('Insurance'))
}

describe('GenerateDocumentModal', () => {
  beforeEach(() => {
    getOptionsMock.mockReset()
    generateMock.mockReset()
  })

  it('shows available templates as selectable and unavailable ones disabled with a reason', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(false, 'debt_not_closed'))
    renderModal()

    // Available template — enabled radio.
    const available = await screen.findByRole('radio', { name: /Demand letter/i })
    expect(available).toBeEnabled()

    // Unavailable one — disabled + human-readable reason.
    const unavailable = screen.getByRole('radio', { name: /Closure notice/i })
    expect(unavailable).toBeDisabled()
    expect(screen.getByText('Кредит не закритий')).toBeInTheDocument()
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
