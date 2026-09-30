/**
 * OpenReplay masking of employees' names on the rendered «Внесені платежі» tab
 * (KAN-KB-54) — the DOM-level counterpart of `npm run pii-audit -- --check`.
 *
 * The static audit reads the SOURCE and only knows PII-shaped identifiers:
 * `responsible.label` and `name` look like nothing to it, and a portal is
 * invisible to it. This suite reads the RENDERED tree instead, with the tab's
 * three name surfaces on screen at once — the table, the breakdown block and
 * the operator multi-select with its list OPEN (a Radix portal under
 * `document.body`) — and checks the two things the tracker's mechanics make
 * non-negotiable (`src/lib/openreplay/pii.tsx`):
 *
 *  1. no `title` / `aria-label` / `alt` / `placeholder` anywhere carries a
 *     seeded name — attributes are sent to the recording verbatim, from a
 *     marked node as from any other;
 *  2. every TEXT NODE that carries a seeded name sits under an element marked
 *     `data-openreplay-obscured` — text nodes are what the mark wipes.
 *
 * `react-i18next` is mocked HERE with the real Ukrainian dictionary, not with
 * the global key-echo of `src/test/setup.ts`: under the key-echo a sentence
 * such as «Показати платежі оператора {{name}}» never contains the name, and a
 * leak through an attribute would pass unseen.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ukCommon from '@/../public/locales/uk/common.json'
import { RecordedPaymentsTab } from '../RecordedPaymentsTab'
import { getRecordedPaymentsFeed } from '../../api/recordedPaymentsFeedApi'
import type { RecordedPaymentRow, RecordedPaymentsFeedResponse } from '../../types'

vi.mock('../../api/recordedPaymentsFeedApi', () => ({
  getRecordedPaymentsFeed: vi.fn(),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      user: { active_project_id: 1, projects: [{ id: 1 }], timezone: 'Europe/Kyiv' },
    }),
}))

// The real DateSelect drags react-datepicker into jsdom; the same functional
// stub as the tab's main suite.
vi.mock('@/components/ui/DateSelect', () => ({
  DateSelect: ({ value, label }: { value?: string | Date | null; label?: string }) => (
    <input
      data-testid="date-select"
      aria-label={label}
      value={typeof value === 'string' ? value : ''}
      readOnly
    />
  ),
}))

/** `pages.reports.recordedPayments.summary` -> the uk sentence, or undefined. */
function lookupUk(key: string): string | undefined {
  let node: unknown = ukCommon
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof node === 'string' ? node : undefined
}

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const vars = options ?? {}
        const template =
          lookupUk(key) ?? (typeof vars.defaultValue === 'string' ? vars.defaultValue : key)
        return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
          name in vars ? String(vars[name]) : whole
        )
      },
      i18n: { language: 'uk' },
    }),
  }
})

const mockGetFeed = vi.mocked(getRecordedPaymentsFeed)

/** Every employee name seeded below — the strings the scan looks for. */
const SEEDED_NAMES = ['Записенко Іван', 'Коваленко Іван', 'Степченко Олена', 'Договор закрыт']

const ROW: RecordedPaymentRow = {
  payment_id: 918273,
  client_id: 4711,
  client_is_deleted: false,
  debt_id: 5001,
  contract_number: 'ДГ-12345',
  inn: '1234567890',
  amount: '1500.00',
  payment_date: '2026-08-09',
  payment_confirmation_date: '2026-08-10',
  verified_at: '2026-08-12T07:15:00Z',
  status: 'verified',
  recorded_by_user_id: 201,
  recorded_by_full_name: 'Записенко Іван',
  assigned_user_id: 202,
  assigned_full_name: 'Коваленко Іван',
  client_responsible_user_id: 101,
  client_responsible_full_name: 'Степченко Олена',
  client_responsible_is_service: false,
  purchase_date: '2024-03-15',
  seller_name: 'Acme Co',
  payment_method: 'bank_transfer',
  payment_type: 'F20',
}

/** A FILTERED answer (`rpu=101`): the selected operator names the trigger's summary too. */
const RESPONSE: RecordedPaymentsFeedResponse = {
  project_id: 1,
  date_from: '2026-08-01',
  date_to: '2026-08-31',
  timezone: 'Europe/Kyiv',
  verified_only: false,
  user_ids: [101],
  rows: [ROW],
  summary: { rows_count: 1, total_amount: '1500.00' },
  operator_breakdown: [
    {
      user_id: 6274,
      full_name: 'Договор закрыт',
      is_service: true,
      rows_count: 2,
      amount: '10.00',
    },
    {
      user_id: 101,
      full_name: 'Степченко Олена',
      is_service: false,
      rows_count: 1,
      amount: '1500.00',
    },
    { user_id: null, full_name: null, is_service: false, rows_count: 3, amount: '120.00' },
  ],
  breakdown_capped: false,
  breakdown_truncated: false,
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
  generated_at: '2026-09-29T10:15:31Z',
}

