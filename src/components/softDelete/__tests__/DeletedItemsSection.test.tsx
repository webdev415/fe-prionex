/**
 * The deleted table only exists when something is deleted.
 *
 * A permanently visible "Deleted (0)" block would be noise on almost every
 * visit, so absence is the default and the section has to earn its space.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeletedItemsSection } from '../DeletedItemsSection'
import type { Column } from '@/components/ui/DataTable'

interface Row {
  id: number
  name: string
}

const columns: Column<Row>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }]

describe('DeletedItemsSection', () => {
  it('renders nothing when there is nothing deleted', () => {
    const { container } = render(
      <DeletedItemsSection items={[]} total={0} columns={columns} title="Deleted drafts" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('appears once something is deleted', () => {
    render(
      <DeletedItemsSection
        items={[{ id: 1, name: 'Old reminder' }]}
        total={1}
        columns={columns}
        title="Deleted drafts"
      />
    )
    expect(screen.getByRole('heading', { name: 'Deleted drafts' })).toBeInTheDocument()
    expect(screen.getByText('Old reminder')).toBeInTheDocument()
  })

  it('shows the server total, not the page length', () => {
    render(
      <DeletedItemsSection
        items={[{ id: 1, name: 'Old reminder' }]}
        total={42}
        columns={columns}
        title="Deleted drafts"
      />
    )
    expect(screen.getByText('(42)')).toBeInTheDocument()
  })

  it('is labelled for assistive tech so it is distinguishable from the active list', () => {
    render(
      <DeletedItemsSection
        items={[{ id: 1, name: 'Old reminder' }]}
        total={1}
        columns={columns}
        title="Deleted templates"
      />
    )
    expect(screen.getByRole('region', { name: 'Deleted templates' })).toBeInTheDocument()
  })
})
