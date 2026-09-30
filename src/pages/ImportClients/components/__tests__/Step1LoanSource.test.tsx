import { beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'

import { Step1LoanSource, type Step1Data } from '../Step1LoanSource'
import { EMPTY_NEW_FACTORING_AGREEMENT } from '../../utils/newFactoringAgreement'

// Keys, not words — but the interpolation values are kept (bar the fallback),
// so a test can see WHICH type the conflict message names.
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

const agreements = vi.hoisted(() => ({ items: [] as Array<Record<string, unknown>> }))

vi.mock('@/features/projects', () => ({
  useProjects: () => ({
    data: { projects: [{ id: 1, code: 'P1', name: 'Project one' }] },
    isLoading: false,
  }),
}))

// The barrel is mocked wholesale on purpose: the component must read the sale
// type rule by its direct path, or this mock would blank it out.
vi.mock('@/features/sellers', () => ({
  useSellers: () => ({
    data: {
      sellers: [
        { id: 7, seller_code: 'EG', seller_name: 'Egroshi', legal_name: 'ТОВ «ФК»' },
        { id: 8, seller_code: 'FB', seller_name: 'Finbust', legal_name: 'ТОВ «ФБ»' },
      ],
    },
    isLoading: false,
  }),
  useSellerFactoringAgreements: () => ({ data: { items: agreements.items }, isLoading: false }),
}))

vi.mock('@/features/imports', () => ({
  useVendorSchemas: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { timezone: string } }) => unknown) =>
    selector({ user: { timezone: 'UTC' } }),
}))

// The date picker is a third-party widget with its own typed-input handling;
// a plain input hands the step the same `{ value: Date }` it would.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({
    id,
    label,
    onChange,
  }: {
    id?: string
    label?: string
    onChange?: (args: { value: Date | null }) => void
  }) => (
    <div id={id}>
      <label>
        {label}
        <input
          type="date"
          onChange={(e) =>
            onChange?.({ value: e.target.value ? new Date(`${e.target.value}T12:00:00`) : null })
          }
        />
      </label>
    </div>
  ),
}))

// Radix select probes pointer capture, which jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  agreements.items = []
})

const CONFLICT = 'pages.imports.step1.factoringAgreement.saleTypeConflict'
const FACTORING = 'saleType.values.factoring'
const CESSION = 'saleType.values.cession'

const baseData: Step1Data = {
  sellerId: '7',
  projectCode: 'P1',
  comment: '',
  importType: 'simple',
  schemaCode: '',
  factoringAgreementMode: 'new',
  factoringAgreementId: '',
  newFactoringAgreement: { ...EMPTY_NEW_FACTORING_AGREEMENT },
  selectedSellerLegalName: 'ТОВ «ФК»',
  saleTypeConflict: null,
}

/** Holds the step's data the way the wizard page does and records every patch. */
function Harness({
  initial,
  onPatch,
}: {
  initial: Step1Data
  onPatch: (patch: Partial<Step1Data>) => void
}) {
  const [data, setData] = useState(initial)
  const onChange = useCallback(
    (patch: Partial<Step1Data>) => {
      onPatch(patch)
      setData((prev) => ({ ...prev, ...patch }))
    },
    [onPatch]
  )
  return <Step1LoanSource data={data} onChange={onChange} />
}

function renderStep(overrides: Partial<Step1Data> = {}) {
  const onPatch = vi.fn()
  render(<Harness initial={{ ...baseData, ...overrides }} onPatch={onPatch} />)
  return { onPatch, user: userEvent.setup() }
}

const saleTypeTrigger = () => document.querySelector('#new-fa-sale-type') as HTMLElement
const purchaseDateInput = () =>
  screen.getByLabelText('pages.imports.step1.factoringAgreement.fields.contractPurchaseDate')
const typePurchaseDate = (day: string) =>
  fireEvent.change(purchaseDateInput(), { target: { value: day } })

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  name: string
) {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name }))
}

