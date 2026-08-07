/**
 * Component tests for the Documents Accordion.
 *
 * Covers the two KAN-403 generation-flow additions:
 *   - documents within a section are ordered newest-first (created_at DESC);
 *   - a "Generated" badge marks rows whose source is 'generated'.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ClientDocument } from '@/features/clients/api/documentApi'

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

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@/features/clients/api/documentApi', () => ({
  documentApi: {
    list: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
    preview: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}))

import { DocumentsAccordion } from '../DocumentsAccordion'

function makeDoc(overrides: Partial<ClientDocument>): ClientDocument {
  return {
    id: 0,
    client_id: 100,
    debt_id: null,
    original_filename: 'file.pdf',
    document_type_id: null,
    document_type_ref: null,
    mime_type: 'application/pdf',
    file_size: 1024,
    source: 'uploaded',
    uploaded_by: 1,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function renderAccordion(documents: ClientDocument[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentsAccordion documents={documents} loans={[]} clientId={100} />
    </QueryClientProvider>
  )
}

describe('DocumentsAccordion', () => {
  it('orders documents within a section newest-first', () => {
    // All unlinked (debt_id null) → the section is expanded by default.
    renderAccordion([
      makeDoc({ id: 1, original_filename: 'alpha.pdf', created_at: '2026-07-01T00:00:00Z' }),
      makeDoc({ id: 2, original_filename: 'bravo.pdf', created_at: '2026-07-03T00:00:00Z' }),
      makeDoc({ id: 3, original_filename: 'charlie.pdf', created_at: '2026-07-02T00:00:00Z' }),
    ])

    const bodyRows = Array.from(document.querySelectorAll('tbody tr'))
    const filenames = bodyRows.map((r) => r.querySelector('td')?.textContent?.trim())
    expect(filenames).toEqual(['bravo.pdf', 'charlie.pdf', 'alpha.pdf'])
  })

  it('renders a "Generated" badge only for generated documents', () => {
    renderAccordion([
      makeDoc({ id: 1, original_filename: 'uploaded.pdf', source: 'uploaded' }),
      makeDoc({ id: 2, original_filename: 'generated.pdf', source: 'generated' }),
    ])

    const badges = screen.getAllByText('Згенеровано')
    expect(badges).toHaveLength(1)

    // The badge sits in the generated row, not the uploaded one.
    const generatedRow = screen.getByText('generated.pdf').closest('tr')
    expect(generatedRow).not.toBeNull()
    expect(generatedRow?.textContent).toContain('Згенеровано')
    const uploadedRow = screen.getByText('uploaded.pdf').closest('tr')
    expect(uploadedRow?.textContent).not.toContain('Згенеровано')
  })
})
