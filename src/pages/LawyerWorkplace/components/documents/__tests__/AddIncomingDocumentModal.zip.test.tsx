/**
 * Lawyers receive court packages as .zip archives, but the incoming-document
 * picker's accept list lacked .zip, so the OS file dialog greyed archives out
 * (legal-office reports 18–20.08). The backend allows zip (blocklist covers
 * executables only) — the filter lived purely in the frontend picker.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({ user: { id: 7 } }),
}))

vi.mock('@/features/lawyerWorkplace', () => ({
  useLegalLawyers: () => ({
    data: { items: [{ id: 'l-1', user_id: 7, display_name: 'Lawyer One' }] },
  }),
  useDocumentClientContract: () => ({
    contracts: [],
    contractsLoading: false,
    contractNumber: '',
    setContractNumber: vi.fn(),
    requiresSelection: false,
    hasValidContract: true,
    resetContract: vi.fn(),
  }),
}))

// Client + contract selects pull their own data hooks — irrelevant to the
// file picker under test.
vi.mock('../DocumentClientContractFields', () => ({
  DocumentClientContractFields: () => <div data-testid="client-contract-stub" />,
}))

import { AddIncomingDocumentModal } from '../AddIncomingDocumentModal'

/** The modal resets its state in a requestAnimationFrame after opening. */
function flushAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function renderModal() {
  return render(<AddIncomingDocumentModal open onClose={vi.fn()} onSubmit={vi.fn()} />)
}

function getFileInput(): HTMLInputElement {
  // The input is visually hidden inside the drop zone (Radix portal).
  const input = document.querySelector('input[type="file"]')
  expect(input).not.toBeNull()
  return input as HTMLInputElement
}

describe('AddIncomingDocumentModal — zip uploads', () => {
  it('lists .zip in the picker accept filter', async () => {
    renderModal()
    await flushAnimationFrame()

    const accepted = getFileInput()
      .accept.split(',')
      .map((ext) => ext.trim())
    expect(accepted).toContain('.zip')
    // Existing formats stay untouched.
    expect(accepted).toEqual(
      expect.arrayContaining(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'])
    )
  })

  it('accepts a selected .zip archive and shows its name', async () => {
    const user = userEvent.setup()
    renderModal()
    await flushAnimationFrame()

    const zip = new File(['PK'], 'court-package.zip', { type: 'application/zip' })
    // userEvent.upload honours the accept attribute: with .zip missing from it
    // this selection would be silently dropped and the assertion would fail.
    await user.upload(getFileInput(), zip)

    expect(await screen.findByText('court-package.zip')).toBeInTheDocument()
  })
})
