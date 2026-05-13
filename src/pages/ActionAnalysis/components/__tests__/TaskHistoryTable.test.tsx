/**
 * Render tests for TaskHistoryTable (KAN-483).
 *
 * The i18n mock in src/test/setup.ts returns translation keys verbatim
 * when no entry exists, so we assert on keys for badge labels.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TaskHistoryTable } from '../TaskHistoryTable'
import type { TaskHistoryItem } from '@/features/actionAnalysis'

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
  return render(<TaskHistoryTable data={rows} sort="created_at_desc" onSortChange={vi.fn()} />)
}

describe('TaskHistoryTable', () => {
  it('renders the priority badge using the i18n key', () => {
    renderTable([makeTask({ priority: 'high' })])
    expect(screen.getByText('pages.actionAnalysis.filters.priorities.high')).toBeInTheDocument()
  })

  it('renders the status badge using the i18n key', () => {
    renderTable([makeTask({ status: 'completed' })])
    expect(screen.getByText('pages.actionAnalysis.filters.statuses.completed')).toBeInTheDocument()
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
    render(<TaskHistoryTable data={[makeTask()]} sort="due_date_asc" onSortChange={vi.fn()} />)
    // Sort label is rendered next to the Select.
    expect(screen.getByText('pages.actionAnalysis.filters.sortBy')).toBeInTheDocument()
  })
})
