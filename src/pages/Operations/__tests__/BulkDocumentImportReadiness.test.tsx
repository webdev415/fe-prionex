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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

// Mutable so a test can put the hook into any of its three states: answered,
// answered "not ready", or failed. A double that cannot express failure would
// let the failure branch be deleted with every test still green.
const readiness = {
  ready: true,
  missing_defaults: [] as string[],
  failed: false,
  keptAnswer: false,
}
const refetchReadiness = vi.fn()

vi.mock('@/features/documentImportRules', () => ({
  useDocumentImportReadiness: () => ({
    // A first load that failed has no data. A *refetch* that failed keeps the
    // answer it already had, which react-query reports as error + data — both
    // are real states and the page treats them differently.
    data:
      readiness.failed && !readiness.keptAnswer
        ? undefined
        : { ready: readiness.ready, missing_defaults: readiness.missing_defaults },
    isLoading: false,
    isError: readiness.failed,
    refetch: refetchReadiness,
  }),
}))

const uploadFile = vi.fn()
const startImport = vi.fn()

vi.mock('@/features/documentImport', () => ({
  documentImportApi: { abortUpload: vi.fn() },
  useDownloadExampleArchive: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadDocumentArchive: () => ({
    uploadFile,
    cancelUpload: vi.fn(),
    startImport,
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

/** Choose an agreement and stage a ZIP — what Start needs before it can run. */
async function stageAnUpload() {
  // Radix Select opens on pointerdown, not click, and reads the item by role.
  const trigger = screen.getByRole('combobox')
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(await screen.findByRole('option', { name: 'FA-1' }))

  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['zip-bytes'], 'docs.zip', { type: 'application/zip' })
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(() => expect(uploadFile).toHaveBeenCalled())
}

beforeEach(() => {
  vi.clearAllMocks()
  readiness.ready = true
  readiness.missing_defaults = []
  readiness.failed = false
  readiness.keptAnswer = false
  uploadFile.mockResolvedValue({ upload_id: 'upload-1' })
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

describe('BulkDocumentImportPage when the readiness check itself fails', () => {
  it('says the check failed rather than blaming the configuration', () => {
    readiness.failed = true

    renderPage()

    // Not the missing-defaults notice: the page does not know what is missing,
    // and sending the operator to a settings screen they may not be able to
    // open, over defaults that may already be set, is worse than saying so.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/Could not check the bulk-upload rules/i)
  })

  it('offers a retry that re-reads readiness', () => {
    readiness.failed = true

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(refetchReadiness).toHaveBeenCalled()
  })

  it('does not disable Start over a check it could not make', async () => {
    readiness.failed = true

    renderPage()
    await stageAnUpload()

    // The backend refuses with a 409 naming the folders if the rules really
    // are incomplete; a disabled button here would block people whose rules
    // are fine.
    expect(screen.getByRole('button', { name: /Start Import/i })).toBeEnabled()
  })

  it('keeps trusting the answer it already has when a refetch fails', async () => {
    // react-query holds the last good data through a failed refetch. Reading
    // the error alone would swap a correct "credits/ has no default" notice
    // for an alarm, and unblock a Start that answer says is not ready.
    readiness.failed = true
    readiness.keptAnswer = true
    readiness.ready = false
    readiness.missing_defaults = ['credits']

    renderPage()
    await stageAnUpload()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('credits/')
    expect(screen.getByRole('button', { name: /Start Import/i })).toBeDisabled()
  })

  it('re-reads readiness when the backend refuses the start with 409', async () => {
    startImport.mockRejectedValue({ response: { status: 409 } })

    renderPage()
    await stageAnUpload()
    fireEvent.click(screen.getByRole('button', { name: /Start Import/i }))

    await waitFor(() => expect(refetchReadiness).toHaveBeenCalled())
  })
})
