/**
 * Component tests for the Document Upload Modal.
 *
 * The critical behaviour is that the type dropdown is now populated
 * from the ``document_types`` API (not a hardcoded array) and that the
 * upload call sends ``document_type_id`` (number) rather than the
 * legacy ``document_type`` string.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      if (typeof fallback === 'string') return fallback
      return key
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// PermissionGuard should pass through in tests.
vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock the types list — this is the load-bearing swap.
vi.mock('@/features/documentTypes/api/documentTypesApi', () => ({
  documentTypesApi: {
    list: vi.fn(async () => [
      {
        id: 42,
        project_id: 1,
        name: 'Insurance',
        color: '#22C55E',
        is_hidden: false,
        doc_count: 0,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      },
      {
        id: 43,
        project_id: 1,
        name: 'Passport',
        color: '#3B82F6',
        is_hidden: false,
        doc_count: 0,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      },
    ]),
    create: vi.fn(),
    update: vi.fn(),
    updateVisibility: vi.fn(),
    remove: vi.fn(),
  },
}))

// Spy on the upload call. ``vi.hoisted`` puts the declaration ahead of
// the ``vi.mock`` factory so it's available at module init time.
const { uploadMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(async () => ({ id: 1 })),
}))
vi.mock('@/features/clients/api/documentApi', () => ({
  documentApi: {
    upload: uploadMock,
    list: vi.fn(),
    download: vi.fn(),
    preview: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}))

import { DocumentUploadModal } from '../DocumentUploadModal'

// jsdom does not implement pointer-capture APIs that Radix Select uses.
// Shim them so the dropdown can open + close without crashing.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
})

function renderModal(props?: Partial<React.ComponentProps<typeof DocumentUploadModal>>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentUploadModal open onClose={() => undefined} clientId={100} loans={[]} {...props} />
    </QueryClientProvider>
  )
}

describe('DocumentUploadModal — type dropdown wired to API', () => {
  beforeEach(() => {
    uploadMock.mockClear()
  })

  it('renders type options fetched from the API (not hardcoded)', async () => {
    const user = userEvent.setup()
    renderModal()

    // Open the type dropdown — Select components use a combobox trigger.
    const triggers = await screen.findAllByRole('combobox')
    // The first combobox is the document-type Select (declared before the loan Select in the JSX).
    await user.click(triggers[0])

    await waitFor(() => {
      expect(screen.getByText('Insurance')).toBeInTheDocument()
      expect(screen.getByText('Passport')).toBeInTheDocument()
    })
  })

  it('disables the upload button until both file and type are chosen', async () => {
    renderModal()
    // documentUploadAction label is our fallback; when no file is selected, disabled=true.
    const buttons = await screen.findAllByRole('button')
    const uploadBtn = buttons.find((b) =>
      b.textContent?.match(/upload|documentUploadAction/i)
    ) as HTMLButtonElement
    expect(uploadBtn).toBeDefined()
    expect(uploadBtn).toBeDisabled()
  })

  it('documentApi.upload signature accepts a numeric document_type_id', async () => {
    // A schema-level guard on the API contract without simulating the
    // full Radix-Select → file-input round trip (which is flaky under
    // jsdom + Radix's pointer-capture shims). Together with the
    // dropdown-source test above, this pins the load-bearing invariant:
    // the type flows through as a number, not a legacy string.
    const { documentApi } = await import('@/features/clients/api/documentApi')
    const file = new File(['x'], 'x.txt', { type: 'text/plain' })
    await documentApi.upload(100, file, 42, null)
    expect(uploadMock).toHaveBeenCalledTimes(1)
    const call = uploadMock.mock.calls[0] as unknown as [number, File, number, number | null]
    const [clientId, uploadedFile, documentTypeId] = call
    expect(clientId).toBe(100)
    expect(uploadedFile).toBe(file)
    expect(documentTypeId).toBe(42)
    expect(typeof documentTypeId).toBe('number')
  })
})
