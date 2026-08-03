import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  LawyerWorkplaceLayoutContext,
  type LawyerWorkplaceLayout,
} from '../../../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig } from '../../../../../settings/types'
import { LetterTypeBasicInfoSection } from '../LetterTypeBasicInfoSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}))

// jsdom lacks the pointer-capture APIs Radix Select relies on.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).hasPointerCapture = () => false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).releasePointerCapture = () => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window.HTMLElement.prototype as any).scrollIntoView = () => undefined
})

const DRAFT: LetterTypeConfig = {
  id: 'complaint',
  slug: 'complaint',
  nameKey: 'api:name:complaint',
  nameFallback: 'Complaint',
  colorId: 'teal',
  slaDays: 7,
  slaDayType: 'calendar',
  descriptionKey: 'api:desc:complaint',
  descriptionFallback: '',
  letterCount: 0,
  examples: [],
  priorities: [],
  keywordHints: [],
  isActive: true,
}

const LAYOUT: LawyerWorkplaceLayout = {
  ref: { current: null },
  contentWidth: 1280,
  isCompact: false,
  isKanbanGrid: true,
  isWide: true,
  showWorkspaceBanner: true,
}

function renderSection(onDraftChange = vi.fn()) {
  render(
    <LawyerWorkplaceLayoutContext.Provider value={LAYOUT}>
      <LetterTypeBasicInfoSection draft={DRAFT} onDraftChange={onDraftChange} />
    </LawyerWorkplaceLayoutContext.Provider>
  )
  return { onDraftChange }
}

describe('LetterTypeBasicInfoSection — SLA day-type select', () => {
  it('offers a "working days" / "calendar days" select next to the SLA number', () => {
    renderSection()
    // The select shows the current value ("Calendar days").
    expect(screen.getByText('Calendar days')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('emits slaDayType="working" when the operator switches to working days', async () => {
    const user = userEvent.setup()
    const { onDraftChange } = renderSection()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Working days' }))

    expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ slaDayType: 'working' }))
  })
})
