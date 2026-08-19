/**
 * The exported deadline column has to name the same calendar day the board
 * shows (KAN-1000). It used to slice the day out of `toISOString()`, which is
 * the UTC day — a 01:00 Kyiv deadline is stored at 22:00 the previous UTC day,
 * so the CSV contradicted the card it was exported from.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TFunction } from 'i18next'
import type { KanbanColumnDef, KanbanTask } from '../kanbanData'

// jsdom's Blob has no .text(), so capture the CSV as it is handed over.
const captured = vi.hoisted(() => ({ csv: '' }))
const downloadBlobMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/messaging/utils/downloadBlob', () => ({ downloadBlob: downloadBlobMock }))
vi.stubGlobal(
  'Blob',
  class {
    constructor(parts: string[]) {
      captured.csv = parts.join('')
    }
  }
)

const { exportKanbanTasksToCsv } = await import('../kanbanExport')

const TZ = 'Europe/Kyiv'
const t = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction

const task: KanbanTask = {
  id: 'TASK-1',
  taskId: 1,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  clientId: 10,
  deadline: '2026-08-31T22:00:00',
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 7,
  columnId: 'in_progress',
  letterId: null,
  letterTypeId: 'complaint',
  legalTaskId: 1,
  letterCount: 1,
}

function columnsWith(deadline: string | null, closedAt: string | null = null) {
  return [
    {
      id: 'in_progress',
      labelKey: 'columns.inProgress',
      tasks: [{ ...task, deadline, closedAt }],
    },
  ] as unknown as KanbanColumnDef[]
}

describe('exportKanbanTasksToCsv deadline column', () => {
  beforeEach(() => {
    downloadBlobMock.mockReset()
    captured.csv = ''
  })

  it('exports the profile-timezone day, not the UTC one', () => {
    const count = exportKanbanTasksToCsv(columnsWith('2026-08-31T22:00:00'), t, undefined, [], TZ)
    expect(count).toBe(1)

    const csv = captured.csv
    expect(csv).toContain('2026-09-01')
    expect(csv).not.toContain('2026-08-31')
  })

  it('uses the same day for closed_at', () => {
    exportKanbanTasksToCsv(columnsWith(null, '2026-08-31T22:00:00'), t, undefined, [], TZ)

    const csv = captured.csv
    expect(csv).toContain('2026-09-01')
  })

  it('falls back to Kyiv when no profile timezone is passed', () => {
    exportKanbanTasksToCsv(columnsWith('2026-08-31T22:00:00'), t, undefined, [])

    const csv = captured.csv
    expect(csv).toContain('2026-09-01')
  })

  it('leaves an unparseable value alone rather than blanking it', () => {
    exportKanbanTasksToCsv(columnsWith('not a date'), t, undefined, [], TZ)

    const csv = captured.csv
    expect(csv).toContain('not a date')
  })
})
