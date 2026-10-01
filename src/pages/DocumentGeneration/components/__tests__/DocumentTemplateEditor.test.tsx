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
  composeDocumentTemplate: vi.fn(async () => ({
    id: 4,
    name: 'Branded letter',
    template_kind: 'docx',
    unknown_variables: [],
  })),
  downloadDocumentTemplateFile: vi.fn(async () => new Blob(['x'])),
  previewDocumentTemplateFile: vi.fn(async () => new Blob(['sample'])),
  getDocumentTemplateVariables: vi.fn(async () => VARIABLES),
  getDocumentTemplateTagOptions: vi.fn(async () => [
    { id: 501, name: 'VIP clients', color: '#000000' },
  ]),
}))

// One document type, so a new .docx template can be armed for auto-generation.
vi.mock('@/features/documentTypes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/documentTypes')>()),
  useDocumentTypes: () => ({ data: [{ id: 7, name: 'Closure note type', color: '#336699' }] }),
}))

import * as templatesApi from '@/features/documents/api/documentTemplatesApi'
import { isTemplateSaleType, templateSaleTypeOf } from '@/features/documents/saleType'
import { toast } from 'sonner'
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
    auto_generate: false,
    ...overrides,
  }
}

const docxFile = () =>
  new File(['docx-bytes'], 'demand.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

/** Select triggers carry stable ids — indexes shift whenever a Select is added. */
const selectTrigger = (id: string): HTMLElement => {
  const trigger = document.querySelector<HTMLElement>(`#${id}`)
  if (!trigger) throw new Error(`Select trigger #${id} is not rendered`)
  return trigger
}

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

    // Switch the activation rule to "Active tag".
    await user.click(selectTrigger('dt-activation-rule'))
    await user.click(await screen.findByRole('option', { name: 'Active tag' }))

    // Submitting without a tag is blocked — create is not called.
    await user.click(screen.getByRole('button', { name: /^Create$/ }))
    expect(templatesApi.createDocumentTemplate).not.toHaveBeenCalled()

    // The tag select now appears — pick a tag and submit.
    await user.click(selectTrigger('dt-activation-tag'))
    await user.click(await screen.findByRole('option', { name: 'VIP clients' }))
    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() =>
      expect(templatesApi.createDocumentTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ activation_rule: 'tag_active', activation_tag_id: 501 })
      )
    )
  })
})