describe('Step1LoanSource — contract type of a new agreement', () => {
  it('leads the create block and preselects cession', () => {
    renderStep()

    expect(screen.getByText('saleType.label')).toBeInTheDocument()
    expect(saleTypeTrigger()).toHaveTextContent(CESSION)
  })

  it('offers exactly factoring and cession', async () => {
    const { user } = renderStep()

    await user.click(saleTypeTrigger())

    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([FACTORING, CESSION])
  })

  it('keeps factoring once it is chosen', async () => {
    const { user, onPatch } = renderStep()

    await choose(user, saleTypeTrigger(), FACTORING)

    expect(onPatch).toHaveBeenLastCalledWith({
      newFactoringAgreement: { ...EMPTY_NEW_FACTORING_AGREEMENT, sale_type: 'factoring' },
      saleTypeChosen: true,
      saleTypeConflict: null,
    })
    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
  })

  it('goes back to cession when the seller changes', async () => {
    const { user, onPatch } = renderStep()
    await choose(user, saleTypeTrigger(), FACTORING)

    await choose(user, document.querySelector('#seller-creditor') as HTMLElement, 'FB - Finbust')

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: '8',
        newFactoringAgreement: EMPTY_NEW_FACTORING_AGREEMENT,
        saleTypeChosen: false,
      })
    )
    expect(saleTypeTrigger()).toHaveTextContent(CESSION)
  })

  it('goes back to cession when the agreement mode is switched away and back', async () => {
    const { user } = renderStep()
    await choose(user, saleTypeTrigger(), FACTORING)

    await user.click(
      screen.getByRole('radio', { name: 'pages.imports.step1.factoringAgreement.pickExisting' })
    )
    await user.click(
      screen.getByRole('radio', { name: 'pages.imports.step1.factoringAgreement.createNew' })
    )

    expect(saleTypeTrigger()).toHaveTextContent(CESSION)
  })
})

describe('Step1LoanSource — the type follows the purchase date until it is picked', () => {
  // A historical import typed in with its old date must not leave as cession
  // just because nobody opened the type field.
  it('turns to factoring for a purchase before 30.07.2026', () => {
    const { onPatch } = renderStep()

    typePurchaseDate('2026-07-29')

    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
    expect(onPatch).toHaveBeenLastCalledWith({
      newFactoringAgreement: {
        ...EMPTY_NEW_FACTORING_AGREEMENT,
        contract_purchase_date: '2026-07-29T12:00:00.000Z',
        sale_type: 'factoring',
      },
      saleTypeConflict: null,
    })
  })

  it('turns back to cession for a purchase on 30.07.2026, and when the date is cleared', () => {
    renderStep()
    typePurchaseDate('2026-07-29')
    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)

    typePurchaseDate('2026-07-30')
    expect(saleTypeTrigger()).toHaveTextContent(CESSION)

    typePurchaseDate('2025-01-10')
    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
    typePurchaseDate('')
    expect(saleTypeTrigger()).toHaveTextContent(CESSION)
  })

  it('stays silent while it follows the date — there is nothing to contradict', () => {
    renderStep()

    typePurchaseDate('2026-07-29')
    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
    expect(
      screen.queryByText('pages.imports.step1.factoringAgreement.saleTypeDateHint')
    ).not.toBeInTheDocument()

    typePurchaseDate('2026-07-30')
    expect(saleTypeTrigger()).toHaveTextContent(CESSION)
    expect(
      screen.queryByText('pages.imports.step1.factoringAgreement.saleTypeDateHint')
    ).not.toBeInTheDocument()
  })

  it('keeps a type picked by hand when the date is cleared — no fall back to the default', async () => {
    const { user, onPatch } = renderStep()
    await choose(user, saleTypeTrigger(), FACTORING)
    typePurchaseDate('2026-09-30')

    typePurchaseDate('')

    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
    expect(onPatch).toHaveBeenLastCalledWith({
      newFactoringAgreement: {
        ...EMPTY_NEW_FACTORING_AGREEMENT,
        contract_purchase_date: '',
        sale_type: 'factoring',
      },
      saleTypeConflict: null,
    })
  })

  it('stays where the operator put it once picked by hand, and warns on a mismatch', async () => {
    const { user } = renderStep()
    await choose(user, saleTypeTrigger(), FACTORING)

    typePurchaseDate('2026-09-30')

    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
    expect(
      screen.getAllByText('pages.imports.step1.factoringAgreement.saleTypeDateHint')
    ).toHaveLength(2)
  })

  it('follows the date again after the seller changes', async () => {
    const { user } = renderStep()
    await choose(user, saleTypeTrigger(), FACTORING)
    await choose(user, document.querySelector('#seller-creditor') as HTMLElement, 'FB - Finbust')
    expect(saleTypeTrigger()).toHaveTextContent(CESSION)

    typePurchaseDate('2026-01-15')

    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
  })

  it('follows the date again after the agreement mode is switched away and back', async () => {
    const { user, onPatch } = renderStep()
    await choose(user, saleTypeTrigger(), FACTORING)

    await user.click(
      screen.getByRole('radio', { name: 'pages.imports.step1.factoringAgreement.pickExisting' })
    )
    await user.click(
      screen.getByRole('radio', { name: 'pages.imports.step1.factoringAgreement.createNew' })
    )
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ factoringAgreementMode: 'existing', saleTypeChosen: false })
    )

    typePurchaseDate('2026-01-15')

    expect(saleTypeTrigger()).toHaveTextContent(FACTORING)
  })
})

