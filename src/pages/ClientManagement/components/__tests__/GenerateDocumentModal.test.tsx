/**
 * Component tests for the Generate Document Modal.
 *
 * Focus areas:
 *   - template availability is driven by the backend per-debt verdict
 *     (available templates are selectable, unavailable ones are hidden with
 *     a muted filtered-count note);
 *   - the generate call sends the correct body (client/debt/type; index_num
 *     only when the operator typed one);
 *   - delivery channel + contact are mandatory: generation is blocked until
 *     both are provided, and the payload always carries them;
 *   - a 409 surfaces the server's reason to the operator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

// Client profile powers the contact picker in the delivery-contact field.
// Only `useClientProfile` is swapped; the rest of the hooks module (clientKeys,
// …) is kept real. Default: no profile → the field is a plain free-text input
// (unchanged behaviour). Individual tests override it to expose suggestions.
const { useClientProfileMock } = vi.hoisted(() => ({
  useClientProfileMock: vi.fn(() => ({ data: undefined as unknown })),
}))
vi.mock('@/features/clients/hooks/useClients', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/clients/hooks/useClients')>()
  return { ...actual, useClientProfile: useClientProfileMock }
})

import { GenerateDocumentModal } from '../GenerateDocumentModal'
import { legalRegistryKeys } from '@/features/lawyerWorkplace/hooks/useLegalRegistry'

/** Client profile exposing a primary phone, an extra phone, an email and an address. */
const PROFILE_WITH_CONTACTS = {
  phone_primary: '+380501112233',
  email: 'client@example.com',
  additional_phones: [{ number: '+380671234567', type: 'Мобільний', label: null }],
  addresses: [{ full_address: 'м. Київ, вул. Хрещатик, 1', address_type: 'Реєстрація' }],
}

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

/**
 * Choose a delivery channel and type a destination. The channel Select is the
 * last combobox in the form (its index shifts when the document-type Select is
 * replaced by a template-bound pill), so target it from the end. Both fields
 * are mandatory — without them the generate button stays disabled.
 */
async function chooseDelivery(
  user: ReturnType<typeof userEvent.setup>,
  label = 'Telegram',
  contact = '@client_tg'
) {
  const combos = await screen.findAllByRole('combobox')
  await user.click(combos[combos.length - 1])
  await user.click(await screen.findByRole('option', { name: label }))
  await user.type(screen.getByPlaceholderText(/380/), contact)
}

