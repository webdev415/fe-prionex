import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SaleNotesSection } from '../SaleNotesSection'
import type { PhoneLookupContact } from '@/features/clients/utils/phoneHighlight'

const KNOWN = '380685161436'
const NEW = '380501234567'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => fallback ?? key,
      i18n: { language: 'en' },
    }),
  }
})

const authState = { user: { timezone: 'Europe/Kyiv' } }
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authState),
}))

const toastSuccess = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

const notesState = vi.hoisted(() => ({
  data: [] as unknown[],
  isLoading: false,
  error: null as unknown,
}))
vi.mock('@/features/clients/hooks/useSaleNotes', () => ({
  useSaleNotesList: () => ({ ...notesState, refetch: vi.fn() }),
  useDeleteSaleNote: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/usePermissions', () => ({ useHasPermission: () => true }))

const lastCallState = vi.hoisted(() => ({
  lastCallAt: null as string | null,
  outcome: null as string | null,
  isLoading: false,
  isError: false,
}))
vi.mock('@/features/calls/hooks/useLastCallByPhone', () => ({
  useLastCallByPhone: () => lastCallState,
}))

const note = (id: number, content: string) => ({
  id,
  client_id: 408417,
  sale_date: '2026-03-01',
  content,
  added_by_user_id: 1,
  added_by_name: 'Оператор',
  created_at: '2026-03-01T10:00:00Z',
})

const phoneContact = (contactValue: string): PhoneLookupContact => ({ contactValue })

function renderSection(over: Partial<React.ComponentProps<typeof SaleNotesSection>> = {}) {
  const handlers = {
    onPhoneCall: vi.fn(),
    onPhoneAddContact: vi.fn(),
  }
  const utils = render(
    <SaleNotesSection
      clientId={408417}
      phoneContacts={[phoneContact(`+${KNOWN}`)]}
      {...handlers}
      {...over}
    />
  )
  return { ...utils, ...handlers }
}

const phoneSpans = () => Array.from(document.querySelectorAll('[data-phone]'))
const spanFor = (phone: string) =>
  phoneSpans().find((s) => s.getAttribute('data-phone') === phone) as HTMLElement

const writeText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  notesState.data = [note(1, `<p>основний ${KNOWN}, новий ${NEW}</p>`)]
  notesState.isLoading = false
  notesState.error = null
  lastCallState.lastCallAt = null
  lastCallState.isLoading = false
})

// No manual DOM wipe here. Testing Library's auto-cleanup already unmounts and
// removes each container, and clearing document.body first orphans the
// dropdown's PORTAL node — React then fails to unmount it with "The node to be
// removed is not a child of this node", which only shows up on the tests that
// actually open the panel.

describe('the primary-creditor comment section', () => {
  it('highlights the numbers in the comment', () => {
    renderSection()
    expect(phoneSpans().map((s) => s.getAttribute('data-phone'))).toEqual([KNOWN, NEW])
  })

  it('colours a contact number known and an unseen one new', () => {
    // The contacts come from the same source the Recommenders tab renders, so
    // the two views cannot disagree about whether a number is callable.
    renderSection()
    expect(spanFor(KNOWN).getAttribute('data-phone-state')).toBe('known')
    expect(spanFor(NEW).getAttribute('data-phone-state')).toBe('new')
  })

  it('opens the dropdown for the number that was clicked', () => {
    renderSection()
    fireEvent.click(spanFor(NEW))
    const panel = screen.getByRole('dialog')
    expect(within(panel).getByText(NEW)).toBeInTheDocument()
    expect(within(panel).getByText('Not a contact')).toBeInTheDocument()
  })

  it('hands the call up to the page rather than dialling itself', () => {
    // The page owns the call-in-progress and calling-window guards; this
    // section must not acquire a second copy of them.
    const { onPhoneCall } = renderSection()
    fireEvent.click(spanFor(NEW))
    fireEvent.click(screen.getByRole('button', { name: /^Call$/ }))
    expect(onPhoneCall).toHaveBeenCalledWith(NEW, 'new')
  })

  it('passes a known number up with its known state', () => {
    const { onPhoneCall } = renderSection()
    fireEvent.click(spanFor(KNOWN))
    fireEvent.click(screen.getByRole('button', { name: /^Call$/ }))
    expect(onPhoneCall).toHaveBeenCalledWith(KNOWN, 'known')
  })

  it('offers Add contact for a new number and reports it up', () => {
    const { onPhoneAddContact } = renderSection()
    fireEvent.click(spanFor(NEW))
    fireEvent.click(screen.getByRole('button', { name: /Add Contact/i }))
    expect(onPhoneAddContact).toHaveBeenCalledWith(NEW)
  })

  it('does not offer Add contact for a number already saved', () => {
    renderSection()
    fireEvent.click(spanFor(KNOWN))
    expect(screen.queryByRole('button', { name: /Add Contact/i })).not.toBeInTheDocument()
  })

  it('copies the number and confirms it', async () => {
    renderSection()
    fireEvent.click(spanFor(NEW))
    fireEvent.click(screen.getByRole('button', { name: /Copy phone/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(NEW))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
  })

  it('says so when the clipboard refuses rather than claiming success', async () => {
    // Clipboard access can be denied outright; a silent failure would leave the
    // operator pasting whatever was there before.
    writeText.mockRejectedValue(new Error('denied'))
    renderSection()
    fireEvent.click(spanFor(NEW))
    fireEvent.click(screen.getByRole('button', { name: /Copy phone/ }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('closes the dropdown once an action is taken', () => {
    renderSection()
    fireEvent.click(spanFor(NEW))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Call$/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('highlights numbers in comments revealed by View All', () => {
    // Collapsed, only the newest card is mounted; the second card's numbers
    // have never been walked until it appears.
    notesState.data = [note(1, `<p>${KNOWN}</p>`), note(2, `<p>${NEW}</p>`)]
    renderSection()
    expect(phoneSpans()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /View All/i }))

    expect(phoneSpans().map((s) => s.getAttribute('data-phone'))).toEqual([KNOWN, NEW])
  })

  it('treats every number as new when the client has no contacts', () => {
    renderSection({ phoneContacts: null })
    expect(spanFor(KNOWN).getAttribute('data-phone-state')).toBe('new')
  })

  it('still renders the comment when no phone callbacks are supplied', () => {
    // The section is usable standalone; the numbers highlight and simply do
    // nothing when clicked.
    renderSection({ onPhoneCall: undefined, onPhoneAddContact: undefined })
    fireEvent.click(spanFor(NEW))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows the empty state when the client has no comments', () => {
    notesState.data = []
    renderSection()
    expect(screen.getByText('No comments yet')).toBeInTheDocument()
    expect(phoneSpans()).toHaveLength(0)
  })
})
