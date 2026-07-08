/**
 * UBKI Integration — types + mock data.
 *
 * Frontend-first build: the parts of the design without a backend yet
 * (connection config / test-connection, KPI aggregates, per-row payloads,
 * settings, audit) are backed by this mock data. Anything marked
 * `// TODO(ubki-backend)` is a placeholder to be wired to a real API later.
 * The submission-log LIST is the one piece already served by
 * `GET /api/v1/ubki/logs`.
 */

export type UbkiEnv = 'test' | 'production'
export type SubmissionStatus = 'success' | 'failed' | 'pending'
export type SubmissionType = 'Outbound' | 'Inbound'
export type SubmissionMode = 'Auto' | 'Manual'

export interface UbkiConnection {
  env: UbkiEnv
  endpointUrl: string
  login: string
  connected: boolean
  sessionId: string
  lastChecked: string
  authExpiresIn: string
}

export interface UbkiKpis {
  totalSubmissions: number
  totalDeltaPct: number
  success: number
  successDeltaPct: number
  failed: number
  failedErrorCodes: number
  pending: number
  optOut: number
}

export interface SubmissionLogRow {
  id: string
  dateTime: string
  type: SubmissionType
  mode: SubmissionMode
  clientName: string
  clientTin: string
  creditContract: string
  status: SubmissionStatus
  error: string | null
  operator: string
}

export interface TimelineStep {
  label: string
  detail?: string
  time: string
  state: 'ok' | 'error' | 'info'
}

export interface SubmissionDetail extends SubmissionLogRow {
  clientId: string
  creditDate: string
  timeline: TimelineStep[]
  errorBanner?: { code: string; message: string }
  requestPayload: string
  responsePayload: string
  executionLog: string
  adminNotes: string
}

// TODO(ubki-backend): connection config is env-only today; needs a read/update API.
export const MOCK_CONNECTION: UbkiConnection = {
  env: 'test',
  endpointUrl: 'https://secure.ubki.ua/b2_api_xml/ubki/api',
  login: '',
  connected: true,
  sessionId: 'a3b2c1d4-e5f6',
  lastChecked: '13:42, 26.06.2025',
  authExpiresIn: '5h 23m',
}

// TODO(ubki-backend): KPI aggregates — no stats endpoint yet.
export const MOCK_KPIS: UbkiKpis = {
  totalSubmissions: 14287,
  totalDeltaPct: 4.2,
  success: 14198,
  successDeltaPct: 98,
  failed: 77,
  failedErrorCodes: 5,
  pending: 12,
  optOut: 347,
}

// Sample rows shaped like GET /api/v1/ubki/logs; replace with the real query.
export const MOCK_LOG_ROWS: SubmissionLogRow[] = [
  {
    id: '872501',
    dateTime: '26.06.2026\n14:32',
    type: 'Outbound',
    mode: 'Auto',
    clientName: 'Kovalenko Ivan',
    clientTin: 'TIN 2345678901',
    creditContract: '#887-412-A',
    status: 'success',
    error: null,
    operator: 'system',
  },
  {
    id: '872498',
    dateTime: '26.06.2026\n09:11',
    type: 'Outbound',
    mode: 'Auto',
    clientName: 'Сіменко Д.В.',
    clientTin: 'TIN 7736... ',
    creditContract: 'AG9758880',
    status: 'success',
    error: null,
    operator: 'system',
  },
  {
    id: '872491',
    dateTime: '26.06.2026\n09:12',
    type: 'Outbound',
    mode: 'Auto',
    clientName: 'Vaishchak Kateryna',
    clientTin: 'TIN 3467890011',
    creditContract: 'AG9758880',
    status: 'failed',
    error: 'ERR_401',
    operator: 'system',
  },
  {
    id: '872480',
    dateTime: '25.06.2026\n14:32',
    type: 'Inbound',
    mode: 'Manual',
    clientName: 'Petrenko Olena',
    clientTin: 'TIN 3456789012',
    creditContract: '#887-432-A',
    status: 'success',
    error: null,
    operator: 'Marina Y.',
  },
  {
    id: '872477',
    dateTime: '25.06.2026\n14:30',
    type: 'Outbound',
    mode: 'Auto',
    clientName: 'Sydorenko Mykola',
    clientTin: 'TIN 9876543210',
    creditContract: '#887-445-A',
    status: 'pending',
    error: null,
    operator: 'system',
  },
  {
    id: '872470',
    dateTime: '25.06.2026\n14:02',
    type: 'Outbound',
    mode: 'Auto',
    clientName: 'Bondarenko Yuliya',
    clientTin: 'TIN 2024... ',
    creditContract: '#CR-2024-0501',
    status: 'success',
    error: null,
    operator: 'system',
  },
  {
    id: '872461',
    dateTime: '25.06.2026\n11:48',
    type: 'Inbound',
    mode: 'Manual',
    clientName: 'Marchenko Pavlo',
    clientTin: 'TIN 9905... ',
    creditContract: '#CR-2024-0389',
    status: 'success',
    error: null,
    operator: 'Marina Y.',
  },
]

