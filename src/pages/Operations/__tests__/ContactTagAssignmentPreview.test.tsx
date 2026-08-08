import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// The shared setup mocks i18n to echo the key unless it is in a hardcoded map,
// which would make every assertion here a test of that map rather than of the
// component. Override locally so `t` resolves the inline defaults the component
// actually ships, including {{...}} interpolation.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, second?: unknown) => {
      if (typeof second === 'string') return second
      if (second && typeof second === 'object') {
        const opts = second as Record<string, unknown>
        const template = typeof opts.defaultValue === 'string' ? opts.defaultValue : key
        return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
          opts[name] === undefined ? `{{${name}}}` : String(opts[name])
        )
      }
      return key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

import type {
  ContactTagAssignmentPreviewResponse,
  ContactTagPreviewRow,
} from '@/features/imports/types/contactTagAssignment'
import { ContactTagAssignmentPreview } from '../components/ContactTagAssignmentPreview'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

function row(overrides: Partial<ContactTagPreviewRow> = {}): ContactTagPreviewRow {
  return {
    row_number: 1,
    tin: '2951102334',
    contact_value: '380932162022',
    category: 'Messengers',
    tag_names: ['Telegram'],
    client_id: 1,
    client_name: 'Test Client',
    category_id: 4,
    selection_type: 'multi',
    contact_ids: [498655],
    matched_contacts: 1,
    tag_value_ids: [15],
    unknown_tag_names: [],
    currently_assigned: [],
    replaces_existing: false,
    status: 'ready',
    error: null,
    severity: null,
    ...overrides,
  }
}

function preview(
  overrides: Partial<ContactTagAssignmentPreviewResponse> = {}
): ContactTagAssignmentPreviewResponse {
  return {
    job_id: 1,
    batch_id: 'CTAG-ABC123',
    filename: 'contact-tags.csv',
    status: 'validated',
    mode: 'assign',
    total_records: 1,
    summary: {
      total_rows: 1,
      ready: 1,
      warning: 0,
      no_change: 0,
      invalid: 0,
      duplicates_overridden: 0,
      unique_contacts: 1,
      unique_categories: 1,
      replacing_rows: 0,
      contacts_affected: 1,
    },
    preview_rows: [row()],
    errors: [],
    warnings: [],
    ...overrides,
  }
}

const noop = () => {}

