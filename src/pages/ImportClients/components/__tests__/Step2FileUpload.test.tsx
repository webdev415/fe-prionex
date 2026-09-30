import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentProps } from 'react'

import { Step2FileUpload } from '../Step2FileUpload'
import type { Step1Data } from '../Step1LoanSource'
import { EMPTY_NEW_FACTORING_AGREEMENT } from '../../utils/newFactoringAgreement'

// The network is stubbed at the API module; the real `useUploadImport` runs on
// top of it, so the component meets the rejection exactly as axios hands it over.
const uploadImport = vi.hoisted(() => vi.fn())
vi.mock('@/features/imports/api/importsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/imports/api/importsApi')>()
  return { ...actual, importsApi: { ...actual.importsApi, uploadImport } }
})

vi.mock('@/features/sellers', () => ({
  useSellerFactoringAgreements: () => ({
    data: { items: [{ id: 42, agreement_number: 'OLD-1', contract_purchase_date: '2025-01-10' }] },
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

const SALE_TYPE_CONFLICT_409 = httpError(409, {
  detail: 'Agreement 30-09-26ФБ already exists for this seller with sale_type factoring',
  code: 'SALE_TYPE_CONFLICT',
  params: { existing_sale_type: 'factoring' },
})

const newAgreementStep1: Step1Data = {
  sellerId: '7',
  projectCode: 'P1',
  comment: '',
  importType: 'simple',
  schemaCode: '',
  factoringAgreementMode: 'new',
  factoringAgreementId: '',
  newFactoringAgreement: {
    ...EMPTY_NEW_FACTORING_AGREEMENT,
    agreement_number: '30-09-26ФБ',
    contract_purchase_date: '2026-09-30T12:00:00.000Z',
    reporting_date: '2026-09-30T12:00:00.000Z',
  },
  selectedSellerLegalName: 'ТОВ «ФК»',
  saleTypeConflict: null,
}

function renderStep(props: Partial<ComponentProps<typeof Step2FileUpload>> = {}) {
  const onSaleTypeConflict = vi.fn()
  const onImportStarted = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <Step2FileUpload
        data={{
          csvFile: new File(['clients_first_name\n'], 'clients.csv', { type: 'text/csv' }),
          invalidFile: null,
          csvValidationError: null,
        }}
        onChange={vi.fn()}
        step1Data={newAgreementStep1}
        onImportStarted={onImportStarted}
        onSaleTypeConflict={onSaleTypeConflict}
        {...props}
      />
    </QueryClientProvider>
  )
  return { onSaleTypeConflict, onImportStarted, user: userEvent.setup() }
}

const startImport = () => screen.getByRole('button', { name: /step2\.simple\.startImport/ })
const sentAgreement = () =>
  JSON.parse(uploadImport.mock.calls[0][0].new_factoring_agreement_json as string)

describe('Step2FileUpload — contract type of a new agreement', () => {
  it('sends cession when the type was left at its default', async () => {
    uploadImport.mockResolvedValue({ job_id: 5 })
    const { user, onImportStarted } = renderStep()

    await user.click(startImport())

    await waitFor(() => expect(onImportStarted).toHaveBeenCalledWith(5))
    expect(sentAgreement()).toEqual({
      agreement_number: '30-09-26ФБ',
      contract_purchase_date: '2026-09-30',
      reporting_date: '2026-09-30',
      sale_type: 'cession',
    })
  })

  it('sends factoring when factoring was chosen', async () => {
    uploadImport.mockResolvedValue({ job_id: 6 })
    const { user, onImportStarted } = renderStep({
      step1Data: {
        ...newAgreementStep1,
        newFactoringAgreement: {
          ...newAgreementStep1.newFactoringAgreement,
          sale_type: 'factoring',
        },
      },
    })

    await user.click(startImport())

    await waitFor(() => expect(onImportStarted).toHaveBeenCalledWith(6))
    expect(sentAgreement().sale_type).toBe('factoring')
  })

  it('sends no new agreement — and so no type — when an existing one is picked', async () => {
    uploadImport.mockResolvedValue({ job_id: 7 })
    const { user, onImportStarted } = renderStep({
      step1Data: {
        ...newAgreementStep1,
        factoringAgreementMode: 'existing',
        factoringAgreementId: '42',
      },
    })

    await user.click(startImport())

    await waitFor(() => expect(onImportStarted).toHaveBeenCalledWith(7))
    const request = uploadImport.mock.calls[0][0]
    expect(request.factoring_agreement_id).toBe(42)
    expect(request.new_factoring_agreement_json).toBeUndefined()
  })
})

describe('Step2FileUpload — the upload refuses the type', () => {
  it('hands a 409 SALE_TYPE_CONFLICT back to step 1 with the existing type', async () => {
    uploadImport.mockRejectedValue(SALE_TYPE_CONFLICT_409)
    const { user, onSaleTypeConflict, onImportStarted } = renderStep()

    await user.click(startImport())

    await waitFor(() => expect(onSaleTypeConflict).toHaveBeenCalledTimes(1))
    // Tied to the seller and number this upload was sent with, so step 1 can
    // tell a late answer about an agreement it no longer holds.
    // No `reason` in this 409 — a server from before the field.
    expect(onSaleTypeConflict).toHaveBeenCalledWith({
      existingSaleType: 'factoring',
      reason: null,
      sellerId: '7',
      agreementNumber: '30-09-26ФБ',
    })
    expect(onImportStarted).not.toHaveBeenCalled()
  })

  it('ties the conflict to the number as sent — trimmed', async () => {
    uploadImport.mockRejectedValue(SALE_TYPE_CONFLICT_409)
    const { user, onSaleTypeConflict } = renderStep({
      step1Data: {
        ...newAgreementStep1,
        newFactoringAgreement: {
          ...newAgreementStep1.newFactoringAgreement,
          agreement_number: ' 30-09-26ФБ  ',
        },
      },
    })

    await user.click(startImport())

    await waitFor(() =>
      expect(onSaleTypeConflict).toHaveBeenCalledWith(
        expect.objectContaining({ agreementNumber: '30-09-26ФБ' })
      )
    )
  })

  it('keeps the same 409 on step 2 when an EXISTING agreement was picked', async () => {
    // Only a new agreement can conflict; whatever a 409 means in the existing
    // mode, sending the operator back to a create block they did not use is wrong.
    uploadImport.mockRejectedValue(SALE_TYPE_CONFLICT_409)
    const { user, onSaleTypeConflict } = renderStep({
      step1Data: {
        ...newAgreementStep1,
        factoringAgreementMode: 'existing',
        factoringAgreementId: '42',
      },
    })

    await user.click(startImport())

    expect(
      await screen.findByText(
        'Agreement 30-09-26ФБ already exists for this seller with sale_type factoring'
      )
    ).toBeInTheDocument()
    expect(onSaleTypeConflict).not.toHaveBeenCalled()
  })

  it('drops an earlier refusal when it hands the conflict back', async () => {
    // In the wizard step 2 unmounts on the way back and takes this error along;
    // the clearing is a guard, pinned here where the step stays mounted.
    uploadImport.mockRejectedValueOnce(httpError(502, { detail: 'Agreement is locked' }))
    uploadImport.mockRejectedValueOnce(SALE_TYPE_CONFLICT_409)
    const { user, onSaleTypeConflict } = renderStep()
    await user.click(startImport())
    expect(await screen.findByText('Agreement is locked')).toBeInTheDocument()

    await waitFor(() => expect(startImport()).toBeEnabled())
    await user.click(startImport())

    await waitFor(() => expect(onSaleTypeConflict).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Agreement is locked')).not.toBeInTheDocument()
  })

  it.each([
    ['a 409 without the code', httpError(409, { detail: 'Agreement is locked' })],
    ['a 502 from the import service', httpError(502, { detail: 'Agreement is locked' })],
  ])('keeps %s on step 2', async (_label, error) => {
    uploadImport.mockRejectedValue(error)
    const { user, onSaleTypeConflict } = renderStep()

    await user.click(startImport())

    expect(await screen.findByText('Agreement is locked')).toBeInTheDocument()
    expect(onSaleTypeConflict).not.toHaveBeenCalled()
  })
})
