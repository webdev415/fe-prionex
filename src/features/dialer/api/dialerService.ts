import api from '@/lib/api'

import type {
  DialerQueue,
  DialerSession,
  OperatorDialerStats,
  PagedDialerQueues,
  QueueNumber,
  QueueStatusCounts,
  QueueUploadMode,
  QueueUploadResult,
  SimCardStats,
} from '../types'

/**
 * Dialer service REST client (KAN-379).
 *
 * All requests go through the Kong gateway on the shared API base URL, mirroring
 * `features/calls/api/callService.ts`. Endpoint paths are the FE-expected
 * contract (see repo-docs/frontend/KAN-379-aggressive-dialer-frontend-plan.md §6)
 * and must be confirmed against the dialer backend service.
 */
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8000'

const base = `${API_BASE_URL}/api/v1/dialer`

class DialerService {
  // --- Queues (supervisor) ---
  async listQueues(params?: {
    department_id?: number
    active_only?: boolean
    q?: string
  }): Promise<DialerQueue[]> {
    const response = await api.get(`${base}/queues`, { params })
    return response.data
  }

  /** Server-side filtered/searched/paginated Queue List (supervisor table). */
  async listQueuesPaged(params: {
    page: number
    page_size: number
    active_only?: boolean
    q?: string
    department_id?: number
  }): Promise<PagedDialerQueues> {
    const response = await api.get(`${base}/queues/paged`, { params })
    return response.data
  }

  async getQueue(queueId: number): Promise<DialerQueue> {
    const response = await api.get(`${base}/queues/${queueId}`)
    return response.data
  }

  async createQueue(payload: Partial<DialerQueue>): Promise<DialerQueue> {
    const response = await api.post(`${base}/queues`, payload)
    return response.data
  }

  async updateQueue(queueId: number, payload: Partial<DialerQueue>): Promise<DialerQueue> {
    const response = await api.put(`${base}/queues/${queueId}`, payload)
    return response.data
  }

  async deleteQueue(queueId: number): Promise<void> {
    await api.delete(`${base}/queues/${queueId}`)
  }

  async setQueueActive(queueId: number, isActive: boolean): Promise<DialerQueue> {
    const response = await api.patch(`${base}/queues/${queueId}/active`, { is_active: isActive })
    return response.data
  }

  // --- Numbers (supervisor) ---
  async getQueueStatus(queueId: number): Promise<QueueStatusCounts> {
    const response = await api.get(`${base}/queues/${queueId}/status`)
    return response.data
  }

  /**
   * Dry-run: upload the CSV, validate every record server-side (dedupe +
   * confirm each phone exists in the client's contacts), and return the
   * counts + a token. Nothing is added to the queue yet.
   */
  async previewQueueUpload(queueId: number, file: File): Promise<QueueUploadResult> {
    const form = new FormData()
    form.append('file', file)
    const response = await api.post(`${base}/queues/${queueId}/numbers/preview`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  }

  /** Commit a previously previewed batch into the queue. */
  async confirmQueueUpload(
    queueId: number,
    uploadToken: string,
    mode: QueueUploadMode
  ): Promise<{ added_count: number }> {
    const response = await api.post(`${base}/queues/${queueId}/numbers/confirm`, {
      upload_token: uploadToken,
      mode,
    })
    return response.data
  }

  async addClientsFromCrm(queueId: number, clientIds: number[]): Promise<{ added_count: number }> {
    const response = await api.post(`${base}/queues/${queueId}/numbers/from-crm`, {
      client_ids: clientIds,
    })
    return response.data
  }

  async listQueueNumbers(queueId: number): Promise<QueueNumber[]> {
    const response = await api.get(`${base}/queues/${queueId}/numbers`)
    return response.data
  }

  // --- Operator session ---
  async getMySession(): Promise<DialerSession> {
    const response = await api.get(`${base}/sessions/me`)
    return response.data
  }

  async joinQueue(queueId: number, autoConnect: boolean): Promise<DialerSession> {
    const response = await api.post(`${base}/sessions/join`, {
      queue_id: queueId,
      auto_connect: autoConnect,
    })
    return response.data
  }

  async leaveQueue(): Promise<void> {
    await api.post(`${base}/sessions/leave`)
  }

  // --- Statistics (supervisor Analysis tab) ---
  async getOperatorStats(params?: {
    queue_id?: number
    operator_id?: number
    date_from?: string
    date_to?: string
  }): Promise<OperatorDialerStats[]> {
    const response = await api.get(`${base}/stats/operators`, { params })
    return response.data
  }

  async getSimStats(params?: { queue_id?: number }): Promise<SimCardStats[]> {
    const response = await api.get(`${base}/stats/sim-cards`, { params })
    return response.data
  }
}

export const dialerService = new DialerService()
export default dialerService
