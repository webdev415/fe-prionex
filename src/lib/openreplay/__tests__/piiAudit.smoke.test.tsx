/**
 * KAN-KB-54, step 7.4 — the runtime detector, run against real components in
 * jsdom.
 *
 * 🔴 WHY THIS EXISTS ALONGSIDE `scripts/pii-audit.mjs`. The static audit reads
 * the SOURCE: it catches a new render site the moment it is committed, and it
 * cannot see a single thing about the rendered DOM. This one reads the DOM: it
 * catches a block moved OUT of a marked container, a wrapper that drops
 * `...rest`, a portal. Neither substitutes for the other — the first cannot see
 * the runtime, the second cannot see what did not render.
 *
 * Values are passed in explicitly rather than harvested from the API, and that
 * is not a shortcut: the suite mocks the API with `vi.fn` (there is no msw in
 * the dependencies), so no response ever reaches the interceptor and the
 * harvested set would be empty. A test built on it would pass by finding
 * nothing to look for — which is why `__piiAudit` takes an argument at all.
 *
 * ⚠️ What this can NOT be: "the same list the browser gives". There is nothing
 * to compare against, and a divergence can be legitimate — the tracker keeps
 * `obscured` in a `Set` and does not drop a node that was moved out of a marked
 * container until the page reloads.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { findUnobscured } from '../piiAudit.dev'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FieldGrid } from '@/pages/EmployeeCard/components/FieldGrid'
import { PiiTooltip } from '@/components/ui/PiiTooltip'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const NAME = 'Іваненко Іван Іванович'
const ADDRESS = 'м. Київ, вул. Хрещатик, 1'
const COMMENT = 'Обіцяв оплатити до кінця тижня, просив не дзвонити вранці'

/** Everything a fixture client would put on screen. */
const VALUES = [NAME, ADDRESS, COMMENT]

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('the detector itself is not vacuous', () => {
  it('reports an unmarked render, so an empty result means something', () => {
    // Without this the three tests below would pass on a detector that always
    // returns `[]`, which is the failure mode of every coverage check.
    renderWithProviders(
      <div>
        <p>{NAME}</p>
        <p>{ADDRESS}</p>
      </div>
    )
    expect(findUnobscured(VALUES)).toHaveLength(2)
  })
})

describe('the shared primitives leave nothing readable', () => {
  it('DataTable, for the columns that declare themselves obscured', () => {
    interface Row {
      id: number
      fullName: string
      address: string
      status: string
    }
    const columns: Column<Row>[] = [
      { key: 'fullName', header: 'ФИО', render: (r) => r.fullName, obscured: true },
      { key: 'address', header: 'Адрес', render: (r) => r.address, obscured: true },
      { key: 'status', header: 'Статус', render: (r) => r.status },
    ]
    renderWithProviders(
      <DataTable
        columns={columns}
        data={[{ id: 1, fullName: NAME, address: ADDRESS, status: 'В работе' }]}
      />
    )
    expect(findUnobscured(VALUES)).toEqual([])
    // …and the column that did not ask for it is still readable, which is the
    // half a "mask everything" implementation would also pass.
    expect(screen.getByText('В работе')).toBeInTheDocument()
    expect(findUnobscured(['В работе'])).toHaveLength(1)
  })

  it('FieldGrid, for the fields that declare themselves obscured', () => {
    renderWithProviders(
      <FieldGrid
        fields={[
          { label: 'ФИО', value: NAME, obscured: true },
          { label: 'Адрес', value: ADDRESS, obscured: true },
          { label: 'Комментарий', value: COMMENT, obscured: true },
        ]}
      />
    )
    expect(findUnobscured(VALUES)).toEqual([])
  })

  it('PiiTooltip, whose whole point is that the value left the attribute', () => {
    renderWithProviders(
      <PiiTooltip label={NAME}>
        <button type="button">#1024</button>
      </PiiTooltip>
    )
    // Closed, the name is nowhere — neither as text nor, crucially, as a
    // `title` the tracker would have sent verbatim.
    expect(findUnobscured(VALUES)).toEqual([])
    expect(document.body.innerHTML).not.toContain(NAME)
  })
})

describe('the detector still sees what the markup misses', () => {
  it('reports a value that escaped its marked container', () => {
    // 🔴 The case the STATIC audit cannot reach. The source here is perfectly
    // correct — a marked card, a name inside it — and the DOM is not, because
    // the name was rendered as a sibling. Only a runtime pass can tell them
    // apart, and this is why both halves of the barrier exist.
    const columns: Column<{ id: number; fullName: string }>[] = [
      { key: 'fullName', header: 'ФИО', render: (r) => r.fullName, obscured: true },
    ]
    renderWithProviders(
      <div>
        <DataTable columns={columns} data={[{ id: 1, fullName: NAME }]} />
        {/* The same name, rendered outside the table by a "small" refactor. */}
        <footer>{NAME}</footer>
      </div>
    )
    const findings = findUnobscured([NAME])
    expect(findings).toHaveLength(1)
    expect(findings[0].element.tagName).toBe('FOOTER')
  })
})
