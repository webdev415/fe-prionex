import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Step2VendorDump } from '../Step2VendorDump'
import type { Step1Data } from '../Step1LoanSource'
import { EMPTY_NEW_FACTORING_AGREEMENT } from '../../utils/newFactoringAgreement'

// Same stubbing as the simple flow's test: the API module, under the real hook.
const uploadImport = vi.hoisted(() => vi.fn())
vi.mock('@/features/imports/api/importsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/imports/api/importsApi')>()
  return { ...actual, importsApi: { ...actual.importsApi, uploadImport } }
})

vi.mock('@/features/sellers', () => ({
  useSellerFactoringAgreements: () => ({ data: { items: [] } }),
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

const step1Data: Step1Data = {
  sellerId: '7',
  projectCode: 'P1',
  comment: '',
  importType: 'vendor',
  schemaCode: 'egroshi_v1',
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

function renderStep(step1: Step1Data = step1Data) {
  const onSaleTypeConflict = vi.fn()
  const onImportStarted = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <Step2VendorDump
        data={{ files: [], zipFile: new File(['zip'], 'dump.zip'), isZipUpload: true }}
        onChange={vi.fn()}
        step1Data={step1}
        onImportStarted={onImportStarted}
        onSaleTypeConflict={onSaleTypeConflict}
      />
    </QueryClientProvider>
  )
  return { onSaleTypeConflict, onImportStarted, user: userEvent.setup() }
}

const startImport = () => screen.getByRole('button', { name: /step2\.vendor\.startImport/ })

describe('Step2VendorDump — contract type of a new agreement', () => {
  it('sends the type chosen on step 1, cession by default', async () => {
    uploadImport.mockResolvedValue({ job_id: 9 })
    const { user, onImportStarted } = renderStep()

    await user.click(startImport())

    await waitFor(() => expect(onImportStarted).toHaveBeenCalledWith(9))
    const body = JSON.parse(uploadImport.mock.calls[0][0].new_factoring_agreement_json as string)
    expect(body.sale_type).toBe('cession')
  })

  const conflict409 = () =>
    httpError(409, {
      detail: 'Agreement already exists with another sale_type',
      code: 'SALE_TYPE_CONFLICT',
      params: { existing_sale_type: null, reason: 'debt_types' },
    })

  it('hands a 409 SALE_TYPE_CONFLICT back to step 1 with its reason', async () => {
    uploadImport.mockRejectedValue(conflict409())
    const { user, onSaleTypeConflict } = renderStep()

    await user.click(startImport())

    await waitFor(() =>
      expect(onSaleTypeConflict).toHaveBeenCalledWith({
        existingSaleType: null,
        reason: 'debt_types',
        sellerId: '7',
        agreementNumber: '30-09-26ФБ',
      })
    )
  })

  it('keeps the same 409 on step 2 when an EXISTING agreement was picked', async () => {
    uploadImport.mockRejectedValue(conflict409())
    const { user, onSaleTypeConflict } = renderStep({
      ...step1Data,
      factoringAgreementMode: 'existing',
      factoringAgreementId: '42',
    })

    await user.click(startImport())

    expect(
      await screen.findByText('Agreement already exists with another sale_type')
    ).toBeInTheDocument()
    expect(onSaleTypeConflict).not.toHaveBeenCalled()
  })

  it('drops an earlier refusal when it hands the conflict back', async () => {
    uploadImport.mockRejectedValueOnce(httpError(409, { detail: 'Agreement is locked' }))
    uploadImport.mockRejectedValueOnce(conflict409())
    const { user, onSaleTypeConflict } = renderStep()
    await user.click(startImport())
    expect(await screen.findByText('Agreement is locked')).toBeInTheDocument()

    await waitFor(() => expect(startImport()).toBeEnabled())
    await user.click(startImport())

    await waitFor(() => expect(onSaleTypeConflict).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Agreement is locked')).not.toBeInTheDocument()
  })

  it('keeps any other refusal on step 2', async () => {
    uploadImport.mockRejectedValue(httpError(409, { detail: 'Agreement is locked' }))
    const { user, onSaleTypeConflict } = renderStep()

    await user.click(startImport())

    expect(await screen.findByText('Agreement is locked')).toBeInTheDocument()
    expect(onSaleTypeConflict).not.toHaveBeenCalled()
  })
})
