/**
 * UBKI submission-log API — the one piece of this page already served by a real
 * backend endpoint: GET /api/v1/ubki/logs (project-scoped by JWT, newest first).
 *
 * The response has no client name / TIN / contract-number / operator name (only
 * ids), so the Overview table maps to what's available and shows ids where the
 * design shows names. Enriching those is a backend follow-up.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { formatDateTime } from '@/lib/formatters'
import type { SubmissionLogRow, SubmissionStatus } from './mockData'

export interface UbkiLogItem {
  id: number
  client_id: number
  debt_id: number
  mode: string
  batch_id: string | null
  status: string
  ubki_request_id: string | null
  error_code: string | null
  error_message: string | null
  triggered_by: number | null
  created_at: string
}

export interface UbkiLogsParams {
  debt_id?: number
  batch_id?: string
  limit?: number
}

export async function getUbkiLogs(params: UbkiLogsParams = {}): Promise<UbkiLogItem[]> {
  const r = await api.get<UbkiLogItem[]>('/api/v1/ubki/logs', { params })
  return r.data
}

/** Backend status vocabulary (success | error | skipped) → the table's pill states. */
function mapStatus(status: string): SubmissionStatus {
  if (status === 'success') return 'success'
  if (status === 'error') return 'failed'
  return 'pending' // skipped / anything else
}

/** Map a real log item to the row shape the table + drawer already use. */
export function mapLogItemToRow(item: UbkiLogItem): SubmissionLogRow {
  return {
    id: String(item.id),
    dateTime: formatDateTime(item.created_at),
    type: 'Outbound', // submission logs are outbound; backend has no in/out flag
    mode: item.mode?.toLowerCase() === 'automatic' ? 'Auto' : 'Manual',
    clientName: `Client #${item.client_id}`,
    clientTin: `Debt #${item.debt_id}`,
    creditContract: item.ubki_request_id ?? '—',
    status: mapStatus(item.status),
    error: item.error_code,
    operator: item.triggered_by ? `User #${item.triggered_by}` : 'system',
  }
}

export function useUbkiLogs(params: UbkiLogsParams = {}) {
  return useQuery({
    queryKey: ['ubki-logs', params],
    queryFn: () => getUbkiLogs(params),
    staleTime: 15_000,
  })
}
