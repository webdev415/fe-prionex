/**
 * Component tests for the Document Templates tab.
 *
 * Focus: the docx/text kind badge, the docx file name, and the per-row
 * download action (which streams the .docx via the api + downloadBlob helper).
 * Edit/delete affordances are permission-gated and covered elsewhere; here the
 * auth store is empty, so only the always-on badge + download are asserted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DocumentTemplate } from '@/features/documents'

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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/features/messaging/utils/downloadBlob', () => ({
  downloadBlob: vi.fn(),
}))

// DocxRenderer lazy-imports docx-preview when the preview modal opens.
vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(async () => {}),
}))

const { ROWS } = vi.hoisted(() => ({
  ROWS: [
    {
      id: 1,
      name: 'Demand letter',
      description: 'Legal demand',
      body: 'extracted text',
      available_variables: [{ name: 'client_full_name', required: false }],
      project_id: 1,
      is_active: true,
      times_used: 0,
      last_used_at: null,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      template_kind: 'docx',
      file_name: 'demand.docx',
      file_size: 2048,
      activation_rule: 'active_debt',
      document_type_id: null,
    },
    {
      id: 2,
      name: 'SMS reminder',
      description: null,
      body: 'Hello',
      available_variables: [],
      project_id: 1,
      is_active: true,
      times_used: 0,
      last_used_at: null,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      template_kind: 'text',
      file_name: null,
      file_size: null,
      activation_rule: 'always',
      document_type_id: null,
    },
  ] as DocumentTemplate[],
}))

vi.mock('@/features/documents/api/documentTemplatesApi', () => ({
  listDocumentTemplates: vi.fn(async () => ({ total: ROWS.length, items: ROWS })),
  getDocumentTemplate: vi.fn(async () => ROWS[0]),
  createDocumentTemplate: vi.fn(),
  updateDocumentTemplate: vi.fn(),
  deleteDocumentTemplate: vi.fn(),
  uploadDocumentTemplate: vi.fn(),
  replaceDocumentTemplateFile: vi.fn(),
  downloadDocumentTemplateFile: vi.fn(async () => new Blob(['docx'])),
  previewDocumentTemplateFile: vi.fn(async () => new Blob(['sample'])),
  getDocumentTemplateVariables: vi.fn(async () => ({ groups: [], items: [] })),
}))

import * as templatesApi from '@/features/documents/api/documentTemplatesApi'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import { DocumentTemplatesTab } from '../DocumentTemplatesTab'

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentTemplatesTab />
    </QueryClientProvider>
  )
}

describe('DocumentTemplatesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a kind badge and file name for docx templates', async () => {
    renderTab()
    await waitFor(() => expect(screen.getByText('Demand letter')).toBeInTheDocument())
    expect(screen.getByText('.docx file')).toBeInTheDocument()
    expect(screen.getByText('Text template')).toBeInTheDocument()
    expect(screen.getByText('demand.docx')).toBeInTheDocument()
  })

  it('downloads the .docx via the api and the downloadBlob helper', async () => {
    const user = userEvent.setup()
    renderTab()
    await waitFor(() => expect(screen.getByText('Demand letter')).toBeInTheDocument())

    // Download action is only present on docx rows.
    const downloadBtn = screen.getByTitle('Download file')
    await user.click(downloadBtn)

    await waitFor(() => expect(templatesApi.downloadDocumentTemplateFile).toHaveBeenCalledWith(1))
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled())
    const [, filename] = vi.mocked(downloadBlob).mock.calls[0]
    expect(filename).toBe('demand.docx')
  })

  it('shows only one download action (docx row only, not the text row)', async () => {
    renderTab()
    await waitFor(() => expect(screen.getByText('Demand letter')).toBeInTheDocument())
    expect(screen.getAllByTitle('Download file')).toHaveLength(1)
  })

  it('shows a Preview action only on docx rows', async () => {
    renderTab()
    await waitFor(() => expect(screen.getByText('Demand letter')).toBeInTheDocument())
    // Only the docx row (Demand letter) gets a preview eye; the text row does not.
    expect(screen.getAllByTitle('Preview')).toHaveLength(1)
  })

  it('opens the preview modal from the docx row', async () => {
    const user = userEvent.setup()
    renderTab()
    await waitFor(() => expect(screen.getByText('Demand letter')).toBeInTheDocument())

    await user.click(screen.getByTitle('Preview'))

    // The modal exposes the mode switch; default mode fetches the server PDF.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'With sample data' })).toBeInTheDocument()
    )
    await waitFor(() =>
      expect(templatesApi.downloadDocumentTemplateFile).toHaveBeenCalledWith(1, 'pdf')
    )
  })
})
