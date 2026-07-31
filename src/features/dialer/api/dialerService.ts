import { DialerHttpService } from './dialerHttpService'
import { DialerMockService } from './dialerMockService'

export const USE_DIALER_MOCK = import.meta.env.VITE_DIALER_MOCK !== 'false'

export type DialerService = DialerHttpService

export const dialerService: DialerService = USE_DIALER_MOCK
  ? new DialerMockService()
  : new DialerHttpService()

export default dialerService
