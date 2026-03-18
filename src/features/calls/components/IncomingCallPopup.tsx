import { MdClose, MdPhone, MdPhoneDisabled, MdDescription } from 'react-icons/md'
import type { IncomingCallData } from '../types'

interface IncomingCallPopupProps {
  callData: IncomingCallData
  onAnswer: (callId: string) => void
  onReject: (callId: string) => void
  onDismiss: () => void
}

export function IncomingCallPopup({
  callData,
  onAnswer,
  onReject,
  onDismiss,
}: IncomingCallPopupProps) {
  const formatCurrency = (amount: string | number): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '₴0.00'
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 2,
    }).format(num)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      className="animate-pulse-subtle fixed top-4 right-4 z-50 w-96 rounded-lg border-2 border-blue-500 bg-white shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-lg bg-blue-500 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <MdPhone className="h-5 w-5 animate-bounce" />
          <h2 id="incoming-call-title" className="text-lg font-semibold">
            Incoming Call
          </h2>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Close incoming call notification"
          className="rounded p-1 transition-colors hover:bg-blue-600"
        >
          <MdClose className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4 p-4">
        {/* Customer Info */}
        <div>
          <p className="text-2xl font-bold text-gray-900">{callData.customer_phone}</p>
          {callData.client_name && (
            <p className="mt-1 text-lg text-gray-700">{callData.client_name}</p>
          )}
        </div>

        {/* Loan Summary */}
        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Loans:</span>
            <span className="font-semibold text-gray-900">
              {callData.loan_count} {callData.loan_count === 1 ? 'loan' : 'loans'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Debt:</span>
            <span className="font-bold text-red-600">{formatCurrency(callData.total_debt)}</span>
          </div>
        </div>

        {/* Loan List */}
        {callData.loans.length > 0 && (
          <div className="space-y-2">
            <h3 className="flex items-center gap-1 text-sm font-semibold text-gray-700">
              <MdDescription className="h-4 w-4" />
              Loan Details
            </h3>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {callData.loans.map((loan) => (
                <div
                  key={loan.loan_id}
                  className="rounded border border-gray-200 bg-white p-2 text-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{loan.contract_number}</p>
                      <p className="text-xs text-gray-500 capitalize">{loan.status}</p>
                    </div>
                    <p className="font-semibold text-red-600">
                      {formatCurrency(loan.remaining_debt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => onAnswer(callData.call_id)}
            aria-label="Answer call"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
          >
            <MdPhone className="h-5 w-5" />
            Answer
          </button>
          <button
            onClick={() => onReject(callData.call_id)}
            aria-label="Reject call"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
          >
            <MdPhoneDisabled className="h-5 w-5" />
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