describe('GenerateDocumentModal', () => {
  beforeEach(() => {
    getOptionsMock.mockReset()
    generateMock.mockReset()
    // No client contacts by default — the delivery-contact field stays a plain
    // input. Contact-picker tests override this per case.
    useClientProfileMock.mockReturnValue({ data: undefined })
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
    await chooseDelivery(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [templateId, payload] = generateMock.mock.calls[0]
    expect(templateId).toBe(10)
    expect(payload).toEqual({
      client_id: 100,
      debt_id: 555,
      document_type_id: 42,
      delivery_channel: 'telegram',
      delivery_contact: '@client_tg',
    })
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
    await chooseDelivery(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    // The generated letter must show up in the outgoing registry without a
    // manual refresh — the modal invalidates the whole registry family.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: legalRegistryKeys.root() })
    )
  })

  it('always sends delivery_channel and delivery_contact', async () => {
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
    await chooseDelivery(user, 'Telegram', '@client_tg')
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1))
    const [, payload] = generateMock.mock.calls[0]
    expect(payload).toMatchObject({
      delivery_channel: 'telegram',
      delivery_contact: '@client_tg',
    })
  })

  it('keeps generate disabled until a delivery channel and contact are provided', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)

    // Type is chosen but delivery is not yet filled → generation is blocked.
    expect(screen.getByRole('button', { name: 'Згенерувати' })).toBeDisabled()

    // A channel alone is not enough — the contact is mandatory too.
    const combos = await screen.findAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    await user.click(await screen.findByRole('option', { name: 'Telegram' }))
    expect(screen.getByRole('button', { name: 'Згенерувати' })).toBeDisabled()

    // With both channel and contact set, generation unlocks.
    await user.type(screen.getByPlaceholderText(/380/), '@client_tg')
    expect(screen.getByRole('button', { name: 'Згенерувати' })).toBeEnabled()
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
    await chooseDelivery(user)
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
    await chooseDelivery(user)
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

    await chooseDelivery(user)
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
    await chooseDelivery(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    expect(await screen.findByText('Немає актуальної обіцянки платежу')).toBeInTheDocument()
  })

  it('pre-fills the delivery channel and contact from the prefill prop', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <GenerateDocumentModal
          open
          onClose={() => undefined}
          clientId={100}
          loans={[LOAN]}
          prefill={{ deliveryChannel: 'email', deliveryContact: 'client@example.com' }}
        />
      </QueryClientProvider>
    )

    // The contact is seeded from the prefill; picking a template + type is then
    // enough to enable generate because the mandatory delivery fields already
    // carry the prefilled values.
    expect(screen.getByPlaceholderText(/380/)).toHaveValue('client@example.com')
    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    expect(screen.getByRole('button', { name: 'Згенерувати' })).toBeEnabled()
  })

  it('delegates to onGenerated and still shows the success screen with the .docx download', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockResolvedValue({
      document_id: 9,
      document_name: 'Demand letter #9',
      index_num: 9,
      pdf_document: { id: 9, original_filename: 'demand.pdf' },
      docx_base64: 'AAA=',
    })
    const onGenerated = vi.fn()
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <GenerateDocumentModal
          open
          onClose={() => undefined}
          clientId={100}
          loans={[LOAN]}
          prefill={{ deliveryChannel: 'email', deliveryContact: 'client@example.com' }}
          onGenerated={onGenerated}
        />
      </QueryClientProvider>
    )

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1))
    expect(onGenerated.mock.calls[0]![0]).toMatchObject({ document_id: 9 })
    // The success screen still appears: the lawyer generating from the reply
    // composer must be able to grab the .docx twin before closing the modal.
    expect(await screen.findByText('Документ згенеровано')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Завантажити \.docx/ })).toBeInTheDocument()
  })

  it('surfaces the tag-activation reason on a 409 response', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    generateMock.mockRejectedValue({
      response: {
        status: 409,
        data: { detail: { message: 'Rule not satisfied', reason: 'no_required_tag' } },
      },
    })
    const user = userEvent.setup()
    renderModal()

    await user.click(await screen.findByRole('radio', { name: /Demand letter/i }))
    await pickDocumentType(user)
    await chooseDelivery(user)
    await user.click(screen.getByRole('button', { name: 'Згенерувати' }))

    expect(await screen.findByText('Немає потрібного тегу на клієнті')).toBeInTheDocument()
  })

  it("offers the client's contacts as options in the delivery-contact field", async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    useClientProfileMock.mockReturnValue({ data: PROFILE_WITH_CONTACTS })
    const user = userEvent.setup()
    renderModal()

    // Focusing the field drops down the client's own contacts.
    await user.click(screen.getByPlaceholderText(/380/))
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('+380501112233')).toBeInTheDocument()
    expect(within(listbox).getByText('+380671234567')).toBeInTheDocument()
    expect(within(listbox).getByText('client@example.com')).toBeInTheDocument()
    // The primary number is labelled with its localised hint.
    expect(within(listbox).getByText('основний')).toBeInTheDocument()
  })

  it('fills the delivery contact when a suggestion is picked', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    useClientProfileMock.mockReturnValue({ data: PROFILE_WITH_CONTACTS })
    const user = userEvent.setup()
    renderModal()

    const input = screen.getByPlaceholderText(/380/)
    await user.click(input)
    await user.click(await screen.findByRole('option', { name: /client@example\.com/ }))

    expect(input).toHaveValue('client@example.com')
    // The dropdown closes once a contact is chosen.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('still accepts a manually typed contact that is not in the list', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    useClientProfileMock.mockReturnValue({ data: PROFILE_WITH_CONTACTS })
    const user = userEvent.setup()
    renderModal()

    const input = screen.getByPlaceholderText(/380/)
    await user.type(input, 'lawyer.override@mail.com')

    expect(input).toHaveValue('lawyer.override@mail.com')
    // Nothing matches the free-text value → the dropdown gives way to it.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('narrows the suggestions to the selected delivery channel', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    useClientProfileMock.mockReturnValue({ data: PROFILE_WITH_CONTACTS })
    const user = userEvent.setup()
    renderModal()

    // Pick the email channel (last combobox) → only email contacts remain.
    const combos = await screen.findAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    await user.click(await screen.findByRole('option', { name: 'Ел. пошта' }))

    await user.click(screen.getByPlaceholderText(/380/))
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).getByText('client@example.com')).toBeInTheDocument()
    expect(within(listbox).queryByText('+380501112233')).not.toBeInTheDocument()
  })

  it('falls back to a plain input when the client has no contacts', async () => {
    getOptionsMock.mockResolvedValue(optionsWith(true, 'ok'))
    useClientProfileMock.mockReturnValue({ data: undefined })
    const user = userEvent.setup()
    renderModal()

    const input = screen.getByPlaceholderText(/380/)
    await user.click(input)
    // No contacts → no dropdown, only free-text entry.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.type(input, '+380123456789')
    expect(input).toHaveValue('+380123456789')
  })
})
