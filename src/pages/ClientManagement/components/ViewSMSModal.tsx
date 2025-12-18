/**
 * View SMS Modal Component
 *
 * Modal for viewing detailed SMS information.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface ViewSMSModalProps {
  open: boolean
  onClose: () => void
  smsData: {
    date: string
    time: string
    template: string
    operator: string
    status: string
    message: string
    phone: string
  }
}

const formatDateTime = (dateStr: string, timeStr: string) => {
  try {
    const date = new Date(dateStr)
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()

    // Format time (assuming timeStr is in HH:MM format)
    const [hours, minutes] = timeStr.split(':')
    const hour12 = parseInt(hours, 10) % 12 || 12
    const ampm = parseInt(hours, 10) >= 12 ? 'PM' : 'AM'
    const formattedTime = `${hour12}:${minutes}:00 ${ampm}`

    return `${month} ${day}, ${year} ${formattedTime}`
  } catch {
    return `${dateStr} ${timeStr}`
  }
}

const calculateSMSParts = (message: string): number => {
  // Standard SMS: 160 characters for single-byte, 70 for multi-byte (Cyrillic)
  // For simplicity, assume Cyrillic if message contains Cyrillic characters
  const hasCyrillic = /[А-Яа-яЁё]/.test(message)
  const maxLength = hasCyrillic ? 70 : 160
  return Math.ceil(message.length / maxLength)
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Delivered':
      return 'bg-success-100 text-success-700'
    case 'Failed':
      return 'bg-error-100 text-error-700'
    case 'Pending':
      return 'bg-warning-100 text-warning-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function ViewSMSModal({ open, onClose, smsData }: ViewSMSModalProps) {
  const dateTime = formatDateTime(smsData.date, smsData.time)
  const smsParts = calculateSMSParts(smsData.message)
  const hasCyrillic = /[А-Яа-яЁё]/.test(smsData.message)
  const maxChars = hasCyrillic ? 70 : 160
  const charCount = smsData.message.length
  const cost = smsParts * 1.0 // Assuming 1.00 per SMS part

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl" className="p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <ModalHeader
          icon={
            <div className="bg-primary-300 flex h-12 w-12 items-center justify-center rounded-full">
              <Icons.ChatFeedback01 size={24} className="text-dark-500" strokeWidth={1.5} />
            </div>
          }
          title="View SMS"
        />

        {/* SMS Details */}
        <ModalContent>
          <div className="flex flex-col gap-4">
            {/* Date/Time, Template, Operator, Status */}
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="flex items-start gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                  Date/Time:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {dateTime}
                </span>
              </div>
              <div className="flex items-start gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                  Template:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {smsData.template}
                </span>
              </div>
              <div className="flex items-start gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                  Operator:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {smsData.operator}
                </span>
              </div>
              <div className="flex items-start gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                  Status:
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                    getStatusColor(smsData.status)
                  )}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      smsData.status === 'Delivered'
                        ? 'bg-success-500'
                        : smsData.status === 'Failed'
                          ? 'bg-error-500'
                          : 'bg-warning-500'
                    )}
                  />
                  {smsData.status}
                </span>
              </div>
            </div>
            <div className="flex h-px flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>
            {/* Message Content */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-light text-gray-700">Message:</label>
              <textarea
                readOnly
                value={smsData.message}
                className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 min-h-[100px] resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-light focus:ring-2 focus:outline-none"
              />
            </div>

            {/* Message Metrics */}
            <div className="rounded-lg border border-gray-200 bg-gray-100 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <span className="bg-success-500 h-2 w-2 rounded-full" />
                  <span className="text-sm font-light text-gray-700">
                    {charCount}/{maxChars} characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.File size={16} className="text-gray-600" />
                  <span className="text-sm font-light text-gray-700">
                    Script:{' '}
                    <span className="text-dark-500 font-semibold">
                      {hasCyrillic ? 'Cyrillic' : 'Latin'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Mail size={16} className="text-gray-600" />
                  <span className="text-sm font-light text-gray-700">
                    {smsParts} SMS part{smsParts !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.MoneyRemove01 size={16} className="text-gray-600" />
                  <span className="text-sm font-light text-gray-700">
                    Cost: <span className="text-dark-500 font-semibold">₴{cost.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Timestamps */}
            <div className="flex items-start gap-3 self-stretch">
              <div className="flex flex-1 items-center gap-2">
                <span className="text-dark-500 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Sent:
                </span>
                <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {dateTime}
                </span>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <span className="text-dark-500 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Delivered:
                </span>
                <span className="text-dark-500 flex-1 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {dateTime}
                </span>
              </div>
            </div>
          </div>
        </ModalContent>

        {/* Footer */}
        <ModalFooter>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="text-dark-500 w-full border-gray-400 bg-white hover:bg-gray-50"
          >
            Close
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default ViewSMSModal
