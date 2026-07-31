import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { RecommendersTab, type RecommenderContact } from '../RecommendersTab'
import type { ContactTypeOption } from '@/features/clients/api/types'

vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: () => true,
  useHasAnyPermission: () => true,
}))

vi.mock('@/features/contactTags/hooks/useContactTags', () => ({
  useContactTags: () => ({ data: [], isLoading: false }),
  useSetContactTags: () => ({ mutateAsync: vi.fn() }),
}))

const phoneType: ContactTypeOption = {
  id: 29,
  code: 'register_mobile_phone',
  name: 'Mobile phone from registers',
  is_phone: true,
  sort_order: 5,
  default_call_line: 'white',
  spam_allowed: true,
  show_as_primary_phone: true,
  show_in_client_detail: true,
  is_hidden: false,
  contact_source: 'client',
  color: '#80D80A',
}

const thirdPartyType: ContactTypeOption = {
  id: 7,
  code: 'third_party_mobile_phone',
  name: 'Third party mobile phone',
  is_phone: true,
  sort_order: 30,
  default_call_line: 'gray',
  spam_allowed: true,
  show_as_primary_phone: false,
  show_in_client_detail: true,
  is_hidden: false,
  contact_source: 'recommender',
  color: '#80D80A',
}

const emailType: ContactTypeOption = {
  id: 3,
  code: 'email_personal',
  name: 'Personal email',
  is_phone: false,
  sort_order: 10,
  default_call_line: 'white',
  spam_allowed: false,
  show_as_primary_phone: false,
  show_in_client_detail: true,
  is_hidden: false,
  contact_source: 'client',
  color: '#80D80A',
}

const otherType: ContactTypeOption = {
  id: 55,
  code: 'address_home',
  name: 'Home address',
  is_phone: false,
  sort_order: 20,
  default_call_line: 'white',
  spam_allowed: false,
  show_as_primary_phone: false,
  show_in_client_detail: true,
  is_hidden: false,
  contact_source: 'other',
  color: '#80D80A',
}

const contactTypesById = new Map<number, ContactTypeOption>([
  [29, phoneType],
  [7, thirdPartyType],
  [3, emailType],
  [55, otherType],
])

function phoneContact(overrides: Partial<RecommenderContact> = {}): RecommenderContact {
  return {
    id: 101,
    contactValue: '380971111111',
    contactTypeId: 7,
    contactType: 'Third party mobile phone',
    contactTypeCode: 'third_party_mobile_phone',
    isPhone: true,
    comment: 'wife',
    contactTags: [
      {
        value_id: 1,
        category_id: 1,
        category_name: 'Status',
        category_code: 'status',
        selection_type: 'multi',
        is_protected: false,
        is_system: false,
        name: 'Do Not SMS',
        color: '#e8912a',
        blocks_calls: false,
        blocks_sms: true,
        blocks_spam: false,
        can_edit: true,
      },
    ],
    blocking: {
      blocks_calls: false,
      blocks_sms: false,
      blocks_spam: false,
      reasons: [],
    },
    ...overrides,
  }
}

function otherContact(overrides: Partial<RecommenderContact> = {}): RecommenderContact {
  return {
    id: 201,
    contactValue: 'a@b.com',
    contactTypeId: 3,
    contactType: 'Personal email',
    contactTypeCode: 'email_personal',
    isPhone: false,
    comment: '',
    contactTags: [],
    ...overrides,
  }
}

