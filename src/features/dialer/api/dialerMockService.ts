import type { ClientCallSummary, DialerQueue, DialerSession } from '../types'
import { MOCK_QUEUES, mockClientCallSummary } from '../mocks/fixtures'
import { DialerHttpService } from './dialerHttpService'

const LATENCY_MS = 350

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

export class DialerMockService extends DialerHttpService {
  private session: DialerSession = {
    queue_id: null,
    status: 'not_connected',
    auto_connect: false,
  }

  override async listQueues(): Promise<DialerQueue[]> {
    return delay(MOCK_QUEUES.map((q) => ({ ...q })))
  }

  override async getMySession(): Promise<DialerSession> {
    return delay({ ...this.session })
  }

  override async joinQueue(queueId: number, autoConnect: boolean): Promise<DialerSession> {
    const queue = MOCK_QUEUES.find((q) => q.id === queueId)
    this.session = {
      queue_id: queueId,
      status: queue && (queue.total_in_queue ?? 0) > 0 ? 'active' : 'paused',
      auto_connect: autoConnect,
    }
    return delay({ ...this.session })
  }

  override async leaveQueue(): Promise<void> {
    this.session = { queue_id: null, status: 'not_connected', auto_connect: false }
    return delay(undefined)
  }

  override async getClientCallSummary(clientId: number): Promise<ClientCallSummary> {
    return delay(mockClientCallSummary(clientId))
  }
}
