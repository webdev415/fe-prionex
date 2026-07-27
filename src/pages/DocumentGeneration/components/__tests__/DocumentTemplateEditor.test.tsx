/**
 * Component tests for the Document Template editor modal.
 *
 * Focus: the docx/text kind switcher, the .docx upload path (FormData + the
 * unknown-variables warning), and that the text path forwards `description`.
 * The variable dictionary + API layer are mocked at the api module, so the
 * real hooks + React Query run — mirroring DocumentTypesTab.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DocumentTemplate } from '@/features/documents'

// ---------------------------------------------------------------------------
// i18n mock — returns the key's fallback (arg 2) or the key itself.
// ---------------------------------------------------------------------------
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

// Suppress toast during tests to keep assertions clean.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

// The download helper touches URL.createObjectURL — stub it out.
vi.mock('@/features/messaging/utils/downloadBlob', () => ({
  downloadBlob: vi.fn(),
}))

// The inline "sample data" section shows a server-rendered PDF; jsdom lacks
// object-URL support for blobs.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  // Radix Select relies on pointer-capture APIs jsdom lacks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
})

// ---------------------------------------------------------------------------
// Variable dictionary shared between the api mock and assertions.
// ---------------------------------------------------------------------------
const { VARIABLES } = vi.hoisted(() => ({
  VARIABLES: {
    groups: ['client', 'credit'],
    items: [
      {
        name: 'client_full_name',
        group: 'client',
        labels: { uk: 'Повне імʼя клієнта', en: 'Client full name' },
        sample: 'John A. Smith',
        aliases: [],
      },
      {
        name: 'credit_id',
        group: 'credit',
        labels: { uk: 'ID кредиту', en: 'Credit ID' },
        sample: 'CR-2024-000123',
        aliases: [],
      },
    ],
  },
}))

vi.mock('@/features/documents/api/documentTemplatesApi', () => ({
  listDocumentTemplates: vi.fn(async () => ({ total: 0, items: [] })),
  getDocumentTemplate: vi.fn(async () => ({})),
  createDocumentTemplate: vi.fn(async (payload) => ({ id: 1, ...payload })),
  updateDocumentTemplate: vi.fn(async (id, payload) => ({ id, ...payload })),
  deleteDocumentTemplate: vi.fn(async () => {}),
  uploadDocumentTemplate: vi.fn(async () => ({
    id: 2,
    name: 'Demand letter',
    template_kind: 'docx',
    unknown_variables: [],
  })),
  replaceDocumentTemplateFile: vi.fn(async () => ({ id: 2, unknown_variables: [] })),
  downloadDocumentTemplateFile: vi.fn(async () => new Blob(['x'])),
  previewDocumentTemplateFile: vi.fn(async () => new Blob(['sample'])),
  getDocumentTemplateVariables: vi.fn(async () => VARIABLES),
  getDocumentTemplateTagOptions: vi.fn(async () => [
    { id: 501, name: 'VIP clients', color: '#000000' },
  ]),
}))

import * as templatesApi from '@/features/documents/api/documentTemplatesApi'
import { DocumentTemplateEditor } from '../DocumentTemplateEditor'

function renderEditor(template: DocumentTemplate | null = null) {
  const onClose = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentTemplateEditor open onClose={onClose} template={template} />
    </QueryClientProvider>
  )
  return { onClose }
}

function makeDocxTemplate(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  return {
    id: 2,
    name: 'Demand letter',
    description: 'Legal demand',
    body: 'Dear client, {{client_full_name}}',
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
    activation_rule: 'always',
    activation_tag_id: null,
    document_type_id: null,
    ...overrides,
  }
}

const docxFile = () =>
  new File(['docx-bytes'], 'demand.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

describe('DocumentTemplateEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('create mode: shows the kind switcher and defaults to a text body', async () => {
    renderEditor(null)
    // Both kinds are offered as radios.
    expect(screen.getByRole('radio', { name: /text template/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /\.docx file/i })).toBeInTheDocument()
    // Default is text → the body textarea is present.
    expect(screen.getByLabelText('Template body')).toBeInTheDocument()
  })

  it('text mode: forwards description to the create payload', async () => {
    const user = userEvent.setup()
    const { onClose } = renderEditor(null)

    // NB: userEvent treats `{` specially, so keep the typed body brace-free.
    await user.type(screen.getByLabelText('Template name'), 'Reminder')
    await user.type(screen.getByLabelText('Description'), 'A friendly reminder')
    await user.type(screen.getByLabelText('Template body'), 'Hello world')

    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() => {
      expect(templatesApi.createDocumentTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Reminder',
          description: 'A friendly reminder',
          body: 'Hello world',
        })
      )
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('docx mode: uploads the file as multipart FormData with name', async () => {
    const user = userEvent.setup()
    renderEditor(null)

    await user.click(screen.getByRole('radio', { name: /\.docx file/i }))
    await user.type(screen.getByLabelText('Template name'), 'Demand letter')

    // The dialog content is portaled to document.body, not the render container.
    const input = document.querySelector('#dt-file') as HTMLInputElement
    await user.upload(input, docxFile())

    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() => expect(templatesApi.uploadDocumentTemplate).toHaveBeenCalled())
    const fd = vi.mocked(templatesApi.uploadDocumentTemplate).mock.calls[0][0] as FormData
    expect(fd.get('name')).toBe('Demand letter')
    const sent = fd.get('file') as File
    expect(sent).toBeInstanceOf(File)
    expect(sent.name).toBe('demand.docx')
  })

  it('docx mode: surfaces unknown_variables as a warning and keeps the modal open', async () => {
    vi.mocked(templatesApi.uploadDocumentTemplate).mockResolvedValueOnce({
      id: 3,
      name: 'Demand letter',
      template_kind: 'docx',
      unknown_variables: ['weird_placeholder'],
    } as never)

    const user = userEvent.setup()
    const { onClose } = renderEditor(null)

    await user.click(screen.getByRole('radio', { name: /\.docx file/i }))
    await user.type(screen.getByLabelText('Template name'), 'Demand letter')
    const input = document.querySelector('#dt-file') as HTMLInputElement
    await user.upload(input, docxFile())
    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() =>
      expect(screen.getByText('Variables outside the dictionary')).toBeInTheDocument()
    )
    expect(screen.getByText('{{weird_placeholder}}')).toBeInTheDocument()
    // Terminal warning screen — not auto-closed.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('docx edit mode: no kind switcher, replace-file section present', async () => {
    renderEditor(makeDocxTemplate())
    // Kind switcher is create-only.
    expect(screen.queryByRole('radio', { name: /text template/i })).not.toBeInTheDocument()
    // Replace-file dropzone input exists.
    expect(document.querySelector('#dt-replace-file')).not.toBeNull()
  })

  it('docx edit mode: sample-data section is collapsed until expanded', async () => {
    const user = userEvent.setup()
    renderEditor(makeDocxTemplate())

    // Collapsed by default — no preview request yet.
    expect(templatesApi.previewDocumentTemplateFile).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /show/i }))

    await waitFor(() =>
      expect(templatesApi.previewDocumentTemplateFile).toHaveBeenCalledWith(2, 'pdf')
    )
  })

  it('tag_active rule: requires a tag, then sends activation_tag_id', async () => {
    const user = userEvent.setup()
    renderEditor(null)

    await user.type(screen.getByLabelText('Template name'), 'Tagged')
    await user.type(screen.getByLabelText('Template body'), 'Body text')

    // Switch the activation rule to "Active tag" (first combobox is the rule).
    const combosBefore = screen.getAllByRole('combobox')
    await user.click(combosBefore[0])
    await user.click(await screen.findByRole('option', { name: 'Active tag' }))

    // Submitting without a tag is blocked — create is not called.
    await user.click(screen.getByRole('button', { name: /^Create$/ }))
    expect(templatesApi.createDocumentTemplate).not.toHaveBeenCalled()

    // The tag select now appears (second combobox) — pick a tag and submit.
    const combosAfter = screen.getAllByRole('combobox')
    await user.click(combosAfter[1])
    await user.click(await screen.findByRole('option', { name: 'VIP clients' }))
    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() =>
      expect(templatesApi.createDocumentTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ activation_rule: 'tag_active', activation_tag_id: 501 })
      )
    )
  })
})