function renderTab(overrides: Partial<React.ComponentProps<typeof RecommendersTab>> = {}) {
  const onStartAdd = vi.fn()
  const props: React.ComponentProps<typeof RecommendersTab> = {
    clientId: 1,
    contacts: [
      phoneContact({ id: 102, contactTypeId: 7, contactTypeCode: 'third_party_mobile_phone' }),
      phoneContact({
        id: 101,
        contactTypeId: 29,
        contactType: 'Mobile phone from registers',
        contactTypeCode: 'register_mobile_phone',
        contactTags: [],
      }),
      otherContact(),
    ],
    contactTypesForSelect: [phoneType, thirdPartyType],
    contactTypesById,
    contactError: null,
    contactEditorMode: null,
    contactEditorIsPhone: null,
    editingContactId: null,
    contactFormData: { contact_value: '', contact_type_id: 29, comment: '' },
    isCreatingContact: false,
    isUpdatingContact: false,
    canEditClient: true,
    canMakeCalls: true,
    linkedContactsByPhone: new Map([
      ['380971111111', [{ id: 17, clientNumber: '№17', fullName: 'Linked Client' }]],
    ]),
    normalizePhoneForLookup: (raw) => raw.replace(/\D/g, ''),
    onFormChange: vi.fn(),
    onStartAdd,
    onStartEdit: vi.fn(),
    onSave: vi.fn(),
    onCancelEditor: vi.fn(),
    onDelete: vi.fn(),
    onOpenTagHistory: vi.fn(),
    openContactId: null,
    onOpenContactTagDropdown: vi.fn(),
    onCloseContactTagDropdown: vi.fn(),
    onCall: vi.fn(),
    onSendSms: vi.fn(),
    onSendMessage: vi.fn(),
    onStartInteraction: vi.fn(),
    ...overrides,
  }

  render(
    <MemoryRouter>
      <TooltipProvider>
        <RecommendersTab {...props} />
      </TooltipProvider>
    </MemoryRouter>
  )
  return { onStartAdd, props }
}

