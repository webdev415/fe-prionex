/**
 * Shared mock data for Import History and Import Details
 * Ensures data consistency between pages
 */

import type { ImportHistoryItem } from './ImportHistoryPage'

// Generate consistent mock data based on ID
export function generateImportHistoryItem(id: number): ImportHistoryItem {
  const users = ['Olena', 'Maria', 'John', 'Anna', 'David']
  const statuses: ('done' | 'failed' | 'in_progress')[] = ['done', 'failed']

  // Use seeded random to ensure same ID always generates same data
  const seed = id
  const date = new Date(2024, 10, ((seed * 7) % 30) + 1) // November 2024
  const hours = (seed * 3) % 24
  const minutes = (seed * 5) % 60
  const dateTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  const user = users[seed % users.length]
  // Only ID 1 has 'in_progress' status, others are 'done' or 'failed'
  const status: 'done' | 'failed' | 'in_progress' =
    id === 1 ? 'in_progress' : statuses[seed % statuses.length]
  const errors =
    status === 'failed'
      ? ((seed * 11) % 100) + 1
      : status === 'in_progress'
        ? 0 // No errors during progress
        : (seed * 13) % 100

  return {
    id,
    dateTime,
    fileName: `clients_batch_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${id}.csv`,
    uploadedBy: user,
    status,
    errors,
  }
}

export function generateMockImportHistory(): ImportHistoryItem[] {
  const data: ImportHistoryItem[] = []
  for (let i = 1; i <= 50; i++) {
    data.push(generateImportHistoryItem(i))
  }
  return data
}
