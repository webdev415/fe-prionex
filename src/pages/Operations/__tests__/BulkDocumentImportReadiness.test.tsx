/**
 * The bulk upload screen after the type rules landed.
 *
 * Two things changed here and both are easy to regress: nobody picks a
 * document type per upload any more — the project's rules type each file — and
 * the screen refuses to start while a folder still has no default type, which
 * is the same condition the backend enforces. A Start button that looks ready
 * and then fails is worse than one that explains itself, so this pins both.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, options?: Record<string, unknown>) => {
      const text = typeof fallback === 'string' ? fallback : key
      const values = (typeof fallback === 'object' ? fallback : options) as
        | Record<string, unknown>
        | undefined
      if (!values) return text
      return text.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(values[name] ?? ''))
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const readiness = { ready: true, missing_defaults: [] as string[] }

vi.mock('@/features/documentImportRules', () => ({
  useDocumentImportReadiness: () => ({
    data: readiness,
    isLoading: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/features/documentImport', () => ({
  documentImportApi: { abortUpload: vi.fn() },
  useDownloadExampleArchive: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadDocumentArchive: () => ({
    uploadFile: vi.fn(),
    cancelUpload: vi.fn(),
    startImport: vi.fn(),
    uploading: false,
    starting: false,
    progress: 0,
  }),
}))

vi.mock('@/features/factoringAgreements', () => ({
  useFactoringAgreements: () => ({
    data: { items: [{ id: 1, agreement_number: 'FA-1', seller_id: 1 }] },
    isLoading: false,
  }),
}))

vi.mock('@/features/sellers', () => ({
  useSellers: () => ({ data: { sellers: [{ id: 1, seller_name: 'Seller' }] } }),
}))

vi.mock('../components/DocumentImportProgress', () => ({
  DocumentImportProgress: () => null,
}))
vi.mock('../components/BulkJobBanner', () => ({ BulkJobBanner: () => null }))

import { BulkDocumentImportPage } from '../BulkDocumentImportPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkDocumentImportPage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  readiness.ready = true
  readiness.missing_defaults = []
})

describe('BulkDocumentImportPage', () => {
  it('no longer asks for a document type — the rules decide per file', () => {
    renderPage()

    expect(screen.queryByText('Document type')).not.toBeInTheDocument()
    expect(screen.queryByText('Select a document type')).not.toBeInTheDocument()
  })

  it('explains which folder is missing a default instead of failing on Start', () => {
    readiness.ready = false
    readiness.missing_defaults = ['credits']

    renderPage()

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('credits/')
    expect(notice).toHaveTextContent(/Settings/)
  })

  it('keeps Start disabled while the rules are incomplete', () => {
    readiness.ready = false
    readiness.missing_defaults = ['users']

    renderPage()

    expect(screen.getByRole('button', { name: /Start Import/i })).toBeDisabled()
  })

  it('says nothing about rules once both folders have a default', () => {
    renderPage()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
