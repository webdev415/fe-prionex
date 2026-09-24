import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/lib/i18n'
import type { SaleNote } from '@/features/clients/types/saleNotes'
import { SaleNoteCard } from '../SaleNoteCard'

const mutableI18n = i18n as unknown as { language: string }

const note: SaleNote = {
  id: 1,
  client_id: 10,
  sale_date: '2026-07-05',
  content: 'Nota',
  added_by_user_id: 3,
  added_by_name: 'Ana',
  created_at: '2026-07-05T09:00:00Z',
}

describe('SaleNoteCard sale date', () => {
  afterEach(() => {
    mutableI18n.language = 'en'
  })

  it('shows dd/mm/yyyy in a Spanish interface', () => {
    mutableI18n.language = 'es'
    render(<SaleNoteCard note={note} />)

    expect(screen.getByText('05/07/2026')).toBeInTheDocument()
  })

  it.each(['uk', 'en'])('keeps dd-mm-yyyy in a %s interface', (language) => {
    mutableI18n.language = language
    render(<SaleNoteCard note={note} />)

    expect(screen.getByText('05-07-2026')).toBeInTheDocument()
  })
})