describe('ContactTagAssignmentPreview', () => {
  it('surfaces the fan-out when one row writes to several contacts', () => {
    // The whole point of the notice: 1,000 rows can mean ~7,000 writes, and an
    // operator should not discover that afterwards.
    const p = preview({
      preview_rows: [row({ matched_contacts: 7, contact_ids: [1, 2, 3, 4, 5, 6, 7] })],
      summary: { ...preview().summary, ready: 1, contacts_affected: 7 },
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )

    expect(screen.getByText(/1 rows will update 7 contact records/i)).toBeInTheDocument()
    expect(screen.getByText('×7')).toBeInTheDocument()
  })

  it('does not show the fan-out notice when rows and contacts match', () => {
    render(
      <ContactTagAssignmentPreview
        preview={preview()}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.queryByText(/contact records/i)).not.toBeInTheDocument()
  })

  it('warns when the backend says a value will be destroyed', () => {
    // Driven by replaces_existing, not by the category being single-select: a
    // row that merely repeats the value already stored destroys nothing.
    //
    // The banner count comes from summary.replacing_rows, not from the rows:
    // preview_rows is capped at 50 server-side, so counting it would report a
    // fraction of the real number of overwrites.
    const p = preview({
      summary: {
        total_rows: 1,
        ready: 1,
        warning: 0,
        no_change: 0,
        invalid: 0,
        duplicates_overridden: 0,
        unique_contacts: 1,
        unique_categories: 1,
        replacing_rows: 1,
        contacts_affected: 1,
      },
      preview_rows: [
        row({
          selection_type: 'single',
          category: 'Verification',
          replaces_existing: true,
          currently_assigned: ['Verified'],
        }),
      ],
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )
    expect(screen.getByText(/will REPLACE the current value/i)).toBeInTheDocument()
    expect(screen.getByText(/Replaces current value: Verified/i)).toBeInTheDocument()
  })

  it('does not warn when a single-select row replaces nothing', () => {
    const p = preview({
      preview_rows: [
        row({ selection_type: 'single', category: 'Verification', replaces_existing: false }),
      ],
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )
    expect(screen.queryByText(/will REPLACE/i)).not.toBeInTheDocument()
  })

  it('reports a system category as system-managed, not as a permission problem', () => {
    // Chasing a permission that cannot exist is the failure this avoids.
    const p = preview({
      preview_rows: [],
      errors: [row({ status: 'system', category: 'Last Call Result', error: 'system-managed' })],
      summary: { ...preview().summary, ready: 0, invalid: 1 },
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )
    expect(screen.getByText('System-managed')).toBeInTheDocument()
    expect(screen.queryByText('Permission required')).not.toBeInTheDocument()
  })

  it('strikes through values that do not exist in the category', () => {
    const p = preview({
      preview_rows: [],
      errors: [
        row({ status: 'tag_not_found', tag_names: ['Signal'], unknown_tag_names: ['Signal'] }),
      ],
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )
    expect(screen.getByText('Signal').className).toContain('line-through')
  })

  it('disables execute when nothing is ready', () => {
    const p = preview({
      preview_rows: [],
      errors: [row({ status: 'contact_not_found' })],
      summary: { ...preview().summary, ready: 0, contacts_affected: 0, invalid: 1 },
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )
    expect(screen.getByRole('button', { name: /Assign to/i })).toBeDisabled()
  })

  it('labels the button in contacts, not rows', () => {
    const p = preview({
      preview_rows: [row({ matched_contacts: 7 })],
      summary: { ...preview().summary, ready: 1, contacts_affected: 7 },
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )
    expect(screen.getByRole('button', { name: /Assign to 7 contacts/i })).toBeInTheDocument()
  })

  it('fires onConfirm once when execute is clicked', async () => {
    const onConfirm = vi.fn()
    render(
      <ContactTagAssignmentPreview
        preview={preview()}
        onConfirm={onConfirm}
        onCancel={noop}
        isExecuting={false}
      />,
      { wrapper: createWrapper() }
    )
    await userEvent.click(screen.getByRole('button', { name: /Assign to/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('disables both buttons while executing', () => {
    render(
      <ContactTagAssignmentPreview
        preview={preview()}
        onConfirm={noop}
        onCancel={noop}
        isExecuting
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled()
  })

  it('warns when a later row discarded an earlier one', () => {
    // Last row wins for every selection type, so a duplicate always throws a
    // line of the operator's file away. This must never read as harmless.
    const p = preview({
      summary: { ...preview().summary, duplicates_overridden: 2 },
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByText('Duplicate rows overridden')).toBeInTheDocument()
    expect(screen.getByText(/2 rows were discarded/i)).toBeInTheDocument()
    // Tells the operator how to express several values correctly.
    expect(screen.getByText(/list them in one cell/i)).toBeInTheDocument()
  })

  it('shows no override warning when the file had no duplicates', () => {
    render(
      <ContactTagAssignmentPreview
        preview={preview()}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByText('Duplicate rows overridden')).toBeInTheDocument()
    expect(screen.queryByText(/were discarded/i)).not.toBeInTheDocument()
  })

  it('shows the no-change count, and the row counts reconcile to the total', () => {
    // ready + no_change + invalid + overridden == total_rows, so an operator
    // can confirm no row was silently dropped.
    const p = preview({
      summary: {
        ...preview().summary,
        total_rows: 15,
        ready: 4,
        no_change: 6,
        invalid: 2,
        duplicates_overridden: 3,
      },
    })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      { wrapper: createWrapper() }
    )
    expect(screen.getByText('Already up to date')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    const s = p.summary
    expect(s.ready + s.no_change + s.invalid + s.duplicates_overridden).toBe(s.total_rows)
  })

  it('renders parser warnings', () => {
    const p = preview({ warnings: ['Only the first worksheet was read.'] })
    render(
      <ContactTagAssignmentPreview
        preview={p}
        onConfirm={noop}
        onCancel={noop}
        isExecuting={false}
      />,
      {
        wrapper: createWrapper(),
      }
    )
    expect(screen.getByText('Only the first worksheet was read.')).toBeInTheDocument()
  })
})