// ── Opt-out clients ─────────────────────────────────────────────────────────
export type OptOutReason = 'Legal request' | 'Data dispute' | 'Test client' | 'Other'

export interface OptOutClient {
  id: string
  clientName: string
  clientRef: string
  tin: string
  reason: OptOutReason
  setBy: string
  dateAdded: string
  note: string
}

// Partial opt-out backend exists (POST /opt-out/bulk) but reason/set-by/date are
// not stored yet — TODO(ubki-backend): opt-out metadata + list/CSV endpoints.
export const MOCK_OPTOUT: OptOutClient[] = [
  {
    id: '1',
    clientName: 'Грищенко Т.А.',
    clientRef: '#398765',
    tin: '2345678901',
    reason: 'Data dispute',
    setBy: 'Anastasia Koroleva',
    dateAdded: '32 days ago',
    note: 'Pending verification',
  },
  {
    id: '2',
    clientName: 'Іщенко О.В.',
    clientRef: '#398765',
    tin: '3456789012',
    reason: 'Legal request',
    setBy: 'Svetlana Petrenko',
    dateAdded: '22.06.2026',
    note: 'Client filed GDPR request',
  },
  {
    id: '3',
    clientName: 'Kovalenko Ivan',
    clientRef: '#421013',
    tin: '9876543210',
    reason: 'Legal request',
    setBy: 'Viktor Hrytsenko',
    dateAdded: '38 days ago',
    note: '—',
  },
  {
    id: '4',
    clientName: 'Ковальчук М.О.',
    clientRef: '#411022',
    tin: '2345678900',
    reason: 'Test client',
    setBy: 'Yulia Melnyk',
    dateAdded: '61 days ago',
    note: 'Internal test record',
  },
  {
    id: '5',
    clientName: 'Kovalenko Ivan',
    clientRef: '#411022',
    tin: '2345678901',
    reason: 'Data dispute',
    setBy: 'Mykola Petrov',
    dateAdded: '32 days ago',
    note: 'Excluded per agreement with primary creditor',
  },
  {
    id: '6',
    clientName: 'Дудник Я.І.',
    clientRef: '#398765',
    tin: '2345678900',
    reason: 'Test client',
    setBy: 'Dmytro Shevchenko',
    dateAdded: '61 days ago',
    note: '—',
  },
  {
    id: '7',
    clientName: 'Дудник Я.І.',
    clientRef: '#398765',
    tin: '8765432109',
    reason: 'Data dispute',
    setBy: 'Kateryna Sokolova',
    dateAdded: '38 days ago',
    note: 'Excluded per agreement with primary creditor',
  },
]

// ── Audit log ───────────────────────────────────────────────────────────────
export type AuditStatus = 'success' | 'failed' | 'pending'

export interface AuditEntry {
  id: string
  dateTime: string
  event: string
  performedBy: string
  details: string
  status: AuditStatus
}