describe('RecommendersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('splits contacts into static Phones and Others sections with counts', () => {
    renderTab()
    const phones = screen.getByTestId('recommenders-phones-section')
    const others = screen.getByTestId('recommenders-others-section')
    expect(phones).toBeInTheDocument()
    expect(others).toBeInTheDocument()
    expect(within(phones).getByTestId('section-contact-count')).toHaveAttribute('data-count', '2')
    expect(within(others).getByTestId('section-contact-count')).toHaveAttribute('data-count', '1')
    expect(screen.getAllByTestId('section-add-contact')).toHaveLength(2)
  })

  it('orders phone cards by type sort_order within the Phones section', () => {
    renderTab({
      contacts: [
        phoneContact({
          id: 102,
          contactValue: '380500000002',
          contactTypeId: 7,
          contactType: 'Third party mobile phone',
          contactTypeCode: 'third_party_mobile_phone',
          contactTags: [],
        }),
        phoneContact({
          id: 101,
          contactValue: '380500000001',
          contactTypeId: 29,
          contactType: 'Mobile phone from registers',
          contactTypeCode: 'register_mobile_phone',
          contactTags: [],
        }),
      ],
    })
    const cards = within(screen.getByTestId('recommenders-phones-section')).getAllByTestId(
      'recommender-phone-card'
    )
    expect(cards[0]).toHaveTextContent('380500000001')
    expect(cards[1]).toHaveTextContent('380500000002')
  })

  it('opens the add form at the top of a section when + is clicked', async () => {
    const user = userEvent.setup()
    const { onStartAdd } = renderTab()
    await user.click(
      within(screen.getByTestId('recommenders-phones-section')).getByTestId('section-add-contact')
    )
    expect(onStartAdd).toHaveBeenCalledWith(true)
  })

  it('shows add form at top when contactEditorMode is add for phones', () => {
    renderTab({
      contactEditorMode: 'add',
      contactEditorIsPhone: true,
      contactTypesForSelect: [phoneType, thirdPartyType],
    })
    const section = screen.getByTestId('recommenders-phones-section')
    const form = within(section).getByTestId('recommender-contact-form')
    const cards = within(section).queryAllByTestId('recommender-phone-card')
    expect(form.compareDocumentPosition(cards[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders phone card with type pill, related pills, tags, separator, and full actions', () => {
    renderTab({
      contacts: [
        phoneContact({
          contactValue: '380971111111',
          contactTypeId: 7,
          contactTypeCode: 'third_party_mobile_phone',
        }),
      ],
      linkedContactsByPhone: new Map([
        ['380971111111', [{ id: 17, clientNumber: '№17', fullName: 'Linked' }]],
      ]),
    })
    const card = screen.getByTestId('recommender-phone-card')
    expect(within(card).getByTestId('contact-type-pill')).toBeInTheDocument()
    expect(within(card).getByTestId('related-contact-pills')).toHaveTextContent('№17')
    expect(within(card).getByTestId('contact-tag-chips')).toHaveTextContent('Do Not SMS')
    expect(within(card).getByTestId('action-separator')).toBeInTheDocument()
    expect(within(card).getByTestId('contact-comment')).toHaveTextContent('wife')
    expect(within(card).getByTestId('action-call')).toBeInTheDocument()
    expect(within(card).getByTestId('action-message')).toBeInTheDocument()
    expect(within(card).getByTestId('action-tag')).toBeInTheDocument()
    expect(within(card).getByTestId('action-interaction')).toBeInTheDocument()
    expect(within(card).getByTestId('action-edit')).toBeInTheDocument()
    expect(within(card).getByTestId('action-delete')).toBeInTheDocument()
  })

  it('renders others card without call/message/tag/related/tags rows', () => {
    renderTab({
      contacts: [otherContact()],
    })
    const card = screen.getByTestId('recommender-other-card')
    expect(within(card).getByTestId('contact-type-pill')).toBeInTheDocument()
    expect(within(card).queryByTestId('related-contact-pills')).not.toBeInTheDocument()
    expect(within(card).queryByTestId('contact-tag-chips')).not.toBeInTheDocument()
    expect(within(card).queryByTestId('action-separator')).not.toBeInTheDocument()
    expect(within(card).queryByTestId('action-call')).not.toBeInTheDocument()
    expect(within(card).queryByTestId('action-message')).not.toBeInTheDocument()
    expect(within(card).getByTestId('action-edit')).toBeInTheDocument()
    expect(within(card).getByTestId('action-delete')).toBeInTheDocument()
  })

  it('exposes SMS and messaging via the single Message control menu', async () => {
    const user = userEvent.setup()
    const onSendSms = vi.fn()
    const onSendMessage = vi.fn()
    renderTab({
      contacts: [phoneContact({ contactTags: [] })],
      onSendSms,
      onSendMessage,
    })
    await user.click(screen.getByTestId('action-message'))
    await user.click(await screen.findByTestId('action-message-sms'))
    expect(onSendSms).toHaveBeenCalledWith('380971111111')
  })

  it('strikes through phone when calls are blocked', () => {
    renderTab({
      contacts: [
        phoneContact({
          contactTags: [],
          blocking: {
            blocks_calls: true,
            blocks_sms: false,
            blocks_spam: false,
            reasons: ['Do Not Call'],
          },
        }),
      ],
    })
    const card = screen.getByTestId('recommender-phone-card')
    const phone = within(card).getByText('380971111111')
    expect(phone.className).toMatch(/line-through/)
  })

  it('disables Save and shows an error when a digit-only phone value has non-digits', () => {
    renderTab({
      contacts: [],
      contactEditorMode: 'add',
      contactEditorIsPhone: true,
      contactTypesForSelect: [phoneType, thirdPartyType],
      contactFormData: { contact_value: '38097abc', contact_type_id: 29, comment: '' },
    })
    const form = screen.getByTestId('recommender-contact-form')
    expect(within(form).getByTestId('contact-value-error')).toHaveTextContent(
      'pages.clients.editModal.contactDigitsOnly'
    )
    expect(
      within(form).getByRole('button', { name: 'pages.clients.editModal.save' })
    ).toBeDisabled()
  })

  it('accepts any characters for an Other-source contact type', () => {
    renderTab({
      contacts: [],
      contactEditorMode: 'add',
      contactEditorIsPhone: false,
      contactTypesForSelect: [otherType],
      contactFormData: { contact_value: 'Kyiv, Main st. 12', contact_type_id: 55, comment: '' },
    })
    const form = screen.getByTestId('recommender-contact-form')
    expect(within(form).queryByTestId('contact-value-error')).not.toBeInTheDocument()
    expect(
      within(form).getByRole('button', { name: 'pages.clients.editModal.save' })
    ).not.toBeDisabled()
  })

  it('blocks Save when the value duplicates another contact of the same client', () => {
    renderTab({
      contacts: [otherContact({ id: 201, contactValue: '380971111111', isPhone: false })],
      contactEditorMode: 'add',
      contactEditorIsPhone: true,
      contactTypesForSelect: [phoneType, thirdPartyType],
      contactFormData: { contact_value: '380971111111', contact_type_id: 29, comment: '' },
    })
    const form = screen.getByTestId('recommender-contact-form')
    expect(within(form).getByTestId('contact-value-error')).toHaveTextContent(
      'pages.clients.editModal.contactDuplicate'
    )
    expect(
      within(form).getByRole('button', { name: 'pages.clients.editModal.save' })
    ).toBeDisabled()
  })

  it('allows Save when editing a contact without changing its value', () => {
    renderTab({
      contacts: [phoneContact({ id: 101, contactValue: '380971111111', contactTags: [] })],
      contactEditorMode: 'edit',
      contactEditorIsPhone: true,
      editingContactId: 101,
      contactTypesForSelect: [phoneType, thirdPartyType],
      contactFormData: { contact_value: '380971111111', contact_type_id: 29, comment: '' },
    })
    const form = screen.getByTestId('recommender-contact-form')
    expect(within(form).queryByTestId('contact-value-error')).not.toBeInTheDocument()
    expect(
      within(form).getByRole('button', { name: 'pages.clients.editModal.save' })
    ).not.toBeDisabled()
  })

  it('disables the Call icon with a tag tooltip when calls are blocked', () => {
    renderTab({
      contacts: [
        phoneContact({
          contactTags: [],
          blocking: {
            blocks_calls: true,
            blocks_sms: false,
            blocks_spam: false,
            reasons: ['Calls blocked: Do Not Call'],
          },
        }),
      ],
    })
    const call = screen.getByTestId('action-call')
    expect(call).toBeDisabled()
    expect(call).toHaveAttribute('title', 'Calls blocked: Do Not Call')
  })

  // blocks_spam governs the Spam-calls option in the call dialog, not the
  // Message action icon.
  it('does NOT disable the Message icon when only blocks_spam is active', () => {
    renderTab({
      contacts: [
        phoneContact({
          contactTags: [],
          blocking: {
            blocks_calls: false,
            blocks_sms: false,
            blocks_spam: true,
            reasons: ['Spam blocked: Do Not Spam'],
          },
        }),
      ],
    })
    expect(screen.getByTestId('action-message')).not.toBeDisabled()
  })

  it('disables the Message icon when blocks_sms is active', () => {
    renderTab({
      contacts: [
        phoneContact({
          contactTags: [],
          blocking: {
            blocks_calls: false,
            blocks_sms: true,
            blocks_spam: false,
            reasons: ['SMS blocked: Do Not SMS'],
          },
        }),
      ],
    })
    expect(screen.getByTestId('action-message')).toBeDisabled()
  })

  it('keeps Call and Message icons enabled when there are no blocking tags', () => {
    renderTab({ contacts: [phoneContact({ contactTags: [] })] })
    expect(screen.getByTestId('action-call')).not.toBeDisabled()
    expect(screen.getByTestId('action-message')).not.toBeDisabled()
  })

  it('shows the full contact type name without truncation class', () => {
    renderTab({
      contacts: [
        phoneContact({
          contactType: 'Mobile phone from registers',
          contactTypeCode: 'register_mobile_phone',
          contactTypeId: 29,
          contactTags: [],
        }),
      ],
    })
    const pill = screen.getByTestId('contact-type-pill')
    expect(pill.textContent?.length).toBeGreaterThan(0)
    expect(pill.querySelector('.truncate')).toBeNull()
    expect(pill.className).not.toMatch(/\bmax-w-full\b/)
  })
})
