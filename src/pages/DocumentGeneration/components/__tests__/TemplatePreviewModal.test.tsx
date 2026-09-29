/**
 * Component tests for the full-screen template preview modal.
 *
 * Focus: the "Template" / "With sample data" segmented switch drives which
 * endpoint is queried, and the download button saves the loaded blob. The
 * The preview is a server-rendered PDF in an iframe; URL.createObjectURL is
 * stubbed for jsdom.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DocumentTemplate } from '@/features/documents'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// jsdom lacks object-URL support for blobs.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

vi.mock('@/features/messaging/utils/downloadBlob', () => ({
  downloadBlob: vi.fn(),
}))

vi.mock('@/features/documents/api/documentTemplatesApi', () => ({
  downloadDocumentTemplateFile: vi.fn(async () => new Blob(['template'])),
  previewDocumentTemplateFile: vi.fn(async () => new Blob(['sample'])),
}))

import * as templatesApi from '@/features/documents/api/documentTemplatesApi'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import { TemplatePreviewModal } from '../TemplatePreviewModal'

function makeDocxTemplate(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 7,
    name: 'Demand letter',
    description: null,
    body: 'Dear client',
    available_variables: [],
    project_id: 1,
    is_active: true,
    times_used: 0,
    last_used_at: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    template_kind: 'docx',
    file_name: 'demand.docx',
    file_size: 2048,
    activation_rule: 'always',
    activation_tag_id: null,
    document_type_id: null,
    auto_generate: false,
    ...overrides,
  }
}

function renderModal(template = makeDocxTemplate(), initialMode?: 'template' | 'sample') {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <TemplatePreviewModal open onClose={onClose} template={template} initialMode={initialMode} />
    </QueryClientProvider>
  )
  return { onClose }
}

describe('TemplatePreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults to the template mode and fetches the raw .docx', async () => {
    renderModal()
    await waitFor(() =>
      expect(templatesApi.downloadDocumentTemplateFile).toHaveBeenCalledWith(7, 'pdf')
    )
    expect(templatesApi.previewDocumentTemplateFile).not.toHaveBeenCalled()
  })

  it('switching to "With sample data" fetches the rendered preview', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(templatesApi.downloadDocumentTemplateFile).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'With sample data' }))

    await waitFor(() =>
      expect(templatesApi.previewDocumentTemplateFile).toHaveBeenCalledWith(7, 'pdf')
    )
  })

  it('honours initialMode=sample by fetching the preview first', async () => {
    renderModal(makeDocxTemplate(), 'sample')
    await waitFor(() =>
      expect(templatesApi.previewDocumentTemplateFile).toHaveBeenCalledWith(7, 'pdf')
    )
    expect(templatesApi.downloadDocumentTemplateFile).not.toHaveBeenCalled()
  })

  it('downloads the loaded blob with the file name', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(templatesApi.downloadDocumentTemplateFile).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Download file' }))

    await waitFor(() => expect(downloadBlob).toHaveBeenCalled())
    const [, filename] = vi.mocked(downloadBlob).mock.calls[0]
    expect(filename).toBe('demand.docx')
  })
})
