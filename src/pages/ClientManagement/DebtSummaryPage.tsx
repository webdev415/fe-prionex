/**
 * Debt Summary Page
 *
 * Displays customer debt summary with payment progress and payment history.
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { RecordPaymentModal } from './components/RecordPaymentModal'
import { useClient } from '@/features/clients/hooks/useClients'

// Import the same mock client data structure from ClientDetailPage
// Helper function to create mock client detail (same as ClientDetailPage)
const createMockClientDetail = (
  id: number,
  fullName: string,
  taxIdNumber: string,
  phoneNumber: string,
  tags: string[],
  priority: 'Critical' | 'High' | 'Medium' | 'Low',
  score: number
) => ({
  id,
  fullName,
  taxIdNumber,
  dateOfBirth:
    id === 1
      ? '09/05/1904'
      : id === 2
        ? '15/08/1985'
        : id === 3
          ? '22/11/1990'
          : id === 4
            ? '03/02/1988'
            : id === 5
              ? '18/07/1992'
              : id === 6
                ? '25/09/1987'
                : '12/04/1991',
  region:
    id === 1
      ? 'Lviv'
      : id === 2
        ? 'Kyiv'
        : id === 3
          ? 'Kharkiv'
          : id === 4
            ? 'Odesa'
            : id === 5
              ? 'Dnipro'
              : id === 6
                ? 'Zaporizhzhia'
                : 'Lviv',
  age:
    id === 1
      ? 41
      : id === 2
        ? 39
        : id === 3
          ? 34
          : id === 4
            ? 36
            : id === 5
              ? 32
              : id === 6
                ? 37
                : 33,
  userNumber: taxIdNumber.slice(0, 9),
  contactStatus: 'Contactable',
  incomeLevel:
    id === 1
      ? 9000.0
      : id === 2
        ? 12000.0
        : id === 3
          ? 7500.0
          : id === 4
            ? 11000.0
            : id === 5
              ? 8500.0
              : id === 6
                ? 13000.0
                : 9500.0,
  score,
  priority,
  department: 'Credit',
  credit: 'Credit',
  responsibleEmployee:
    id === 1
      ? 'Sofia Andreevna Belova'
      : id === 2
        ? 'Maria Ivanovna Petrova'
        : id === 3
          ? 'Anna Sergeevna Sidorova'
          : id === 4
            ? 'Elena Dmitrievna Kozlova'
            : id === 5
              ? 'Olga Nikolaevna Morozova'
              : id === 6
                ? 'Tatiana Vladimirovna Volkova'
                : 'Natalia Alexandrovna Sokolova',
  phones: [
    { number: phoneNumber, type: 'primary' as const },
    {
      number: phoneNumber.replace(/(\d{2})(\d{3})(\d{4})/, '$1$2$3' + (id + 10)),
      type: 'secondary' as const,
    },
  ],
  tags,
  loans: [
    {
      id: 1,
      loanNumber: String(30 + id),
      counterparty: id === 1 ? 'Gamma' : id === 2 ? 'Alpha Corp' : 'Beta Solutions',
      saleDate: `0${id}.23.2023`,
      loanAmount: 20000 + id * 1000,
      principalDebt: 10000 + id * 500,
      totalToRepay: 60000 + id * 5000,
    },
  ],
  payments: [
    {
      id: 1,
      loanNumber: String(30 + id),
      counterparty: id === 1 ? 'Gamma' : id === 2 ? 'Alpha Corp' : 'Beta Solutions',
      saleDate: `0${id}.23.2023`,
      paymentDate: `0${id}.23.2023`,
      amount: 20000 + id * 1000,
      paymentMethod: id % 2 === 0 ? 'Bank Transfer' : 'Card',
      status: id === 1 ? 'Failed' : id === 2 ? 'Pending' : 'Done',
      paymentDistribution: `₴ ${2000 + id * 100} loan body ₴ ${300 + id * 50} commisss`,
      employee: id === 1 ? 'Sidorov' : id === 2 ? 'Shevchenko' : 'Petrov',
    },
  ],
  personalDetails: {
    tin: taxIdNumber,
    dateOfBirth:
      id === 1
        ? '09/05/1904'
        : id === 2
          ? '15/08/1985'
          : id === 3
            ? '22/11/1990'
            : id === 4
              ? '03/02/1988'
              : id === 5
                ? '18/07/1992'
                : id === 6
                  ? '25/09/1987'
                  : '12/04/1991',
    age:
      id === 1
        ? 41
        : id === 2
          ? 39
          : id === 3
            ? 34
            : id === 4
              ? 36
              : id === 5
                ? 32
                : id === 6
                  ? 37
                  : 33,
    passport: taxIdNumber.slice(0, 10),
    maritalStatus: 'Contactable',
    familyMembers:
      id === 1 ? 5 : id === 2 ? 3 : id === 3 ? 4 : id === 4 ? 2 : id === 5 ? 6 : id === 6 ? 3 : 4,
  },
  addresses: {
    registrationAddress:
      id === 1
        ? '15 Garden Street, Kyiv, Ukraine, 01001'
        : id === 2
          ? '42 Main Avenue, Lviv, Ukraine, 79000'
          : id === 3
            ? '78 Central Boulevard, Kharkiv, Ukraine, 61000'
            : id === 4
              ? '23 Seaside Road, Odesa, Ukraine, 65000'
              : id === 5
                ? '56 River Street, Dnipro, Ukraine, 49000'
                : id === 6
                  ? '89 Park Lane, Zaporizhzhia, Ukraine, 69000'
                  : '34 Market Square, Lviv, Ukraine, 79000',
    personalAddress:
      id === 1
        ? '27 Maple Avenue, Lviv, Ukraine, 79000'
        : id === 2
          ? '91 Oak Drive, Kyiv, Ukraine, 01001'
          : id === 3
            ? '12 Pine Street, Kharkiv, Ukraine, 61000'
            : id === 4
              ? '45 Elm Road, Odesa, Ukraine, 65000'
              : id === 5
                ? '67 Birch Way, Dnipro, Ukraine, 49000'
                : id === 6
                  ? '89 Cedar Court, Zaporizhzhia, Ukraine, 69000'
                  : '23 Willow Path, Lviv, Ukraine, 79000',
  },
})

// Mock data array - same as ClientDetailPage
const mockClientsDetail = [
  createMockClientDetail(
    1,
    'Veronika Denisovna Lapina',
    '12145878778',
    '+380931234567',
    ['Bankrupt', 'Did not answer the phone'],
    'High',
    88
  ),
  createMockClientDetail(
    2,
    'Alexandra Petrovna Ilyina',
    '7896541230',
    '+380669876543',
    ['Insolvent', 'Deceiver'],
    'Medium',
    10
  ),
  createMockClientDetail(
    3,
    'Sofia Andreevna Belova',
    '1236547890',
    '+380735551212',
    ['Financially insolvent'],
    'Low',
    12
  ),
  createMockClientDetail(
    4,
    'Polina Antonovna Volkova',
    '9874563215',
    '+380502223434',
    ['Creditor', 'Con artist'],
    'Low',
    78
  ),
  createMockClientDetail(
    5,
    'Valeria Maksimovna Kuznetsova',
    '3692581470',
    '+380991115656',
    ['Insolvent', 'Fraudulent'],
    'Medium',
    34
  ),
  createMockClientDetail(
    6,
    'Ksenia Ilyinichna Sokolova',
    '1470369258',
    '+380634447878',
    ['Financially insolvent'],
    'High',
    56
  ),
  createMockClientDetail(
    7,
    'Victoria Egorovna Zhukova',
    '2589631470',
    '+380507778989',
    ['Employee', 'Con artist'],
    'Critical',
    45
  ),
]

// Types
interface Payment {
  id: number
  date: string
  amount: number
  method: 'Online' | 'Bank' | 'Card'
  status: 'Verified' | 'Pending' | 'Cancelled'
  receipt?: string
}

interface DebtSummaryData {
  customerName: string
  status: 'Active' | 'Paid' | 'Partially Paid' | 'Dispute' | 'Written off' | 'Sold' | 'Legal'
  progressPercentage: number
  totalPaid: number
  totalDebt: number
  daysPastDue: number
  lastPayment: {
    amount: number
    date: string
  }
  payments: Payment[]
  totalVerified: number
  pendingVerification: number
}

// Mock debt summary data - replace with actual API call
const getMockDebtSummary = (): Omit<DebtSummaryData, 'customerName'> => {
  return {
    status: 'Active',
    progressPercentage: 15,
    totalPaid: 15450.0,
    totalDebt: 125450.0,
    daysPastDue: 18,
    lastPayment: {
      amount: 5000.0,
      date: '10/11/2023',
    },
    payments: [
      {
        id: 1,
        date: '10/7/2023',
        amount: 10080,
        method: 'Online',
        status: 'Pending',
      },
      {
        id: 2,
        date: '10/6/2023',
        amount: 900,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 3,
        date: '10/7/2023',
        amount: 780,
        method: 'Online',
        status: 'Pending',
      },
      {
        id: 4,
        date: '10/8/2023',
        amount: 820,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 5,
        date: '10/9/2023',
        amount: 870,
        method: 'Online',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 6,
        date: '10/10/2023',
        amount: 810,
        method: 'Bank',
        status: 'Pending',
      },
      {
        id: 7,
        date: '10/11/2023',
        amount: 830,
        method: 'Bank',
        status: 'Cancelled',
      },
      {
        id: 8,
        date: '10/5/2023',
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 9,
        date: '10/11/2023',
        amount: 830,
        method: 'Bank',
        status: 'Cancelled',
      },
      {
        id: 10,
        date: '10/5/2023',
        amount: 850,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 11,
        date: '10/4/2023',
        amount: 920,
        method: 'Online',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 12,
        date: '10/3/2023',
        amount: 750,
        method: 'Bank',
        status: 'Pending',
      },
      {
        id: 13,
        date: '10/2/2023',
        amount: 680,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 14,
        date: '10/1/2023',
        amount: 950,
        method: 'Online',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 15,
        date: '9/30/2023',
        amount: 720,
        method: 'Bank',
        status: 'Pending',
      },
      {
        id: 16,
        date: '9/29/2023',
        amount: 880,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 17,
        date: '9/28/2023',
        amount: 640,
        method: 'Online',
        status: 'Cancelled',
      },
      {
        id: 18,
        date: '9/27/2023',
        amount: 790,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 19,
        date: '9/26/2023',
        amount: 910,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 20,
        date: '9/25/2023',
        amount: 560,
        method: 'Online',
        status: 'Pending',
      },
      {
        id: 21,
        date: '9/24/2023',
        amount: 1020,
        method: 'Bank',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 22,
        date: '9/23/2023',
        amount: 730,
        method: 'Card',
        status: 'Verified',
        receipt: 'receipt.pdf',
      },
      {
        id: 23,
        date: '9/22/2023',
        amount: 890,
        method: 'Online',
        status: 'Pending',
      },
    ],
    totalVerified: 100456,
    pendingVerification: 100456,
  }
}

export function DebtSummaryPage() {
  const { t, i18n } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [debtSummary, setDebtSummary] = useState<DebtSummaryData | null>(null)
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)

  // Fetch client data from API (same as ClientDetailPage)
  const clientId = id ? Number(id) : 0
  const {
    data: apiClient,
    isLoading: isLoadingClient,
    isError: isClientError,
    error: clientError,
  } = useClient(clientId, !!clientId)

  // Use mock data as fallback for missing fields until backend is fully integrated (same as ClientDetailPage)
  const client = useMemo(() => {
    if (!apiClient) return mockClientsDetail[0]

    const fullName = [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
      .filter(Boolean)
      .join(' ')

    // Map API client to expected shape, using mock data for fields not yet in API (same as ClientDetailPage)
    return {
      ...mockClientsDetail[0], // Fallback for fields not yet in backend
      id: apiClient.id,
      fullName,
      taxIdNumber: apiClient.tax_id,
      phoneNumber: apiClient.phone_primary,
      tags: [], // TODO: Add tags support in backend
      score: apiClient.priority_score,
      priority:
        apiClient.manual_priority ||
        (apiClient.priority_score >= 75
          ? 'Critical'
          : apiClient.priority_score >= 50
            ? 'High'
            : apiClient.priority_score >= 25
              ? 'Medium'
              : 'Low'),
      phones: [
        { number: apiClient.phone_primary, type: 'primary' as const },
        ...(apiClient.phone_secondary
          ? [{ number: apiClient.phone_secondary, type: 'secondary' as const }]
          : []),
      ],
      personalDetails: {
        ...mockClientsDetail[0].personalDetails,
        tin: apiClient.tax_id,
        dateOfBirth: apiClient.date_of_birth || mockClientsDetail[0].personalDetails.dateOfBirth,
      },
      addresses: {
        ...mockClientsDetail[0].addresses,
        registrationAddress:
          apiClient.address || mockClientsDetail[0].addresses.registrationAddress,
      },
    }
  }, [apiClient])

  // Get customer name from client object
  const customerName = client?.fullName || 'Unknown Client'

  // Load debt summary data
  useEffect(() => {
    if (customerName) {
      // TODO: Replace with actual API call to fetch debt summary
      // For now, use mock data but with real customer name from client data
      const mockData = getMockDebtSummary()
      const data: DebtSummaryData = {
        ...mockData,
        customerName,
      }
      // Simulate API delay
      setTimeout(() => {
        setDebtSummary(data)
      }, 500)
    }
  }, [customerName])

  // Show loading state while fetching client or debt summary
  if (isLoadingClient || !debtSummary) {
    return (
      <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between self-stretch">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-12 w-40 animate-pulse rounded-full bg-gray-200" />
        </div>

        {/* Main Content Skeleton */}
        <div className="flex items-start gap-5 self-stretch">
          {/* Left Panel Skeleton */}
          <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
            {/* Client Info Card Skeleton */}
            <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-6">
              {/* Client Name Skeleton */}
              <div className="flex flex-col items-center justify-center gap-4 self-stretch">
                <div className="flex items-center justify-center gap-4">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                  <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
              </div>

              {/* Progress Circle Skeleton */}
              <div className="mb-6 flex justify-center">
                <div className="relative flex h-[150px] w-[150px] items-center justify-center">
                  <div className="h-[150px] w-[150px] animate-pulse rounded-full bg-gray-200" />
                  <div className="absolute h-12 w-12 animate-pulse rounded-full bg-gray-300" />
                </div>
              </div>

              {/* Total Paid Skeleton */}
              <div className="flex flex-col items-center gap-5 self-stretch">
                <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
              </div>

              {/* Action Buttons Skeleton */}
              <div className="flex items-start gap-3">
                <div className="h-10 flex-1 animate-pulse rounded-full bg-gray-200" />
                <div className="h-10 flex-1 animate-pulse rounded-full bg-gray-200" />
              </div>
            </div>

            {/* Last Payment Card Skeleton */}
            <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white/100 bg-white/50 p-5 px-0">
              <div className="flex items-start justify-between self-stretch px-6">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="flex items-center justify-between self-stretch px-6 py-0">
                <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            </div>

            {/* Total Debt Card Skeleton */}
            <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6">
              <div className="flex items-start justify-between self-stretch px-6">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="flex items-center justify-between self-stretch px-6 py-0">
                <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          </div>

          {/* Right Panel Skeleton - Payment History Table */}
          <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-6">
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />

              {/* Table Skeleton */}
              <div className="w-full overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white">
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-left">
                        <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-right">
                        <div className="ml-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-left">
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-left">
                        <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] border-r border-[#EBECE8] px-6 text-center">
                        <div className="mx-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                      <th className="h-[49px] px-6 text-center">
                        <div className="mx-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 10 }).map((_, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}
                      >
                        <td className="h-[49px] border-r border-[#EBECE8] px-6">
                          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-6 text-right">
                          <div className="ml-auto h-4 w-24 animate-pulse rounded bg-gray-200" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-6">
                          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-6">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 animate-pulse rounded-full bg-gray-200" />
                            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                          </div>
                        </td>
                        <td className="h-[49px] border-r border-[#EBECE8] px-6 text-center">
                          <div className="mx-auto h-6 w-12 animate-pulse rounded bg-gray-200" />
                        </td>
                        <td className="h-[49px] px-6 text-center">
                          <div className="mx-auto h-6 w-24 animate-pulse rounded bg-gray-200" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* View All Link Skeleton */}
                <div className="flex items-center justify-center gap-[1px] self-stretch rounded-none border-x border-[#EBECE8]">
                  <div className="flex min-h-[49px] flex-1 items-center justify-center gap-1 bg-[linear-gradient(0deg,#f2f3f0,#f2f3f0),#ffffff] p-2 px-4">
                    <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>

                {/* Summary Row Skeleton */}
                <div className="flex w-full items-center justify-between border-[#EBECE8] bg-white">
                  <div className="flex flex-1 items-center border-r border-[#EBECE8] px-6 py-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="ml-4 h-4 w-24 animate-pulse rounded bg-gray-200" />
                  </div>
                  <div className="flex flex-1 items-center px-6 py-4">
                    <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                    <div className="ml-4 h-4 w-24 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state if client fetch failed
  if (isClientError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Icons.Warning className="text-error-500 h-8 w-8" strokeWidth={2} />
        <p className="font-medium text-gray-900">
          {t('pages.clients.debtSummary.failedToLoadClient')}
        </p>
        <p className="text-sm text-gray-600">
          {clientError?.message || t('pages.clients.debtSummary.errorOccurred')}
        </p>
        <Button variant="outline" onClick={() => navigate(`/dashboard/${id}`)} className="mt-4">
          {t('pages.clients.debtSummary.backToClient')}
        </Button>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    // Format with spaces as thousands separator, no decimals (e.g., "₴ 10 080")
    return `₴ ${amount
      .toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/,/g, ' ')}`
  }

  const getStatusDot = (status: Payment['status']) => {
    const statusColors = {
      Verified: 'bg-success-500',
      Pending: 'bg-gray-500',
      Cancelled: 'bg-error-500',
    }
    const borderStatusColors = {
      Verified: 'bg-success-200',
      Pending: 'bg-gray-200',
      Cancelled: 'bg-error-200',
    }
    return (
      <span
        className={cn(
          'flex h-3 w-3 items-center justify-center rounded-full',
          borderStatusColors[status]
        )}
      >
        {' '}
        <span className={cn('h-1.5 w-1.5 rounded-full', statusColors[status])} />
      </span>
    )
  }

  // Remove the paymentColumns array - we'll build the table directly

  const handleRecordPayment = (data: {
    amount: number
    date: Date
    method: 'Bank Transfer' | 'Card Payment' | 'Other'
    status: 'Pending Verification' | 'Verified'
    generateReceipt: boolean
    updateBalance: boolean
  }) => {
    // TODO: Implement API call to record payment
    console.log('Record payment:', data)
    // Refresh debt summary after payment
  }

  return (
    <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
      {/* Header */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center">
          <LinkButton variant="regular-secondary" onClick={() => navigate(`/dashboard/${id}`)}>
            <Icons.ArrowLeft02 size={24} />
          </LinkButton>
          <span className="text-dark-500 flex-1 text-2xl leading-tight font-light tracking-[-0.48px]">
            {t('pages.clients.debtSummary.title')}
          </span>
        </div>
        <DoubleButton
          icon={<Icons.Add size={24} />}
          iconPosition="left"
          onClick={() => setIsRecordPaymentModalOpen(true)}
        >
          {t('pages.clients.debtSummary.recordPayment')}
        </DoubleButton>
      </div>

      {/* Main Content */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Left Panel - Customer Info and Summary */}
        <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
          <div className="flex min-h-[517px] flex-1 flex-col items-center justify-center gap-6 self-stretch rounded-xl border border-white p-6">
            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                  <Icons.User size={24} className="text-dark-500" />
                </div>
                <span className="text-dark-500 text-xl leading-[132%] font-medium tracking-[-0.4px]">
                  {debtSummary.customerName}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1">
                <div className="flex items-center justify-center gap-1">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full',
                      debtSummary.status === 'Active' ||
                        debtSummary.status === 'Paid' ||
                        debtSummary.status === 'Partially Paid' ||
                        debtSummary.status === 'Dispute' ||
                        debtSummary.status === 'Legal'
                        ? 'bg-success-200'
                        : 'bg-error-200'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        debtSummary.status === 'Active' ||
                          debtSummary.status === 'Paid' ||
                          debtSummary.status === 'Partially Paid' ||
                          debtSummary.status === 'Dispute' ||
                          debtSummary.status === 'Legal'
                          ? 'bg-success-500'
                          : 'bg-error-500'
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      'text-sm leading-[150%] font-medium tracking-[-0.28px]',
                      debtSummary.status === 'Active' ||
                        debtSummary.status === 'Paid' ||
                        debtSummary.status === 'Partially Paid' ||
                        debtSummary.status === 'Dispute' ||
                        debtSummary.status === 'Legal'
                        ? 'text-success-500'
                        : 'text-error-500'
                    )}
                  >
                    {debtSummary.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Circle */}
            <div className="mb-6 flex justify-center">
              <div className="relative flex h-[150px] w-[150px] items-center justify-center">
                <svg className="h-[150px] w-[150px] -rotate-90 transform" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#FFF"
                    strokeWidth="10"
                    className="transition-all duration-300"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#A0F229"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 45}
                    strokeDashoffset={2 * Math.PI * 45 * (1 - debtSummary.progressPercentage / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-in-out"
                  />
                </svg>
                <span className="text-secondary-800 absolute text-[36px] leading-[126%] font-medium tracking-[-0.72px]">
                  {Math.round(debtSummary.progressPercentage)}%
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-5 self-stretch">
              <span className="text-dark-500 text-center text-xl leading-[132%] font-light tracking-[-0.4px]">
                {t('pages.clients.debtSummary.totalPaid')}{' '}
                <span className="font-medium">{formatCurrency(debtSummary.totalPaid)}</span>
              </span>
              <LinkButton
                variant="regular-secondary"
                leftIcon={<Icons.MoneyReceive01 size={24} />}
                onClick={() => navigate(`/dashboard/${id}/payment-history`)}
                className="flex-1"
              >
                {t('pages.clients.debtSummary.viewPaymentHistory')}
              </LinkButton>

              <LinkButton
                variant="regular-secondary"
                leftIcon={<Icons.PieChart08 size={24} />}
                onClick={() => {
                  // TODO: Handle generate payment plan
                  console.log('Generate payment plan')
                }}
                className="flex-1"
              >
                {t('pages.clients.debtSummary.generatePaymentPlan')}
              </LinkButton>
            </div>

            {/* Action Buttons */}
            <div className="flex items-start gap-3">
              <Button
                variant="primary"
                leftIcon={<Icons.Headset size={20} />}
                className="flex-1 rounded-full"
                onClick={() => {
                  // Navigate to client detail page for calling functionality
                  if (id) {
                    navigate(`/dashboard/${id}`)
                  }
                }}
              >
                {t('pages.clients.debtSummary.call')}
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Icons.PencilEdit02 size={20} />}
                className="flex-1 rounded-full"
                onClick={() => {
                  // Navigate to client detail page for editing
                  if (id) {
                    navigate(`/dashboard/${id}`)
                  }
                }}
              >
                {t('pages.clients.debtSummary.edit')}
              </Button>
            </div>
          </div>

          {/* Last Payment Card */}
          <div className="flex flex-col items-start gap-1 self-stretch rounded-xl border border-white/100 bg-white/50 p-5 px-0">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-3">
                <Icons.Money01 size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.debtSummary.lastPayment')}
                </span>
              </div>
              <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                {t('pages.clients.debtSummary.date')}
              </span>
            </div>
            <div className="flex items-center justify-between self-stretch px-6 py-0">
              <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
                {formatCurrency(debtSummary.lastPayment.amount)}
              </span>
              <span className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                {debtSummary.lastPayment.date}
              </span>
            </div>
          </div>

          {/* Total Debt Card */}
          <div className="relative flex flex-col items-start gap-1 self-stretch overflow-hidden rounded-xl border border-white bg-white/50 px-0 pt-5 pb-6">
            <div className="flex items-start justify-between self-stretch px-6">
              <div className="flex items-center gap-2">
                <Icons.Wallet01 size={18} className="text-gray-700" />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.debtSummary.totalDebt')}
                </span>
              </div>
              <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                {t('pages.clients.debtSummary.daysPastDue')}
              </span>
            </div>
            <div className="flex items-center justify-between self-stretch px-6 py-0">
              <span className="text-dark-500 text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
                {formatCurrency(debtSummary.totalDebt)}
              </span>
              <span className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                {t('pages.clients.debtSummary.daysPastDue')}: {debtSummary.daysPastDue}
              </span>
            </div>
            <div className="from-primary-300 to-secondary-800 absolute bottom-0 h-[3px] w-full bg-gradient-to-r"></div>
          </div>
        </div>

        {/* Right Panel - Payment History */}
        <div className="flex min-h-[740px] flex-1 flex-col items-center gap-6 self-stretch rounded-xl bg-white/50 p-6">
          <div className="flex flex-col items-start gap-3 self-stretch">
            <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
              {t('pages.clients.debtSummary.paymentHistory')}{' '}
              <span className="font-light">
                (
                {showAllPayments
                  ? t('pages.clients.debtSummary.all')
                  : t('pages.clients.debtSummary.last10')}
                )
              </span>
            </span>

            {/* Custom Table */}
            <div className="w-full overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                      {t('pages.clients.debtSummary.tableHeaders.date')}
                    </th>
                    <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-right text-xs font-medium">
                      {t('pages.clients.debtSummary.tableHeaders.amount')}
                    </th>
                    <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                      {t('pages.clients.debtSummary.tableHeaders.method')}
                    </th>
                    <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-left text-xs font-medium">
                      {t('pages.clients.debtSummary.tableHeaders.status')}
                    </th>
                    <th className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-medium">
                      {t('pages.clients.debtSummary.tableHeaders.receipt')}
                    </th>
                    <th className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium">
                      {t('pages.clients.debtSummary.tableHeaders.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const displayedPayments = showAllPayments
                      ? debtSummary.payments
                      : debtSummary.payments.slice(0, 10)

                    return displayedPayments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium"
                        >
                          {t('pages.clients.debtSummary.noPaymentHistory')}
                        </td>
                      </tr>
                    ) : (
                      displayedPayments.map((payment, index) => (
                        <tr
                          key={payment.id}
                          className={`transition-colors ${
                            index % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'
                          }`}
                        >
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium">
                            {payment.date}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-right text-xs font-medium">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium">
                            {t(
                              `pages.clients.debtSummary.paymentMethod.${payment.method.toLowerCase()}`
                            )}
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium">
                            <div className="flex items-center gap-2">
                              {getStatusDot(payment.status)}
                              <span>
                                {t(
                                  `pages.clients.debtSummary.paymentStatus.${payment.status.toLowerCase()}`
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="text-dark-500 h-[49px] border-r border-[#EBECE8] px-6 text-center text-xs font-medium">
                            {payment.receipt ? (
                              <LinkButton
                                variant="regular-secondary"
                                size="xs"
                                leftIcon={<Icons.FileDownload size={14} />}
                                onClick={() => {
                                  // TODO: Handle view receipt
                                  console.log('View receipt', payment.id)
                                }}
                              >
                                PDF
                              </LinkButton>
                            ) : (
                              <span className="text-xs text-gray-500"></span>
                            )}
                          </td>
                          <td className="text-dark-500 h-[49px] px-6 text-center text-xs font-medium">
                            {payment.status === 'Pending' ? (
                              <LinkButton
                                variant="regular-secondary"
                                size="xs"
                                leftIcon={<Icons.Success size={14} />}
                                onClick={() => {
                                  // TODO: Handle verify payment
                                  console.log('Verify payment', payment.id)
                                }}
                              >
                                {t('pages.clients.debtSummary.actions.verify')}
                              </LinkButton>
                            ) : (
                              <LinkButton
                                variant="regular-secondary"
                                size="xs"
                                leftIcon={<Icons.View size={14} />}
                                onClick={() => {
                                  // TODO: Handle view details
                                  console.log('View details', payment.id)
                                }}
                              >
                                {t('pages.clients.debtSummary.actions.viewDetails')}
                              </LinkButton>
                            )}
                          </td>
                        </tr>
                      ))
                    )
                  })()}
                </tbody>
              </table>

              {/* View All Link - Part of table structure */}
              <div className="flex items-center justify-center gap-[1px] self-stretch rounded-none border-x border-[#EBECE8]">
                <div className="flex min-h-[49px] flex-1 items-center justify-center gap-1 bg-[linear-gradient(0deg,#f2f3f0,#f2f3f0),#ffffff] p-2 px-4">
                  <LinkButton
                    variant="regular-secondary"
                    leftIcon={<Icons.Reload size={16} />}
                    onClick={() => {
                      setShowAllPayments(!showAllPayments)
                    }}
                  >
                    {showAllPayments
                      ? t('pages.clients.debtSummary.showLess')
                      : `${t('pages.clients.debtSummary.viewAll')} (${debtSummary.payments.length})`}
                  </LinkButton>
                </div>
              </div>

              {/* Summary Row - Part of table structure */}
              <div className="flex w-full items-center justify-between border-[#EBECE8] bg-white">
                <div className="flex flex-1 items-center border-r border-[#EBECE8] px-6 py-4">
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.debtSummary.summary.totalVerified')}
                  </span>
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {formatCurrency(debtSummary.totalVerified)}
                  </span>
                </div>
                <div className="flex flex-1 items-center px-6 py-4">
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {t('pages.clients.debtSummary.summary.pendingVerification')}
                  </span>
                  <span className="text-dark-500 line-clamp-1 flex-1 overflow-hidden text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
                    {formatCurrency(debtSummary.pendingVerification)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {debtSummary && (
        <RecordPaymentModal
          open={isRecordPaymentModalOpen}
          onClose={() => setIsRecordPaymentModalOpen(false)}
          customerName={debtSummary.customerName}
          currentDebt={debtSummary.totalDebt}
          onSave={handleRecordPayment}
        />
      )}
    </div>
  )
}
