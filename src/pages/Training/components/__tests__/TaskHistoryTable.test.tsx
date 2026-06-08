/**
 * Render tests for TaskHistoryTable (KAN-483).
 *
 * The i18n mock in src/test/setup.ts returns translation keys verbatim
 * when no entry exists, so we assert on keys for badge labels.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { TaskHistoryTable } from '../TaskHistoryTable'
import type { TaskHistoryItem } from '@/features/training'

function makeTask(overrides: Partial<TaskHistoryItem> = {}): TaskHistoryItem {
  return {
    id: 1,
    project_id: 1,
    client_id: 100,
    debt_id: null,
    subject_id: 5,
    subject_name: 'Call client',
    subject_code: 'CALL',
    title: 'Task title',
    description: null,
    comment: null,
    priority: 'high',
    status: 'pending',
    due_date: '2026-05-15T14:30:00',
    is_overdue: false,
    assigned_to_user_id: 10,
    assigned_to_username: 'Alice',
    is_dismissed: false,
    created_at: '2026-05-12T09:00:00Z',
    updated_at: null,
    created_by: 20,
    created_by_name: 'Bob',
    legacy_id: null,
    ...overrides,
  }
}

function renderTable(rows: TaskHistoryItem[]) {
  return render(
    <MemoryRouter>
      <TaskHistoryTable data={rows} sort="created_at_desc" onSortChange={vi.fn()} />
    </MemoryRouter>
  )
}

describe('TaskHistoryTable', () => {
  it('renders the priority badge using the i18n key', () => {
    renderTable([makeTask({ priority: 'high' })])
    expect(screen.getByText('pages.training.filters.priorities.high')).toBeInTheDocument()
  })

  it('renders the status badge using the i18n key', () => {
    renderTable([makeTask({ status: 'completed' })])
    expect(screen.getByText('pages.training.filters.statuses.completed')).toBeInTheDocument()
  })

  it('renders the assignee name and topic', () => {
    renderTable([makeTask({ assigned_to_username: 'Alice', subject_name: 'Call client' })])
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Call client')).toBeInTheDocument()
  })

  it('renders em-dash when due_date is null', () => {
    renderTable([
      makeTask({
        id: 99,
        due_date: null,
        // Use non-default placeholders elsewhere so dashes only count for due-date
        assigned_to_username: 'Alice',
        created_by_name: 'Bob',
        subject_name: 'Topic',
      }),
    ])
    // Two em-dashes: Due date + Due time
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders the sort selector with the active value', () => {
    render(
      <MemoryRouter>
        <TaskHistoryTable data={[makeTask()]} sort="due_date_asc" onSortChange={vi.fn()} />
      </MemoryRouter>
    )
    // Sort label is rendered next to the Select.
    expect(screen.getByText('pages.training.filters.sortBy')).toBeInTheDocument()
  })

  // KAN-576: Client ID column.
  it('renders the Client ID cell as a link to /dashboard/clients/:id', () => {
    renderTable([makeTask({ client_id: 42 })])
    const link = screen.getByText('#42').closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/dashboard/clients/42')
  })

  it('renders an em-dash with no link when client_id is null', () => {
    renderTable([
      makeTask({
        id: 77,
        client_id: null,
        // Keep other nullable cells populated so em-dash count is bounded.
        due_date: '2026-05-15T14:30:00',
        assigned_to_username: 'Alice',
        created_by_name: 'Bob',
        subject_name: 'Topic',
      }),
    ])
    // Only the Client ID cell should be an em-dash for this row.
    expect(screen.getAllByText('—')).toHaveLength(1)
    expect(screen.queryByText(/^#/)).toBeNull()
  })

  it('places the Client ID header between Created date and Author', () => {
    renderTable([makeTask()])
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim())
    const createdIdx = headers.indexOf('pages.training.columns.createdDate')
    const clientIdx = headers.indexOf('pages.training.columns.clientId')
    const authorIdx = headers.indexOf('pages.training.columns.author')
    expect(createdIdx).toBeGreaterThanOrEqual(0)
    expect(clientIdx).toBe(createdIdx + 1)
    expect(authorIdx).toBe(clientIdx + 1)
  })
})