// TODO(ubki-backend): UBKI-scoped audit endpoint (config changes / admin actions).
export const MOCK_AUDIT: AuditEntry[] = [
  {
    id: '1',
    dateTime: '26.06.2026\n14:32',
    event: 'Updated Settings',
    performedBy: 'System',
    details: 'Changed schedule from 02:00 to 03:00 (Europe/Kyiv).',
    status: 'success',
  },
  {
    id: '2',
    dateTime: '26.06.2026\n09:11',
    event: 'Tested Connection',
    performedBy: 'Sophia Johnson',
    details: 'Production environment: Session a3f2-b8c1-…-7f9 obtained.',
    status: 'success',
  },
  {
    id: '3',
    dateTime: '26.06.2026\n09:12',
    event: 'Added Client to Opt-out',
    performedBy: 'Liam Smith',
    details: 'Client #398765 (Grishenko T.A.) added to opt-out list. Reason: Data dispute.',
    status: 'success',
  },
  {
    id: '4',
    dateTime: '26.06.2026\n14:32',
    event: 'Connection Alert',
    performedBy: 'Olivia Brown',
    details: 'UBKI authentication failed for 17 minutes. Connection recovered automatically.',
    status: 'failed',
  },
  {
    id: '5',
    dateTime: '26.06.2026\n14:30',
    event: 'Bulk Submission',
    performedBy: 'Noah Davis',
    details: 'Submitted 157 credit records using filter: 01.06–10.06. Status: Active.',
    status: 'success',
  },
  {
    id: '6',
    dateTime: '26.06.2026\n14:28',
    event: 'Updated Credentials',
    performedBy: 'Emma Wilson',
    details: 'Production environment credentials rotated.',
    status: 'pending',
  },
  {
    id: '7',
    dateTime: '25.06.2026\n15:44',
    event: 'Changed Retry Policy',
    performedBy: 'Aiden Martinez',
    details: 'Max retry attempts changed 5 → 3. Retry interval 10 min → 15 min.',
    status: 'failed',
  },
  {
    id: '8',
    dateTime: '25.06.2026\n15:22',
    event: 'Imported Opt-out CSV',
    performedBy: 'Isabella Garcia',
    details: 'Imported 42 clients from opt-out.csv (2 skipped, invalid TIN).',
    status: 'success',
  },
]

// TODO(ubki-backend): per-row detail (payloads/exec-log/notes) — not stored yet.
export function mockDetailFor(row: SubmissionLogRow): SubmissionDetail {
  const failed = row.status === 'failed'
  return {
    ...row,
    clientId: '#387485',
    creditDate: 'AG9758880 · 26.06.2026 09:12:34',
    timeline: [
      {
        label: 'Created',
        detail: 'Submission queued · ID: sub_12346',
        time: '13:42:01',
        state: 'ok',
      },
      {
        label: 'Sent to UBKI',
        detail: 'XML request dispatched to endpoint',
        time: '13:42:03',
        state: 'ok',
      },
      {
        label: 'Response received',
        detail: failed ? 'ERR_401 Unauthorized' : 'OK',
        time: '13:42:15',
        state: failed ? 'error' : 'ok',
      },
      ...(failed
        ? [
            {
              label: 'Retry scheduled',
              detail: 'Next attempt in 15 min (retry 1/3)',
              time: '13:42:20',
              state: 'info' as const,
            },
          ]
        : []),
    ],
    errorBanner: failed
      ? {
          code: 'ERR_401 — Unauthorized',
          message:
            'Authentication failed. Session token expired or invalid credentials. Verify Login / Password — run Test connection.',
        }
      : undefined,
    requestPayload:
      '<?xml version="1.0" encoding="UTF-8"?>\n<doc xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <ubki Req_id="REQ-12346" Doc_typ="1" U_id="12345" Pasp="****" LanguageID="UA"/>\n  <ubkidat><ubki i_n f_nm="Петров" l_nm="Отенко1" ... /></ubkidat>\n</doc>',
    responsePayload: failed
      ? '{"error":"AUTH_FAILED","code":401,\n "message":"Invalid credentials / session expired",\n "timestamp":"2026-06-26T13:42:05"}'
      : '{"status":"ok","reqid":"REQ-12346"}',
    executionLog:
      'INFO  13:42:01 Submission created  id=sub_12346\nINFO  13:42:01 Building XML payload  fields=12\nINFO  13:42:03 Request dispatched  size=1.4 KB\nWARN  13:42:04 Slow response  elapsed=1128ms\n' +
      (failed
        ? 'FAIL  13:42:05 AUTH_FAILED — session expired\nWARN  13:42:05 Retry 1/3 scheduled  next=+900s'
        : 'INFO  13:42:05 Response OK'),
    adminNotes: '',
  }
}