describe('DocumentTemplateEditor — generate automatically', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const autoGenerateBox = () => screen.queryByRole('checkbox', { name: 'Generate automatically' })
  const closedLoanDocx = (overrides: Partial<DocumentTemplate> = {}) =>
    makeDocxTemplate({ activation_rule: 'closed_debt', document_type_id: 7, ...overrides })

  it('is offered for a closed-loan template, but never for a text one', async () => {
    const user = userEvent.setup()
    renderEditor(null)

    // Text template on the closed-loan rule: text templates are never generated.
    await user.click(selectTrigger('dt-activation-rule'))
    await user.click(await screen.findByRole('option', { name: 'Closed debt' }))
    expect(autoGenerateBox()).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /\.docx file/i }))
    expect(autoGenerateBox()).toBeInTheDocument()
  })

  it('is not offered on any other rule', () => {
    renderEditor(makeDocxTemplate({ activation_rule: 'active_debt' }))
    expect(autoGenerateBox()).not.toBeInTheDocument()
  })

  it('shows the saved state in edit mode', () => {
    renderEditor(closedLoanDocx({ auto_generate: true }))
    expect(autoGenerateBox()).toBeChecked()
  })

  it('sends auto_generate when ticked', async () => {
    const user = userEvent.setup()
    renderEditor(closedLoanDocx())

    await user.click(autoGenerateBox()!)
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() =>
      expect(templatesApi.updateDocumentTemplate).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ activation_rule: 'closed_debt', auto_generate: true })
      )
    )
  })

  it('cannot be saved without a document type', async () => {
    const user = userEvent.setup()
    renderEditor(closedLoanDocx({ document_type_id: null }))

    await user.click(autoGenerateBox()!)
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    expect(templatesApi.updateDocumentTemplate).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Select a document type to generate automatically')
  })

  it('moving the rule away switches it off on save', async () => {
    const user = userEvent.setup()
    renderEditor(closedLoanDocx({ auto_generate: true }))

    await user.click(selectTrigger('dt-activation-rule'))
    await user.click(await screen.findByRole('option', { name: 'Active debt' }))
    expect(autoGenerateBox()).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() =>
      expect(templatesApi.updateDocumentTemplate).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ activation_rule: 'active_debt', auto_generate: false })
      )
    )
  })

  it('a .docx upload leaves the flag out when it is off', async () => {
    const user = userEvent.setup()
    renderEditor(null)

    await user.click(screen.getByRole('radio', { name: /\.docx file/i }))
    await user.type(screen.getByLabelText('Template name'), 'Closure note')
    await user.upload(document.querySelector('#dt-file') as HTMLInputElement, docxFile())
    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() => expect(templatesApi.uploadDocumentTemplate).toHaveBeenCalled())
    const fd = vi.mocked(templatesApi.uploadDocumentTemplate).mock.calls[0][0] as FormData
    // Upload only creates, so an absent field is the off state -- no 'false'
    // string for the server to parse.
    expect(fd.has('auto_generate')).toBe(false)
  })

  it('a .docx upload sends the flag as true when it is ticked', async () => {
    const user = userEvent.setup()
    renderEditor(null)

    await user.click(selectTrigger('dt-activation-rule'))
    await user.click(await screen.findByRole('option', { name: 'Closed debt' }))
    await user.click(screen.getByRole('radio', { name: /\.docx file/i }))
    await user.click(document.querySelector('#dt-doc-type') as HTMLElement)
    await user.click(await screen.findByRole('option', { name: 'Closure note type' }))
    await user.click(autoGenerateBox()!)
    await user.type(screen.getByLabelText('Template name'), 'Closure note')
    await user.upload(document.querySelector('#dt-file') as HTMLInputElement, docxFile())
    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() => expect(templatesApi.uploadDocumentTemplate).toHaveBeenCalled())
    const fd = vi.mocked(templatesApi.uploadDocumentTemplate).mock.calls[0][0] as FormData
    expect(fd.get('auto_generate')).toBe('true')
    expect(fd.get('activation_rule')).toBe('closed_debt')
    expect(fd.get('document_type_id')).toBe('7')
  })
})

