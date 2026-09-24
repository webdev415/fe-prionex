import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ConfigListEditor } from '../ConfigListEditor'

const addResourceBundle = vi.hoisted(() => vi.fn())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'es',
      loadLanguages: vi.fn().mockResolvedValue(undefined),
      addResourceBundle,
      t: () => '',
    },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

describe('ConfigListEditor translations', () => {
  it('lets the label be entered and saved in Spanish too', () => {
    const onAdd = vi.fn()
    render(
      <ConfigListEditor
        title="Categories"
        items={[]}
        onAdd={onAdd}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
        i18nPrefix="pages.tags.categories"
      />
    )

    fireEvent.change(screen.getByPlaceholderText('pages.tags.settings.valuePlaceholder'), {
      target: { value: 'risk' },
    })
    fireEvent.change(screen.getByPlaceholderText('EN'), { target: { value: 'Risk' } })
    fireEvent.change(screen.getByPlaceholderText('UK'), { target: { value: 'Ризик' } })
    fireEvent.change(screen.getByPlaceholderText('ES'), { target: { value: 'Riesgo' } })
    fireEvent.keyDown(screen.getByPlaceholderText('ES'), { key: 'Enter' })

    expect(addResourceBundle).toHaveBeenCalledWith(
      'es',
      'common',
      { pages: { tags: { categories: { risk: 'Riesgo' } } } },
      true,
      true
    )
    expect(onAdd).toHaveBeenCalledWith({ value: 'risk', label: 'Risk' })
  })
})