describe('Step1LoanSource — existing agreements', () => {
  it('shows each known agreement type next to its number, and nothing when it has none', async () => {
    agreements.items = [
      {
        id: 1,
        agreement_number: 'A-1',
        previous_lender: 'Lender',
        contract_purchase_date: '2026-09-18',
        sale_type: 'cession',
      },
      {
        id: 2,
        agreement_number: 'B-2',
        previous_lender: 'Old lender',
        contract_purchase_date: '2025-01-10',
        sale_type: 'factoring',
      },
      // A client-service not rolled out yet sends no type at all.
      { id: 3, agreement_number: 'C-3', previous_lender: 'Nobody', contract_purchase_date: null },
      { id: 4, agreement_number: 'D-4', previous_lender: null, sale_type: 'credit' },
    ]
    const { user } = renderStep({ factoringAgreementMode: 'existing' })

    await user.click(document.querySelector('#factoring-agreement-id') as HTMLElement)

    const texts = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(texts[0]).toMatch(new RegExp(`^A-1 · ${CESSION} — Lender \\(`))
    expect(texts[1]).toMatch(new RegExp(`^B-2 · ${FACTORING} — Old lender \\(`))
    // No type segment at all — not "C-3 · — — Nobody", two dashes of different meaning.
    expect(texts[2]).toMatch(/^C-3 — Nobody \(/)
    expect(texts[3]).toMatch(/^D-4 — — \(/)
    expect(texts[2]).not.toContain('·')
    expect(texts[3]).not.toContain('·')
  })

  it('has no type field in the existing mode — an existing agreement keeps its type', () => {
    renderStep({ factoringAgreementMode: 'existing' })

    expect(saleTypeTrigger()).toBeNull()
  })
})

describe('Step1LoanSource — type conflict returned by the upload', () => {
  const NUMBER = '30-09-26ФБ'
  const numberInput = () =>
    screen.getByLabelText(/pages\.imports\.step1\.factoringAgreement\.fields\.number/)
  /** Step 1 as the upload was sent: seller 7, this number, and the 409 about them. */
  const withConflict = (
    existingSaleType: 'factoring' | 'cession' | null,
    over: { sellerId?: string; agreementNumber?: string; formNumber?: string } = {}
  ): Partial<Step1Data> => ({
    newFactoringAgreement: {
      ...EMPTY_NEW_FACTORING_AGREEMENT,
      agreement_number: over.formNumber ?? NUMBER,
    },
    saleTypeConflict: {
      existingSaleType,
      sellerId: over.sellerId ?? '7',
      agreementNumber: over.agreementNumber ?? NUMBER,
    },
  })

  it('names the type the seller’s agreement already has, under the create block', () => {
    renderStep(withConflict('factoring'))

    expect(screen.getByRole('alert')).toHaveTextContent(`${CONFLICT}(${FACTORING})`)
  })

  it('says "not set" when the existing agreement has no type', () => {
    renderStep(withConflict(null))

    expect(screen.getByRole('alert')).toHaveTextContent(`${CONFLICT}(saleType.none)`)
  })

  it('is absent without a conflict', () => {
    renderStep()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('brings the message into view and puts the cursor in the agreement number', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    onTestFinished(() => focus.mockRestore())
    renderStep(withConflict('factoring'))

    const alert = screen.getByRole('alert')
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    expect(scrollIntoView.mock.contexts).toContain(alert)
    expect(numberInput()).toHaveFocus()
    // Focus must not scroll again and push the message back out of view.
    expect(focus.mock.contexts).toContain(numberInput())
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('moves neither the page nor the cursor for a conflict about another number', () => {
    renderStep(withConflict('factoring', { agreementNumber: 'OTHER-1' }))

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    expect(numberInput()).not.toHaveFocus()
  })

  // The cursor lands in the number: a screen reader reads out why with it.
  it('ties the agreement number to the message', () => {
    renderStep(withConflict('factoring'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('id', 'new-fa-sale-type-conflict')
    expect(numberInput()).toHaveAttribute('aria-describedby', 'new-fa-sale-type-conflict')
    expect(numberInput()).toHaveAccessibleDescription(`${CONFLICT}(${FACTORING})`)
  })

  it.each([
    ['without a conflict', {}],
    ['for a conflict about another number', withConflict('factoring', { agreementNumber: 'X' })],
  ])('leaves the agreement number undescribed %s', (_label, over) => {
    renderStep(over)

    expect(numberInput()).not.toHaveAttribute('aria-describedby')
  })

  it('still matches a number typed with surrounding spaces — the upload sent it trimmed', () => {
    renderStep(withConflict('cession', { formNumber: `  ${NUMBER} ` }))

    expect(screen.getByRole('alert')).toHaveTextContent(`${CONFLICT}(${CESSION})`)
  })

  // The 409 can land after the operator went back and changed step 1: it is then
  // about an agreement no longer on the form, and saying it would mislead.
  it.each([
    ['another number', { agreementNumber: 'OTHER-1' }],
    ['another seller', { sellerId: '8' }],
  ])('is not shown when the conflict was about %s', (_label, over) => {
    renderStep(withConflict('factoring', over))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears once the agreement number is edited', async () => {
    const { user, onPatch } = renderStep(withConflict('factoring'))

    await user.type(
      screen.getByLabelText(/pages\.imports\.step1\.factoringAgreement\.fields\.number/),
      '7'
    )

    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ saleTypeConflict: null }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears once the type is changed', async () => {
    const { user } = renderStep(withConflict('factoring'))

    await choose(user, saleTypeTrigger(), FACTORING)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears once the seller is changed', async () => {
    const { user, onPatch } = renderStep(withConflict('factoring'))

    await choose(user, document.querySelector('#seller-creditor') as HTMLElement, 'FB - Finbust')

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: '8', saleTypeConflict: null })
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears once the agreement mode is switched', async () => {
    const { user, onPatch } = renderStep(withConflict('factoring'))

    await user.click(
      screen.getByRole('radio', { name: 'pages.imports.step1.factoringAgreement.pickExisting' })
    )
    await user.click(
      screen.getByRole('radio', { name: 'pages.imports.step1.factoringAgreement.createNew' })
    )

    // Cleared from the data, not merely hidden by the emptied number.
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ factoringAgreementMode: 'existing', saleTypeConflict: null })
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Step1LoanSource — type against the purchase date', () => {
  const HINT = 'pages.imports.step1.factoringAgreement.saleTypeDateHint'
  // A mismatch can only come from a type picked by hand: until then the type
  // follows the date.
  const withDate = (contractPurchaseDate: string, saleType: 'factoring' | 'cession') => ({
    newFactoringAgreement: {
      ...EMPTY_NEW_FACTORING_AGREEMENT,
      contract_purchase_date: contractPurchaseDate,
      sale_type: saleType,
    },
    saleTypeChosen: true,
  })

  // The wizard stores the chosen day as a noon-UTC ISO datetime.
  it.each([
    ['cession on a date before 30.07.2026', '2026-07-29T12:00:00.000Z', 'cession'],
    ['factoring from 30.07.2026 on', '2026-07-30T12:00:00.000Z', 'factoring'],
  ] as const)('warns about %s — without blocking anything', (_label, date, saleType) => {
    renderStep(withDate(date, saleType))

    // Under both fields — either may be the one to fix — as a warning, not
    // as the muted helper text around it.
    const typeField = saleTypeTrigger().parentElement as HTMLElement
    const dateField = (document.querySelector('#new-fa-contract-purchase-date') as HTMLElement)
      .parentElement as HTMLElement
    expect(screen.getAllByText(HINT)).toHaveLength(2)
    expect(within(typeField).getByText(HINT)).toHaveClass('text-warning-700')
    expect(within(dateField).getByText(HINT)).toHaveClass('text-warning-700')
    // A hint, not a refusal: nothing is announced as an error.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['factoring before 30.07.2026', '2026-07-29T12:00:00.000Z', 'factoring'],
    ['cession on 30.07.2026', '2026-07-30T12:00:00.000Z', 'cession'],
    ['no purchase date yet (cession)', '', 'cession'],
    ['no purchase date yet (factoring)', '', 'factoring'],
  ] as const)('stays silent for %s', (_label, date, saleType) => {
    renderStep(withDate(date, saleType))

    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
  })

  it('goes away once the type is switched to the one the date implies', async () => {
    const { user } = renderStep(withDate('2026-01-15T12:00:00.000Z', 'cession'))
    expect(screen.getAllByText(HINT)).toHaveLength(2)

    await choose(user, saleTypeTrigger(), FACTORING)

    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
  })
})