describe('DocumentTemplateEditor — contract type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  type CreatePath = 'text' | 'docx' | 'compose'
  type EditKind = 'text' | 'docx'

  const saleTypeTrigger = () => selectTrigger('dt-sale-type')

  const pickSaleType = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
    await user.click(saleTypeTrigger())
    await user.click(await screen.findByRole('option', { name: label }))
  }

  /** Fill the minimum a create path needs to reach the server. */
  const fillCreate = async (user: ReturnType<typeof userEvent.setup>, path: CreatePath) => {
    if (path === 'docx') await user.click(screen.getByRole('radio', { name: /\.docx file/i }))
    if (path === 'compose') await user.click(screen.getByRole('radio', { name: 'Фірмовий бланк' }))
    await user.type(screen.getByLabelText('Template name'), 'Letter')
    if (path === 'docx') {
      await user.upload(document.querySelector('#dt-file') as HTMLInputElement, docxFile())
    } else {
      if (path === 'compose') await user.type(screen.getByLabelText('Заголовок документа'), 'Title')
      await user.type(screen.getByLabelText('Template body'), 'Body text')
    }
  }

  /** The `sale_type` a create path sent — JSON field or FormData entry. */
  const sentOnCreate = async (path: CreatePath): Promise<unknown> => {
    if (path === 'docx') {
      await waitFor(() => expect(templatesApi.uploadDocumentTemplate).toHaveBeenCalled())
      const fd = vi.mocked(templatesApi.uploadDocumentTemplate).mock.calls[0][0] as FormData
      return fd.get('sale_type')
    }
    if (path === 'compose') {
      await waitFor(() => expect(templatesApi.composeDocumentTemplate).toHaveBeenCalled())
      return vi.mocked(templatesApi.composeDocumentTemplate).mock.calls[0][0].sale_type
    }
    await waitFor(() => expect(templatesApi.createDocumentTemplate).toHaveBeenCalled())
    return vi.mocked(templatesApi.createDocumentTemplate).mock.calls[0][0].sale_type
  }

  const editTemplate = (kind: EditKind, overrides: Partial<DocumentTemplate> = {}) =>
    kind === 'docx'
      ? makeDocxTemplate(overrides)
      : makeDocxTemplate({ template_kind: 'text', file_name: null, file_size: null, ...overrides })

  /** Save an edit and return the PUT payload. */
  const savedPayload = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    await waitFor(() => expect(templatesApi.updateDocumentTemplate).toHaveBeenCalled())
    const [id, payload] = vi.mocked(templatesApi.updateDocumentTemplate).mock.calls[0]
    expect(id).toBe(2)
    return payload
  }

  it('sits between the description and the activation rule, defaulting to All', async () => {
    const user = userEvent.setup()
    renderEditor(null)

    const saleType = screen.getByRole('combobox', { name: 'Contract type' })
    expect(saleType).toBe(saleTypeTrigger())
    expect(saleType).toHaveTextContent('All')

    const description = screen.getByLabelText('Description')
    const rule = selectTrigger('dt-activation-rule')
    const follows = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(description, saleType)).toBe(true)
    expect(follows(saleType, rule)).toBe(true)

    // A single choice out of exactly three types.
    await user.click(saleType)
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['All', 'Factoring', 'Cession'])
  })

  it.each<{ path: CreatePath; pick?: string; sent: string }>([
    { path: 'text', sent: 'all' },
    { path: 'docx', sent: 'all' },
    { path: 'compose', sent: 'all' },
    { path: 'text', pick: 'Cession', sent: 'cession' },
    { path: 'docx', pick: 'Cession', sent: 'cession' },
    { path: 'compose', pick: 'Cession', sent: 'cession' },
    { path: 'text', pick: 'Factoring', sent: 'factoring' },
    { path: 'docx', pick: 'Factoring', sent: 'factoring' },
    { path: 'compose', pick: 'Factoring', sent: 'factoring' },
  ])('$path create sends sale_type $sent', async ({ path, pick, sent }) => {
    const user = userEvent.setup()
    renderEditor(null)

    await fillCreate(user, path)
    if (pick) await pickSaleType(user, pick)
    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    expect(await sentOnCreate(path)).toBe(sent)
  })

  it.each<{ kind: EditKind; stored: string; label: string }>([
    { kind: 'text', stored: 'factoring', label: 'Factoring' },
    { kind: 'docx', stored: 'factoring', label: 'Factoring' },
    { kind: 'text', stored: 'cession', label: 'Cession' },
    { kind: 'docx', stored: 'cession', label: 'Cession' },
  ])(
    '$kind edit shows the saved $stored and sends it unchanged',
    async ({ kind, stored, label }) => {
      const user = userEvent.setup()
      renderEditor(editTemplate(kind, { sale_type: stored }))

      expect(saleTypeTrigger()).toHaveTextContent(label)
      expect((await savedPayload(user)).sale_type).toBe(stored)
    }
  )

  it.each<{ kind: EditKind; pick: string; sent: string }>([
    { kind: 'text', pick: 'Cession', sent: 'cession' },
    { kind: 'docx', pick: 'Cession', sent: 'cession' },
    { kind: 'text', pick: 'All', sent: 'all' },
    { kind: 'docx', pick: 'All', sent: 'all' },
  ])('$kind edit from factoring sends $sent after picking it', async ({ kind, pick, sent }) => {
    const user = userEvent.setup()
    renderEditor(editTemplate(kind, { sale_type: 'factoring' }))

    await pickSaleType(user, pick)
    expect(saleTypeTrigger()).toHaveTextContent(pick)
    expect((await savedPayload(user)).sale_type).toBe(sent)
  })

  it.each<{ kind: EditKind; stored: undefined | null }>([
    { kind: 'text', stored: undefined },
    { kind: 'docx', stored: undefined },
    { kind: 'text', stored: null },
    { kind: 'docx', stored: null },
  ])(
    '$kind edit of a template with sale_type $stored reads and sends all',
    async ({ kind, stored }) => {
      const user = userEvent.setup()
      const template = editTemplate(kind)
      // An older server leaves the field out; null is treated the same way.
      if (stored === null) Object.assign(template, { sale_type: null })
      expect('sale_type' in template).toBe(stored === null)
      renderEditor(template)

      expect(saleTypeTrigger()).toHaveTextContent('All')
      expect((await savedPayload(user)).sale_type).toBe('all')
    }
  )

  it.each<EditKind>(['text', 'docx'])(
    '%s edit of an unknown stored value shows All but leaves it out of the update',
    async (kind) => {
      const user = userEvent.setup()
      renderEditor(editTemplate(kind, { sale_type: 'x' }))

      expect(saleTypeTrigger()).toHaveTextContent('All')
      expect(await savedPayload(user)).not.toHaveProperty('sale_type')
    }
  )

  it.each<{ kind: EditKind; pick: string; sent: string }>([
    { kind: 'text', pick: 'Cession', sent: 'cession' },
    { kind: 'docx', pick: 'Cession', sent: 'cession' },
    // "All" is what the Select already shows — picking it still overwrites.
    { kind: 'text', pick: 'All', sent: 'all' },
    { kind: 'docx', pick: 'All', sent: 'all' },
  ])(
    '$kind edit of an unknown stored value sends $sent once the operator picks it',
    async ({ kind, pick, sent }) => {
      const user = userEvent.setup()
      renderEditor(editTemplate(kind, { sale_type: 'x' }))

      await pickSaleType(user, pick)
      expect(saleTypeTrigger()).toHaveTextContent(pick)
      expect((await savedPayload(user)).sale_type).toBe(sent)
    }
  )

  it('changing the type leaves the other fields of a closed-loan template as they were', async () => {
    const user = userEvent.setup()
    renderEditor(
      editTemplate('docx', {
        activation_rule: 'closed_debt',
        document_type_id: 7,
        auto_generate: true,
        sale_type: 'factoring',
      })
    )

    await pickSaleType(user, 'Cession')
    expect(await savedPayload(user)).toEqual({
      name: 'Demand letter',
      description: 'Legal demand',
      is_active: true,
      activation_rule: 'closed_debt',
      activation_tag_id: null,
      document_type_id: 7,
      auto_generate: true,
      sale_type: 'cession',
    })
  })

  it('changing the type leaves the activation tag of a tagged template as it was', async () => {
    const user = userEvent.setup()
    renderEditor(
      editTemplate('docx', {
        activation_rule: 'tag_active',
        activation_tag_id: 501,
        sale_type: 'factoring',
      })
    )

    await pickSaleType(user, 'Cession')
    expect(await savedPayload(user)).toEqual({
      name: 'Demand letter',
      description: 'Legal demand',
      is_active: true,
      activation_rule: 'tag_active',
      activation_tag_id: 501,
      document_type_id: null,
      auto_generate: false,
      sale_type: 'cession',
    })
  })

  it('reads missing and unknown server values as all, knowing only the listed types', () => {
    expect(templateSaleTypeOf('factoring')).toBe('factoring')
    expect(templateSaleTypeOf('cession')).toBe('cession')
    expect(templateSaleTypeOf('all')).toBe('all')
    expect(templateSaleTypeOf(undefined)).toBe('all')
    expect(templateSaleTypeOf(null)).toBe('all')
    expect(templateSaleTypeOf('x')).toBe('all')
    expect(templateSaleTypeOf('Factoring')).toBe('all')
    expect(isTemplateSaleType('cession')).toBe(true)
    expect(isTemplateSaleType('')).toBe(false)
    expect(isTemplateSaleType('x')).toBe(false)
  })
})
