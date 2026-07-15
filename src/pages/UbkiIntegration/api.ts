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
  limit?: number
  offset?: number
  status?: string[]
  mode?: string[]
  error_code?: string[]
  operator?: string[]
  search?: string
  date_from?: string
  date_to?: string
  debt_id?: number
  batch_id?: string
}

export interface SubmissionLogPage {
  items: UbkiLogItem[]
  total: number
}

export async function getUbkiLogs(params: UbkiLogsParams = {}): Promise<SubmissionLogPage> {
  // Build the query manually so array filters serialize as repeated keys
  // (status=a&status=b), which is what FastAPI's list[str] query expects.
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  params.status?.forEach((v) => qs.append('status', v))
  params.mode?.forEach((v) => qs.append('mode', v))
  params.error_code?.forEach((v) => qs.append('error_code', v))
  params.operator?.forEach((v) => qs.append('operator', v))
  if (params.search) qs.set('search', params.search)
  if (params.date_from) qs.set('date_from', params.date_from)
  if (params.date_to) qs.set('date_to', params.date_to)
  if (params.debt_id != null) qs.set('debt_id', String(params.debt_id))
  if (params.batch_id) qs.set('batch_id', params.batch_id)
  const r = await api.get<SubmissionLogPage>(`/api/v1/ubki/logs?${qs.toString()}`)
  return r.data
}

export interface LogFacetOperator {
  value: string
  label: string
}
export interface SubmissionLogFacets {
  error_codes: string[]
  operators: LogFacetOperator[]
}

export async function getUbkiLogFacets(): Promise<SubmissionLogFacets> {
  const r = await api.get<SubmissionLogFacets>('/api/v1/ubki/logs/facets')
  return r.data
}

export function useUbkiLogFacets() {
  return useQuery({ queryKey: ['ubki-log-facets'], queryFn: getUbkiLogFacets, staleTime: 60_000 })
}

/** Backend status vocabulary (success | error | skipped) → the table's pill states. */
function mapStatus(status: string): SubmissionStatus {
  if (status === 'success') return 'success'
  if (status === 'error') return 'failed'
  return 'pending' // skipped / anything else
}

/** Map a real log item to the row shape the table + drawer already use. */
export function mapLogItemToRow(item: UbkiLogItem, timezone?: string | null): SubmissionLogRow {
  return {
    id: String(item.id),
    dateTime: formatDateTime(item.created_at, timezone),
    type: 'Outbound', // submission logs are outbound; backend has no in/out flag
    mode:
      item.mode?.toLowerCase() === 'automatic'
        ? 'Auto'
        : item.mode?.toLowerCase() === 'bulk'
          ? 'Bulk'
          : 'Manual',
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
      // A resend creates a NEW log row (the old attempt stays as history) and
      // moves the counters. Refresh the list, KPIs, and any open detail.
      qc.invalidateQueries({ queryKey: ['ubki-logs'] })
      qc.invalidateQueries({ queryKey: ['ubki-kpis'] })
      qc.invalidateQueries({ queryKey: ['ubki-log-detail'] })
    },
  })
}

// ── Settings (GET / PUT /api/v1/ubki/settings) ───────────────────────────────
export interface UbkiSettings {
  auto_submit_enabled: boolean
  send_time: string // "HH:MM"
  timezone: string
  frequency: 'daily' | 'weekdays' | 'custom'
  custom_days: string[] // weekdays for frequency='custom' (mon..sun)
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

/** Trigger the automatic-submission pipeline immediately (Settings → Send now). */
export async function runAutoSubmitNow(): Promise<{ status: string; task_id: string }> {
  const r = await api.post<{ status: string; task_id: string }>('/api/v1/ubki/auto-submit/run-now')
  return r.data
}

export function useRunAutoSubmitNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: runAutoSubmitNow,
    // Refresh the log/KPIs shortly after so the new attempts show up.
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['ubki-logs'] })
        qc.invalidateQueries({ queryKey: ['ubki-kpis'] })
      }, 1500)
    },
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

export async function addOptOut(payload: { tins: string[]; reason: string; note?: string }) {
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
    fd,
    // Override the axios instance's default application/json so the browser sets
    // the multipart boundary — otherwise the backend can't read the file field.
    { headers: { 'Content-Type': 'multipart/form-data' } }
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

export interface AuditLogPage {
  items: AuditLogItem[]
  total: number
}

export interface UbkiAuditParams {
  limit?: number
  offset?: number
  event_type?: string[]
  actor?: string[]
  search?: string
  date_from?: string
  date_to?: string
}

export async function getUbkiAudit(params: UbkiAuditParams = {}): Promise<AuditLogPage> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  params.event_type?.forEach((v) => qs.append('event_type', v))
  params.actor?.forEach((v) => qs.append('actor', v))
  if (params.search) qs.set('search', params.search)
  if (params.date_from) qs.set('date_from', params.date_from)
  if (params.date_to) qs.set('date_to', params.date_to)
  const r = await api.get<AuditLogPage>(`/api/v1/ubki/audit?${qs.toString()}`)
  return r.data
}

export interface AuditFacets {
  actors: string[]
  event_types: string[]
}

export async function getUbkiAuditFacets(): Promise<AuditFacets> {
  const r = await api.get<AuditFacets>('/api/v1/ubki/audit/facets')
  return r.data
}

export async function exportUbkiAudit(params: UbkiAuditParams = {}): Promise<Blob> {
  // Same filters as the list (limit/offset are ignored by the export endpoint).
  const qs = new URLSearchParams()
  params.event_type?.forEach((v) => qs.append('event_type', v))
  params.actor?.forEach((v) => qs.append('actor', v))
  if (params.search) qs.set('search', params.search)
  if (params.date_from) qs.set('date_from', params.date_from)
  if (params.date_to) qs.set('date_to', params.date_to)
  const r = await api.get(`/api/v1/ubki/audit/export?${qs.toString()}`, { responseType: 'blob' })
  return r.data as Blob
}

export function useUbkiAudit(params: UbkiAuditParams = {}) {
  return useQuery({
    queryKey: ['ubki-audit', params],
    queryFn: () => getUbkiAudit(params),
    staleTime: 15_000,
  })
}

export function useUbkiAuditFacets() {
  return useQuery({
    queryKey: ['ubki-audit-facets'],
    queryFn: getUbkiAuditFacets,
    staleTime: 60_000,
  })
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

export interface UbkiConnectionCredentials {
  login: string | null
  password: string | null
}

// Decrypted login/password to pre-fill the editor (admin-only, fetched on Edit).
export async function getUbkiConnectionCredentials(): Promise<UbkiConnectionCredentials> {
  const r = await api.get<UbkiConnectionCredentials>('/api/v1/ubki/connection/credentials')
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
