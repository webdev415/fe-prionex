/**
 * UBKI submission-log API — the one piece of this page already served by a real
 * backend endpoint: GET /api/v1/ubki/logs (project-scoped by JWT, newest first).
 *
 * The response has no client name / TIN / contract-number / operator name (only
 * ids), so the Overview table maps to what's available and shows ids where the
 * design shows names. Enriching those is a backend follow-up.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  // Enriched (joined) fields — null when the client/debt was deleted.
  client_name: string | null
  client_tin: string | null
  contract_number: string | null
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
    clientName: item.client_name ?? `Client #${item.client_id}`,
    clientTin: item.client_tin ? `TIN ${item.client_tin}` : `Debt #${item.debt_id}`,
    creditContract: item.contract_number ?? item.ubki_request_id ?? '—',
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

// ── Submission detail + admin note (drawer) ──────────────────────────────────
export interface UbkiLogDetailStep {
  label: string
  detail: string | null
  time: string
  state: 'ok' | 'error' | 'info'
}

export interface UbkiLogDetail extends UbkiLogItem {
  admin_note: string | null
  timeline: UbkiLogDetailStep[]
  request_summary: string
  response_summary: string
  execution_log: string
}

export async function getUbkiLogDetail(id: number | string): Promise<UbkiLogDetail> {
  const r = await api.get<UbkiLogDetail>(`/api/v1/ubki/logs/${id}`)
  return r.data
}

export async function saveUbkiLogNote(id: number | string, note: string): Promise<UbkiLogDetail> {
  const r = await api.put<UbkiLogDetail>(`/api/v1/ubki/logs/${id}/note`, { note })
  return r.data
}

export function useUbkiLogDetail(id: string | null) {
  return useQuery({
    queryKey: ['ubki-log-detail', id],
    queryFn: () => getUbkiLogDetail(id as string),
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useSaveUbkiLogNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string | number; note: string }) => saveUbkiLogNote(id, note),
    onSuccess: (data) => {
      qc.setQueryData(['ubki-log-detail', String(data.id)], data)
      qc.invalidateQueries({ queryKey: ['ubki-logs'] })
    },
  })
}

// ── Resend a single credit's submission ──────────────────────────────────────
export interface UbkiSubmitResult {
  debt_id: number
  client_id: number
  status: string
  ubki_request_id: string | null
  error_code: string | null
  error_message: string | null
}

export async function resendSubmission(debtId: number): Promise<UbkiSubmitResult> {
  const r = await api.post<UbkiSubmitResult>(`/api/v1/ubki/debts/${debtId}/submit`)
  return r.data
}

export function useResendSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resendSubmission,
    onSuccess: () => {
      // A resend creates a new log row and moves the counters.
      qc.invalidateQueries({ queryKey: ['ubki-logs'] })
      qc.invalidateQueries({ queryKey: ['ubki-kpis'] })
    },
  })
}

// ── Settings (GET / PUT /api/v1/ubki/settings) ───────────────────────────────
export interface UbkiSettings {
  auto_submit_enabled: boolean
  send_time: string // "HH:MM"
  timezone: string
  frequency: 'daily' | 'weekdays' | 'custom'
  send_only_changed: boolean
  max_retry_attempts: number
  retry_interval_minutes: number
  skip_retry_error_codes: string[]
  daily_summary_email: boolean
  alert_on_high_failure: boolean
  failure_rate_threshold: number
  connection_down_alert_minutes: number
  notification_recipients: string[]
}

export async function getUbkiSettings(): Promise<UbkiSettings> {
  const r = await api.get<UbkiSettings>('/api/v1/ubki/settings')
  return r.data
}

/** Partial update — only the provided fields are written server-side. */
export async function updateUbkiSettings(payload: Partial<UbkiSettings>): Promise<UbkiSettings> {
  const r = await api.put<UbkiSettings>('/api/v1/ubki/settings', payload)
  return r.data
}

export function useUbkiSettings() {
  return useQuery({
    queryKey: ['ubki-settings'],
    queryFn: getUbkiSettings,
    staleTime: 30_000,
  })
}

export function useUpdateUbkiSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateUbkiSettings,
    onSuccess: (data) => qc.setQueryData(['ubki-settings'], data),
  })
}

// ── Opt-out (list / add / remove / CSV import) ───────────────────────────────
export interface OptOutClientItem {
  client_id: number
  client_name: string | null
  tax_id: string | null
  reason: string | null
  note: string | null
  set_by: number | null
  set_at: string | null
}