function renderTab(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <RecordedPaymentsTab />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const UNMASKED_ATTRS = ['title', 'aria-label', 'alt', 'placeholder'] as const
const MARK = '[data-openreplay-obscured]'

interface Scan {
  /** `TAG[attr="value"]` for every attribute value holding a seeded name. */
  attributeLeaks: string[]
  /** Text of every name-carrying text node with NO marked ancestor. */
  unmarkedText: string[]
  /** Text of every name-carrying text node under a marked ancestor. */
  maskedText: string[]
}

/** Walk the whole document — the portal lives under `document.body`, not under the tab. */
function scanForNames(root: HTMLElement): Scan {
  const carries = (value: string | null) =>
    !!value && SEEDED_NAMES.some((name) => value.includes(name))
  const result: Scan = { attributeLeaks: [], unmarkedText: [], maskedText: [] }

  for (const element of Array.from(root.querySelectorAll('*'))) {
    for (const attr of UNMASKED_ATTRS) {
      const value = element.getAttribute(attr)
      if (carries(value)) result.attributeLeaks.push(`${element.tagName}[${attr}="${value}"]`)
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? '').trim()
    if (!carries(text)) continue
    const bucket = node.parentElement?.closest(MARK) ? result.maskedText : result.unmarkedText
    bucket.push(text)
  }
  return result
}

/** Radix DropdownMenuTrigger opens on pointer events; a bare click is flaky in jsdom. */
async function openOperatorList(): Promise<HTMLElement> {
  const trigger = screen.getByTestId('recorded-payments-operators')
  const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true }
  fireEvent.pointerDown(trigger, pointer)
  fireEvent.pointerUp(trigger, pointer)
  fireEvent.click(trigger)
  return screen.findByRole('menu')
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('RecordedPaymentsTab — OpenReplay masking of employees’ names', () => {
  it('speaks the real dictionary, so a name inside a sentence is visible to the scan', async () => {
    // The guard the two assertions below rest on: the sentences that take a
    // name DO contain it here. Under the global key-echo they would not, and
    // an `aria-label={t('…', { name })}` would pass unseen.
    mockGetFeed.mockResolvedValue(RESPONSE)
    renderTab(['/?rpu=101'])
    await screen.findByText('ДГ-12345')

    expect(
      screen.getByRole('button', { name: 'Показати платежі оператора Степченко Олена' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Обіцянки оператора Степченко Олена' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Обіцянки оператора Коваленко Іван' })
    ).toBeInTheDocument()
  })

  it('keeps every name out of the unmasked attributes and under a marked element — table, breakdown and the OPEN multi-select', async () => {
    mockGetFeed.mockResolvedValue(RESPONSE)
    renderTab(['/?rpu=101'])
    await screen.findByText('ДГ-12345')

    // All three surfaces on screen: the table, the breakdown block, and the
    // multi-select with its summary (the selected operator) and its list open.
    const menu = await openOperatorList()
    await waitFor(() => expect(within(menu).getByText('Степченко Олена')).toBeInTheDocument())
    const trigger = screen.getByTestId('recorded-payments-operators')
    expect(within(trigger).getByText('Степченко Олена')).toBeInTheDocument()

    const scan = scanForNames(document.body)

    // 1. Attributes reach the recording verbatim — no name may sit in one.
    expect(scan.attributeLeaks).toEqual([])
    // 2. Every text node with a name has a marked ancestor…
    expect(scan.unmarkedText).toEqual([])
    // …and the scan is not vacuous: the names ARE on the screen, in every
    // surface, including the portal's option row and the trigger's summary.
    expect(scan.maskedText).toEqual(
      expect.arrayContaining([
        'Записенко Іван',
        'Степченко Олена',
        'Коваленко Іван',
        'Договор закрыт',
        'Обіцянки оператора Коваленко Іван',
        'Показати платежі оператора Степченко Олена',
        'Обіцянки оператора Степченко Олена',
        'Показати платежі оператора Договор закрыт',
      ])
    )
    expect(scan.maskedText.length).toBeGreaterThanOrEqual(10)
    expect(within(menu).getByText('Степченко Олена').closest(MARK)).not.toBeNull()
    expect(within(trigger).getByText('Степченко Олена').closest(MARK)).not.toBeNull()
  })
})
