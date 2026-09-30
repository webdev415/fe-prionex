/**
 * The whole wizard on a 409 SALE_TYPE_CONFLICT (KAN-1617): real step 1, real
 * step 2, the real `useUploadImport` — only the network and the date picker
 * are stubbed. The step components' own tests pin each half; this one pins
 * the hand-over between them that only the page owns: the conflict lands back
 * on step 1, under the create block, naming the type.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { ImportClientsPage } from '../ImportClientsPage'

// Keys, not words — but interpolation values are kept (bar the fallback), so
// the conflict message can be seen naming the type.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrVars?: unknown, vars?: Record<string, unknown>) => {
      const values = (vars ?? (typeof fallbackOrVars === 'object' ? fallbackOrVars : {})) as Record<
        string,
        unknown
      >
      const shown = Object.entries(values ?? {})
        .filter(([name]) => name !== 'defaultValue')
        .map(([, value]) => String(value))
      return shown.length > 0 ? `${key}(${shown.join(',')})` : key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const uploadImport = vi.hoisted(() => vi.fn())
vi.mock('@/features/imports/api/importsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/imports/api/importsApi')>()
  return {
    ...actual,
    importsApi: {
      ...actual.importsApi,
      uploadImport,
      getImportJobs: vi.fn(async () => ({ items: [], total: 0, page: 1, page_size: 10 })),
      getImportJobDetail: vi.fn(),
      getVendorSchemas: vi.fn(async () => [{ code: 'egroshi_v1', display_name: 'Egroshi v1' }]),
    },
  }
})

vi.mock('@/features/projects', () => ({
  useProjects: () => ({
    data: { projects: [{ id: 1, code: 'P1', name: 'Project one' }] },
    isLoading: false,
  }),
}))

vi.mock('@/features/sellers', () => ({
  useSellers: () => ({
    data: {
      sellers: [{ id: 7, seller_code: 'EG', seller_name: 'Egroshi', legal_name: 'ТОВ «ФК»' }],
    },
    isLoading: false,
  }),
  useSellerFactoringAgreements: () => ({ data: { items: [] }, isLoading: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string; timezone: string } }) => unknown) =>
    selector({ user: { id: '1', timezone: 'UTC' } }),
}))

// The date picker is a third-party widget with its own typed-input handling;
// a plain input hands the step the same `{ value: Date }` it would.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    label,
    onChange,
  }: {
    label?: string
    onChange?: (args: { value: Date | null }) => void
  }) => (
    <label>
      {label}
      <input
        type="date"
        onChange={(e) =>
          onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
        }
      />
    </label>
  ),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Radix select probes pointer capture, which jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
})

const FA = 'pages.imports.step1.factoringAgreement'

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

const conflict409 = () =>
  httpError(409, {
    detail: 'Agreement 30-09-26ФБ already exists for this seller with sale_type factoring',
    code: 'SALE_TYPE_CONFLICT',
    params: { existing_sale_type: 'factoring' },
  })

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/import/clients']}>
        <ImportClientsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return userEvent.setup()
}

type User = ReturnType<typeof userEvent.setup>

async function choose(user: User, trigger: HTMLElement, name: string) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name }))
}

const nextButton = () => screen.getByRole('button', { name: /pages\.imports\.nextStep/ })

/** Step 1 with a NEW agreement, the type left at its default. */
async function fillStep1(user: User, importType: 'simple' | 'vendor') {
  await choose(user, document.querySelector('#seller-creditor') as HTMLElement, 'EG - Egroshi')
  await choose(user, document.querySelector('#project-code') as HTMLElement, 'P1 - Project one')
  if (importType === 'vendor') {
    await user.click(document.querySelector('#import-radio-vendor') as HTMLElement)
    // The schema list arrives from the (stubbed) API; the select opens once it has.
    const schema = document.querySelector('#vendor-schema-code') as HTMLElement
    await waitFor(() => expect(schema).toBeEnabled())
    await choose(user, schema, 'Egroshi v1 (egroshi_v1)')
  }
  await user.click(screen.getByRole('radio', { name: `${FA}.createNew` }))
  await user.type(screen.getByLabelText(new RegExp(`${FA}\\.fields\\.number`)), '30-09-26ФБ')
  fireEvent.change(screen.getByLabelText(`${FA}.fields.reportingDate`), {
    target: { value: '2026-09-30' },
  })
  fireEvent.change(screen.getByLabelText(`${FA}.fields.contractPurchaseDate`), {
    target: { value: '2026-09-30' },
  })
}