export interface OptOutImportResult {
  imported_count: number
  skipped_count: number
  not_found: string[]
}

export async function getOptOutClients(): Promise<OptOutClientItem[]> {
  const r = await api.get<OptOutClientItem[]>('/api/v1/ubki/opt-out')
  return r.data
}

export async function addOptOut(payload: { client_ids: number[]; reason: string; note?: string }) {
  const r = await api.post('/api/v1/ubki/opt-out', payload)
  return r.data
}

export async function removeOptOut(client_ids: number[]) {
  const r = await api.post('/api/v1/ubki/opt-out/remove', { client_ids })
  return r.data
}

export async function importOptOut(file: File, reason: string): Promise<OptOutImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await api.post<OptOutImportResult>(
    `/api/v1/ubki/opt-out/import?reason=${encodeURIComponent(reason)}`,
    fd
  )
  return r.data
}

export function useOptOutClients() {
  return useQuery({ queryKey: ['ubki-optout'], queryFn: getOptOutClients, staleTime: 15_000 })
}

export function useAddOptOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addOptOut,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ubki-optout'] }),
  })
}

export function useRemoveOptOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeOptOut,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ubki-optout'] }),
  })
}

export function useImportOptOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, reason }: { file: File; reason: string }) => importOptOut(file, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ubki-optout'] }),
  })
}

// ── Audit log (list + CSV export) ────────────────────────────────────────────
export interface AuditLogItem {
  id: number
  event: string
  event_type: string
  performed_by: number | null
  performed_by_name: string | null
  details: string | null
  status: 'success' | 'failed' | 'pending'
  created_at: string
}

export async function getUbkiAudit(): Promise<AuditLogItem[]> {
  const r = await api.get<AuditLogItem[]>('/api/v1/ubki/audit')
  return r.data
}

export async function exportUbkiAudit(): Promise<Blob> {
  const r = await api.get('/api/v1/ubki/audit/export', { responseType: 'blob' })
  return r.data as Blob
}

export function useUbkiAudit() {
  return useQuery({ queryKey: ['ubki-audit'], queryFn: getUbkiAudit, staleTime: 15_000 })
}

// ── KPIs (Overview cards) ────────────────────────────────────────────────────
export interface UbkiKpis {
  total_submissions: number
  total_delta_pct: number
  success: number
  success_delta_pct: number
  failed: number
  failed_error_codes: number
  pending: number
  opt_out: number
}

export interface UbkiKpisParams {
  date_from?: string
  date_to?: string
}

export async function getUbkiKpis(params: UbkiKpisParams = {}): Promise<UbkiKpis> {
  const r = await api.get<UbkiKpis>('/api/v1/ubki/kpis', { params })
  return r.data
}

export function useUbkiKpis(params: UbkiKpisParams = {}) {
  return useQuery({
    queryKey: ['ubki-kpis', params],
    queryFn: () => getUbkiKpis(params),
    staleTime: 15_000,
  })
}

// ── Connection / Test-connection (Overview → Connection settings) ────────────
export interface UbkiConnectionInfo {
  environment: string
  auth_url: string | null
  login: string | null
  credentials_configured: boolean
  connected: boolean
  session_id: string | null
  expires_at: string | null
}

export interface UbkiTestResult {
  connected: boolean
  environment: string
  auth_url: string | null
  login: string | null
  session_id: string | null
  expires_at: string | null
  error: string | null
}

export async function getUbkiConnection(): Promise<UbkiConnectionInfo> {
  const r = await api.get<UbkiConnectionInfo>('/api/v1/ubki/connection')
  return r.data
}

export async function testUbkiConnection(): Promise<UbkiTestResult> {
  const r = await api.post<UbkiTestResult>('/api/v1/ubki/test-connection')
  return r.data
}

export interface UbkiConnectionUpdate {
  environment?: string
  endpoint_url?: string
  login?: string
  password?: string
}

export async function updateUbkiConnection(
  payload: UbkiConnectionUpdate
): Promise<UbkiConnectionInfo> {
  const r = await api.put<UbkiConnectionInfo>('/api/v1/ubki/connection', payload)
  return r.data
}

export function useUpdateUbkiConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateUbkiConnection,
    onSuccess: (data) => qc.setQueryData(['ubki-connection'], data),
  })
}

export function useUbkiConnection() {
  return useQuery({ queryKey: ['ubki-connection'], queryFn: getUbkiConnection, staleTime: 60_000 })
}

export function useTestUbkiConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: testUbkiConnection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ubki-audit'] }),
  })
}
