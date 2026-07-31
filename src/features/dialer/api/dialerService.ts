import { DialerHttpService } from './dialerHttpService'

export type DialerService = DialerHttpService

export const dialerService: DialerService = new DialerHttpService()

export default dialerService