async function expectBackOnStep1WithConflict() {
  // Step 1 again: the create block with its type field is on screen…
  await waitFor(() => expect(document.querySelector('#new-fa-sale-type')).not.toBeNull())
  // …and under it, the refusal naming the type the seller's agreement has.
  expect(screen.getByRole('alert')).toHaveTextContent(
    `${FA}.saleTypeConflict(saleType.values.factoring)`
  )
  // What the operator typed is still there to fix.
  expect(screen.getByLabelText(new RegExp(`${FA}\\.fields\\.number`))).toHaveValue('30-09-26ФБ')
}

describe('ImportClientsPage — step 1 with a new agreement', () => {
  it('lets the operator on once every required field is filled, the type at cession', async () => {
    const user = renderPage()

    await choose(user, document.querySelector('#seller-creditor') as HTMLElement, 'EG - Egroshi')
    await choose(user, document.querySelector('#project-code') as HTMLElement, 'P1 - Project one')
    await user.click(screen.getByRole('radio', { name: `${FA}.createNew` }))
    // Control: the create block alone does not open step 2.
    expect(nextButton()).toBeDisabled()

    await user.type(screen.getByLabelText(new RegExp(`${FA}\\.fields\\.number`)), '30-09-26ФБ')
    fireEvent.change(screen.getByLabelText(`${FA}.fields.reportingDate`), {
      target: { value: '2026-09-30' },
    })
    fireEvent.change(screen.getByLabelText(`${FA}.fields.contractPurchaseDate`), {
      target: { value: '2026-09-30' },
    })

    expect(document.querySelector('#new-fa-sale-type')).toHaveTextContent('saleType.values.cession')
    expect(nextButton()).toBeEnabled()
  })
})

describe('ImportClientsPage — a 409 SALE_TYPE_CONFLICT returns the wizard to step 1', () => {
  it('from the simple CSV flow', async () => {
    uploadImport.mockRejectedValue(conflict409())
    const user = renderPage()
    await fillStep1(user, 'simple')
    await user.click(nextButton())

    const header = [
      'clients_first_name',
      'clients_last_name',
      'clients_tax_id',
      'client_contacts_client_mobile_phone_contact_value',
      'debts_1_contract_number',
      'debts_1_remaining_debt_amount',
      'debts_1_seller_company_legacy',
    ].join(',')
    await user.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([`${header}\n`], 'clients.csv', { type: 'text/csv' })
    )
    const start = screen.getByRole('button', { name: /step2\.simple\.startImport/ })
    await waitFor(() => expect(start).toBeEnabled())
    await user.click(start)

    await expectBackOnStep1WithConflict()
    expect(JSON.parse(uploadImport.mock.calls[0][0].new_factoring_agreement_json)).toMatchObject({
      agreement_number: '30-09-26ФБ',
      sale_type: 'cession',
    })
  })

  it('from the vendor dump flow', async () => {
    uploadImport.mockRejectedValue(conflict409())
    const user = renderPage()
    await fillStep1(user, 'vendor')
    await user.click(nextButton())

    await user.upload(
      document.querySelector('input[type="file"][multiple]') as HTMLInputElement,
      new File(['zip'], 'dump.zip', { type: 'application/zip' })
    )
    const start = screen.getByRole('button', { name: /step2\.vendor\.startImport/ })
    await waitFor(() => expect(start).toBeEnabled())
    await user.click(start)

    await expectBackOnStep1WithConflict()
    expect(uploadImport.mock.calls[0][0]).toMatchObject({ import_type: 'vendor' })
  })
})
