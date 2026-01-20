/**
 * Client Detail Page
 *
 * Full page view for displaying detailed client information.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { AddNoteModal } from './components/AddNoteModal'
import { PriorityBadge } from './components/PriorityBadge'
import { TagBadge } from '@/components/ui/TagBadge'
import type { Priority } from './types'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { CallRecordingModal } from './components/CallRecordingModal'
import { ViewSMSModal } from './components/ViewSMSModal'
import { SendSMSModal } from './components/SendSMSModal'
import { CallLogCard } from './components/CallLogCard'
import { cn } from '@/lib/utils'
import { useClient } from '@/features/clients/hooks/useClients'
import { LinkButton } from '@/components/ui/LinkButton'
import { ClientDetailPageSkeleton } from './components/ClientDetailPageSkeleton'
import { useSMSHistory } from '@/features/sms'
import { useCallStore } from '@/stores/callStore'
import { useClientTags } from '@/features/tags/hooks/useTags'
import { TagSelectorModal } from './components/TagSelectorModal'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOriginateCall, useCallHistory } from '@/features/calls/hooks/useCall'
import { useCallWebSocket } from '@/features/calls/hooks/useCallWebSocket'

// Helper function to create mock client detail
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
  responsibleResearcher:
    id === 1
      ? 'Eva Pavlovna Smirnova'
      : id === 2
        ? 'Irina Mikhailovna Fedorova'
        : id === 3
          ? 'Yulia Andreevna Popova'
          : id === 4
            ? 'Ekaterina Viktorovna Lebedeva'
            : id === 5
              ? 'Svetlana Olegovna Novikova'
              : id === 6
                ? 'Marina Borisovna Frolova'
                : 'Daria Romanovna Orlova',
  phones: [
    { number: phoneNumber, type: 'primary' as const },
    {
      number: phoneNumber.replace(/(\d{2})(\d{3})(\d{4})/, '$1$2$3' + (id + 10)),
      type: 'secondary' as const,
    },
  ],
  tags,
  callCount:
    id === 1
      ? 69
      : id === 2
        ? 45
        : id === 3
          ? 32
          : id === 4
            ? 58
            : id === 5
              ? 41
              : id === 6
                ? 67
                : 52,
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
  recommenders: [
    {
      id: 1,
      fullName:
        id === 1
          ? 'Elena Petrovna Ivanova'
          : id === 2
            ? 'Nina Vasilievna Smirnova'
            : id === 3
              ? 'Galina Ivanovna Petrova'
              : id === 4
                ? 'Larisa Nikolaevna Kozlova'
                : id === 5
                  ? 'Raisa Sergeevna Morozova'
                  : id === 6
                    ? 'Valentina Dmitrievna Volkova'
                    : 'Lyudmila Alexandrovna Sokolova',
      relationship: 'Friend',
      phoneNumber: phoneNumber.replace(/(\d{2})(\d{3})/, '$1$2' + (id + 20)),
      comment:
        id === 1
          ? 'give their best on and off the field'
          : id === 2
            ? 'very reliable and trustworthy person'
            : id === 3
              ? 'excellent communication skills'
              : id === 4
                ? 'highly recommended contact'
                : id === 5
                  ? 'professional and courteous'
                  : id === 6
                    ? 'responsive and helpful'
                    : 'good business relationship',
    },
    {
      id: 2,
      fullName:
        id === 1
          ? 'Oksana Mykolaivna Kovalenko'
          : id === 2
            ? 'Tatiana Vladimirovna Romanova'
            : id === 3
              ? 'Marina Borisovna Frolova'
              : id === 4
                ? 'Daria Romanovna Orlova'
                : id === 5
                  ? 'Anastasia Olegovna Novikova'
                  : id === 6
                    ? 'Kristina Viktorovna Lebedeva'
                    : 'Victoria Mikhailovna Fedorova',
      relationship: 'Friend',
      phoneNumber: phoneNumber.replace(/(\d{2})(\d{3})/, '$1$2' + (id + 30)),
      comment:
        id === 1
          ? 'always inspiring the team to give their best and fostering a spirit of collaboration.'
          : id === 2
            ? 'maintains strong professional connections'
            : id === 3
              ? 'known for integrity and honesty'
              : id === 4
                ? 'well-respected in the community'
                : id === 5
                  ? 'excellent problem-solving abilities'
                  : id === 6
                    ? 'very organized and detail-oriented'
                    : 'great networking skills',
    },
  ],
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
  loans: [
    {
      id: 1,
      loanNumber: String(30 + id),
      counterparty:
        id === 1
          ? 'Gamma'
          : id === 2
            ? 'Alpha Corp'
            : id === 3
              ? 'Beta Solutions'
              : id === 4
                ? 'Delta Inc'
                : id === 5
                  ? 'Epsilon Ltd'
                  : id === 6
                    ? 'Zeta Group'
                    : 'Theta Partners',
      saleDate: `0${id}.23.2023`,
      loanAmount: 20000 + id * 1000,
      principalDebt: 10000 + id * 500,
      totalToRepay: 60000 + id * 5000,
    },
    {
      id: 2,
      loanNumber: String(10 + id),
      counterparty:
        id === 1
          ? 'Acme Corp.'
          : id === 2
            ? 'Tech Innovations'
            : id === 3
              ? 'Global Finance'
              : id === 4
                ? 'Capital Ventures'
                : id === 5
                  ? 'Prime Lending'
                  : id === 6
                    ? 'Elite Banking'
                    : 'Premium Credit',
      saleDate: `0${id + 1}.20.2023`,
      loanAmount: 22000 + id * 800,
      principalDebt: 12000 + id * 600,
      totalToRepay: 65000 + id * 3000,
    },
  ],
  comments: [
    {
      id: 1,
      date: `0${id}/12/2023`,
      text:
        id === 1
          ? "In a conversation about loans, a friend said it's important not to hesitate to ask the bank questions to ensure e..."
          : id === 2
            ? 'During our discussion, the client expressed interest in refinancing options and asked about flexible payment terms.'
            : id === 3
              ? 'The client mentioned they are considering consolidating multiple debts into a single loan for better management.'
              : id === 4
                ? 'Client inquired about early payment options and potential discounts for prompt repayment.'
                : id === 5
                  ? 'Discussion focused on loan eligibility criteria and required documentation for the application process.'
                  : id === 6
                    ? 'Client asked about interest rates and how they compare to other financial institutions in the market.'
                    : 'The conversation covered loan terms, repayment schedules, and available grace periods for payments.',
      author:
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
    },
  ],
  activities: [
    {
      id: 1,
      date: `0${id}/12/2023`,
      number: phoneNumber,
      contactType: 'Outgoing' as const,
      // Use simplified status labels for the result column
      result:
        id === 1
          ? 'Refusal to pay'
          : id === 2
            ? 'Agreement for full payment'
            : id === 3
              ? 'Refusal to pay'
              : id === 4
                ? 'Agreement for partial payment'
                : id === 5
                  ? 'Call back later'
                  : id === 6
                    ? 'Agreement for full payment'
                    : 'Agreement for full payment',
      promisedAmount: 600 + id * 10,
      promisedDate: `0${id}/12/2023`,
      comment:
        id === 1
          ? 'I received a loan of 678 hryvnias, everything went q...'
          : id === 2
            ? `Client committed to payment of ${600 + id * 10} hryvnias by the agreed date.`
            : id === 3
              ? `Promised amount of ${600 + id * 10} hryvnias discussed during call.`
              : id === 4
                ? `Agreed payment schedule includes ${600 + id * 10} hryvnias installment.`
                : id === 5
                  ? `Client will process payment of ${600 + id * 10} hryvnias as discussed.`
                  : id === 6
                    ? `Payment commitment of ${600 + id * 10} hryvnias confirmed.`
                    : `Agreed amount of ${600 + id * 10} hryvnias to be paid.`,
      employee:
        id === 1
          ? 'Sidorov'
          : id === 2
            ? 'Petrov'
            : id === 3
              ? 'Ivanov'
              : id === 4
                ? 'Kozlov'
                : id === 5
                  ? 'Morozov'
                  : id === 6
                    ? 'Volkov'
                    : 'Sokolov',
    },
  ],
  payments: [
    {
      id: 1,
      loanNumber: String(30 + id),
      counterparty:
        id === 1
          ? 'Gamma'
          : id === 2
            ? 'Alpha Corp'
            : id === 3
              ? 'Beta Solutions'
              : id === 4
                ? 'Delta Inc'
                : id === 5
                  ? 'Epsilon Ltd'
                  : id === 6
                    ? 'Zeta Group'
                    : 'Theta Partners',
      saleDate: `0${id}.23.2023`,
      paymentDate: `0${id}.23.2023`,
      amount: 20000 + id * 1000,
      paymentMethod: id % 2 === 0 ? 'Bank Transfer' : 'Card',
      status: id === 1 ? 'Failed' : id === 2 ? 'Pending' : 'Done',
      paymentDistribution: `₴ ${2000 + id * 100} loan body ₴ ${300 + id * 50} commisss`,
      employee:
        id === 1
          ? 'Sidorov'
          : id === 2
            ? 'Shevchenko'
            : id === 3
              ? 'Petrov'
              : id === 4
                ? 'Melnik'
                : id === 5
                  ? 'Savchenko'
                  : id === 6
                    ? 'Kovalenko'
                    : 'Ivanov',
    },
  ],
  writesOffs: [
    {
      id: 1,
      loanNumber: String(30 + id),
      counterparty:
        id === 1
          ? 'Gamma'
          : id === 2
            ? 'Alpha Corp'
            : id === 3
              ? 'Beta Solutions'
              : id === 4
                ? 'Delta Inc'
                : id === 5
                  ? 'Epsilon Ltd'
                  : id === 6
                    ? 'Zeta Group'
                    : 'Theta Partners',
      saleDate: `0${id}.23.2023`,
      writeOffDate: `0${id}.23.2023`,
      amount: 20000 + id * 1000,
      writeOffMethod: id % 2 === 0 ? 'Bank Transfer' : 'Card',
      employee:
        id === 1
          ? 'Sidorov'
          : id === 2
            ? 'Shevchenko'
            : id === 3
              ? 'Petrov'
              : id === 4
                ? 'Melnik'
                : id === 5
                  ? 'Savchenko'
                  : id === 6
                    ? 'Kovalenko'
                    : 'Ivanov',
    },
  ],
  primaryCreditorPayments: [
    {
      id: 1,
      loanNumber: String(30 + id),
      counterparty:
        id === 1
          ? 'Gamma'
          : id === 2
            ? 'Alpha Corp'
            : id === 3
              ? 'Beta Solutions'
              : id === 4
                ? 'Delta Inc'
                : id === 5
                  ? 'Epsilon Ltd'
                  : id === 6
                    ? 'Zeta Group'
                    : 'Theta Partners',
      saleDate: `0${id}.23.2023`,
      paymentDate: `0${id}.23.2023`,
      amount: 20000 + id * 1000,
      distributionMethod:
        id === 1
          ? 'Commission-based'
          : id === 2
            ? 'Escrow-based distribution'
            : id === 3
              ? 'Fixed amount distribution'
              : id === 4
                ? 'Multi-party / Chain distribution'
                : id === 5
                  ? 'Commission-based'
                  : id === 6
                    ? 'Escrow-based distribution'
                    : 'Fixed amount distribution',
    },
  ],
  operators: [
    {
      id: 1,
      creationDate: `0${id}.23.2023`,
      whoCreated:
        id === 1
          ? 'Sidorov'
          : id === 2
            ? 'Petrov'
            : id === 3
              ? 'Ivanov'
              : id === 4
                ? 'Kozlov'
                : id === 5
                  ? 'Morozov'
                  : id === 6
                    ? 'Volkov'
                    : 'Sokolov',
      description:
        id === 1
          ? 'Meet Alex, who got a loan to open a café and is excited to start.'
          : id === 2
            ? 'Client interested in business expansion loan for retail operations.'
            : id === 3
              ? 'New client seeking personal loan for home renovation project.'
              : id === 4
                ? 'Established client requesting additional credit line increase.'
                : id === 5
                  ? 'Client needs loan for vehicle purchase and financing options.'
                  : id === 6
                    ? 'Business client exploring working capital loan solutions.'
                    : 'Individual client interested in debt consolidation services.',
      reminderDate: `0${id}.23.2023`,
      reminderRecipient:
        id === 1
          ? 'Shevchenko'
          : id === 2
            ? 'Petrov'
            : id === 3
              ? 'Ivanov'
              : id === 4
                ? 'Kozlov'
                : id === 5
                  ? 'Morozov'
                  : id === 6
                    ? 'Volkov'
                    : 'Sokolov',
    },
  ],
  searchers: [
    {
      id: 1,
      creationDate: `0${id + 10}.23.2023`,
      whoCreated:
        id === 1
          ? 'Shevchenko'
          : id === 2
            ? 'Petrov'
            : id === 3
              ? 'Ivanov'
              : id === 4
                ? 'Kozlov'
                : id === 5
                  ? 'Morozov'
                  : id === 6
                    ? 'Volkov'
                    : 'Sokolov',
      description:
        id === 1
          ? 'Say hello to Taylor, who took a loan to redesign their home.'
          : id === 2
            ? 'Client research completed for property investment loan application.'
            : id === 3
              ? 'Background verification in progress for new client onboarding.'
              : id === 4
                ? 'Credit history review completed for existing client renewal.'
                : id === 5
                  ? 'Financial assessment underway for business loan qualification.'
                  : id === 6
                    ? 'Documentation review process initiated for loan approval.'
                    : 'Client eligibility check performed for loan program participation.',
      reminderDate: `0${id}.23.2023`,
      reminderRecipient:
        id === 1
          ? 'Shevchenko'
          : id === 2
            ? 'Petrov'
            : id === 3
              ? 'Ivanov'
              : id === 4
                ? 'Kozlov'
                : id === 5
                  ? 'Morozov'
                  : id === 6
                    ? 'Volkov'
                    : 'Sokolov',
    },
  ],
  callSmsHistory: {
    all: [
      {
        id: 1,
        number: phoneNumber,
        contactType: 'Outgoing' as const,
        comment:
          id === 1
            ? 'I received a loan of 678 hryvnias, everything went quickly and smoothly.'
            : id === 2
              ? 'Client confirmed receipt of loan documents and will proceed with signing.'
              : id === 3
                ? 'Discussion about loan terms and conditions went very well.'
                : id === 4
                  ? 'Client expressed satisfaction with the loan application process.'
                  : id === 5
                    ? 'Follow-up call regarding loan approval status was productive.'
                    : id === 6
                      ? 'Client requested additional information about repayment options.'
                      : 'Initial consultation call completed successfully with positive feedback.',
      },
    ],
    calls: [
      {
        id: 1,
        date: '2025-12-03',
        time: `${14 + id}:30`,
        type: 'Incoming' as const,
        duration: '2m 35s',
        status: 'Answered' as const,
        operator: 'maria_s',
        phone: phoneNumber,
        phoneLabel: 'Primary',
        line: 'White',
      },
    ],
    sms: [
      {
        id: 1,
        date: '2025-12-03',
        time: `${14 + id}:30`,
        message:
          id === 1
            ? 'Dear Ivan, this is a reminder about your loan payment.'
            : id === 2
              ? 'Thank you for your recent loan application. We will review it shortly.'
              : id === 3
                ? 'Your loan payment is due soon. Please ensure sufficient funds.'
                : id === 4
                  ? 'Loan approval notification: Your application has been processed.'
                  : id === 5
                    ? 'Reminder: Loan installment payment scheduled for this week.'
                    : id === 6
                      ? 'Update: Your loan status has been updated in our system.'
                      : 'Notification: Important information regarding your loan account.',
        template: 'Payment Reminder',
        operator: 'Svitlana',
        status: 'Delivered' as const,
      },
    ],
  },
  tasks: [
    {
      id: 1,
      creationDate: `0${id}.23.2023`,
      whoCreated:
        id === 1
          ? 'Sidorov'
          : id === 2
            ? 'Petrov'
            : id === 3
              ? 'Ivanov'
              : id === 4
                ? 'Kozlov'
                : id === 5
                  ? 'Morozov'
                  : id === 6
                    ? 'Volkov'
                    : 'Sokolov',
      description:
        id === 1
          ? 'Meet Alex, who got a loan to open a café and is excited to start.'
          : id === 2
            ? 'Follow up with client regarding loan application submission.'
            : id === 3
              ? 'Schedule meeting to discuss loan terms and conditions.'
              : id === 4
                ? 'Review client documentation for loan approval process.'
                : id === 5
                  ? 'Contact client about payment schedule and options.'
                  : id === 6
                    ? 'Prepare loan agreement documents for client signature.'
                    : 'Coordinate with client for loan disbursement procedures.',
      reminderDate: `0${id}.23.2023`,
      reminderRecipient:
        id === 1
          ? 'Shevchenko'
          : id === 2
            ? 'Petrov'
            : id === 3
              ? 'Ivanov'
              : id === 4
                ? 'Kozlov'
                : id === 5
                  ? 'Morozov'
                  : id === 6
                    ? 'Volkov'
                    : 'Sokolov',
    },
  ],
  documents: [
    {
      id: 1,
      name:
        id === 1
          ? 'Loan Agreement.pdf'
          : id === 2
            ? 'Credit Application Form.pdf'
            : id === 3
              ? 'Financial Statement.pdf'
              : id === 4
                ? 'Identity Verification.pdf'
                : id === 5
                  ? 'Income Certificate.pdf'
                  : id === 6
                    ? 'Property Documents.pdf'
                    : 'Bank Statement.pdf',
      type: 'PDF',
      uploadDate: `0${id}.23.2023`,
      size: `${2 + id * 0.3} MB`,
    },
  ],
})

// Mock data array - replace with actual API call
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

// Legacy mock data removed - use mockClientsDetail array instead

export function ClientDetailPage() {
  const { t } = useTranslation('common')
  const { isCallActive, setOpenCallModal } = useCallStore()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeLoanTab, setActiveLoanTab] = useState<'process' | 'closed' | 'rr'>('process')
  const [activeCommentTab, setActiveCommentTab] = useState<'comments' | 'primary'>('comments')

  // Get current user for call integration
  const { user } = useAuth()
  const { mutate: originateCall, isPending: isOriginatingCall } = useOriginateCall()

  // Track call error state for displaying in modal
  const [callError, setCallError] = useState<string | null>(null)

  // Enable WebSocket for real-time call updates
  useCallWebSocket(user?.asterisk_extension || null)

  // Clear call error when modal opens
  const handleClearCallError = () => {
    setCallError(null)
  }

  // Handle call origination with custom success handler
  const handleOriginateCall = (phoneNumber: string, clientName: string, clientId: string) => {
    if (!user?.asterisk_extension) {
      setCallError('Your account is not configured for calling. Please contact administrator.')
      return
    }

    // Clear any previous error
    setCallError(null)

    originateCall(
      {
        agent_extension: user.asterisk_extension,
        customer_number: phoneNumber,
        caller_id_name: 'CRM Call',
        client_id: Number(clientId),
        metadata: {
          client_name: clientName,
        },
      },
      {
        onSuccess: (data) => {
          // Store the call ID to track this call with backend
          setCurrentCallId(data.call_id)
          // Modal is already open and will transition to 'dialing' state
          // No need to re-open it
        },
        onError: (err: unknown) => {
          // Extract error message from response
          let message: string | undefined
          if (err && typeof err === 'object' && 'response' in err) {
            const response = (
              err as { response?: { data?: { message?: string; detail?: unknown } } }
            ).response
            const data = response?.data
            if (data?.message) {
              message = data.message
            } else if (data?.detail) {
              // detail can be a string or an object with message property
              if (typeof data.detail === 'string') {
                message = data.detail
              } else if (typeof data.detail === 'object' && data.detail !== null) {
                message = (data.detail as { message?: string }).message
              }
            }
          }
          setCallError(message || 'Failed to initiate call. Please try again.')
        },
      }
    )
  }

  // Fetch client data from API
  const clientId = id ? Number(id) : 0

  // Ensure clientId is valid before making API call
  const isValidClientId = clientId > 0 && !isNaN(clientId)
  const { data: apiClient, isLoading, isError, error } = useClient(clientId, isValidClientId)

  // Fetch SMS history from API
  const { data: smsHistoryData } = useSMSHistory(clientId, undefined)

  // Fetch client tags from API
  const { data: clientTags } = useClientTags(clientId)

  // Fetch call history from API
  const { data: callHistoryData } = useCallHistory(clientId, { limit: 100 })

  // Use mock data as fallback for missing fields until backend is fully integrated
  const client = useMemo(() => {
    if (!apiClient) return mockClientsDetail[0]

    const fullName = [apiClient.first_name, apiClient.middle_name, apiClient.last_name]
      .filter(Boolean)
      .join(' ')

    // Map API SMS history to expected format - use real data from API
    const apiSmsHistory = smsHistoryData?.items || []
    const mappedSmsHistory = apiSmsHistory.map((sms, index) => {
      const sentAt = sms.sent_at ? new Date(sms.sent_at) : new Date()
      // Map backend status to frontend status: 'sent' and 'delivered' -> 'Delivered', 'failed' -> 'Failed', otherwise -> 'Pending'
      const statusStr =
        sms.status === 'delivered' || sms.status === 'sent'
          ? 'Delivered'
          : sms.status === 'failed'
            ? 'Failed'
            : 'Pending'

      return {
        id: index + 1,
        date: sentAt.toISOString().split('T')[0],
        time: sentAt.toTimeString().slice(0, 5), // HH:MM format
        message: sms.message_text || '',
        template: sms.template_name || '',
        operator: sms.operator_name || '',
        status: statusStr as 'Delivered' | 'Pending' | 'Failed',
      }
    })

    // Map API call history to expected format - use real data from API
    const apiCallHistory = callHistoryData?.calls || []
    const mappedCallHistory = apiCallHistory.map((call, index) => {
      const initiatedAt = call.initiated_at ? new Date(call.initiated_at) : new Date()
      // Map backend state/outcome to frontend status
      const statusStr =
        call.outcome === 'answered'
          ? 'Answered'
          : call.state === 'failed' || call.outcome === 'failed'
            ? 'No Answer'
            : 'No Answer'

      // Format duration
      const durationSeconds = call.talk_duration || 0
      const minutes = Math.floor(durationSeconds / 60)
      const seconds = durationSeconds % 60
      const durationStr = `${minutes}m ${seconds}s`

      // Determine call type (Incoming vs Outgoing)
      const callType = call.agent_extension ? 'Outgoing' : 'Incoming'

      return {
        id: index + 1,
        date: initiatedAt.toISOString().split('T')[0],
        time: initiatedAt.toTimeString().slice(0, 5), // HH:MM format
        duration: durationStr,
        status: statusStr as 'Answered' | 'No Answer',
        type: callType as 'Incoming' | 'Outgoing',
        phone: call.customer_number,
        phoneLabel: 'Primary', // TODO: Get from backend if available
        line: 'White Line', // TODO: Get from backend if available
        operator: 'Agent', // TODO: Get operator name from backend
        call_id: call.call_id, // Include call_id for recording playback
      }
    })

    // Map API client to expected shape, using mock data for fields not yet in API
    const mockClient = mockClientsDetail[0]
    return {
      ...mockClient, // Fallback for fields not yet in backend
      id: apiClient.id,
      fullName,
      taxIdNumber: apiClient.tax_id,
      phoneNumber: apiClient.phone_primary,
      tags: [], // TODO: Add tags support in backend
      score: apiClient.priority_score,
      priority: (apiClient.manual_priority ||
        (apiClient.priority_score >= 75
          ? 'Critical'
          : apiClient.priority_score >= 50
            ? 'High'
            : apiClient.priority_score >= 25
              ? 'Medium'
              : 'Low')) as Priority,
      phones: [
        { number: apiClient.phone_primary, type: 'primary' as const },
        ...(apiClient.phone_secondary
          ? [{ number: apiClient.phone_secondary, type: 'secondary' as const }]
          : []),
      ],
      personalDetails: {
        ...mockClient.personalDetails,
        tin: apiClient.tax_id,
        dateOfBirth: apiClient.date_of_birth || mockClient.personalDetails.dateOfBirth,
      },
      addresses: {
        ...mockClient.addresses,
        registrationAddress: apiClient.address || mockClient.addresses.registrationAddress,
      },
      callSmsHistory: {
        ...mockClient.callSmsHistory,
        calls: mappedCallHistory as typeof mockClient.callSmsHistory.calls, // Use real API data instead of mock
        sms: mappedSmsHistory as typeof mockClient.callSmsHistory.sms, // Use real API data instead of mock
      },
    }
  }, [apiClient, smsHistoryData, callHistoryData])

  // Tags are now fetched from useClientTags hook instead of local state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [isCallRecordingModalOpen, setIsCallRecordingModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [selectedCallData, setSelectedCallData] = useState<{
    type: string
    clientName: string
    date: string
    time: string
    operator: string
    duration: string
    phone: string
    call_id?: string
  } | null>(null)
  const [isViewSMSModalOpen, setIsViewSMSModalOpen] = useState(false)
  const [selectedSMSData, setSelectedSMSData] = useState<{
    date: string
    time: string
    template: string
    operator: string
    status: string
    message: string
    phone: string
  } | null>(null)
  const [isSendSMSModalOpen, setIsSendSMSModalOpen] = useState(false)
  const [selectedPhoneForSMS, setSelectedPhoneForSMS] = useState<string>('')
  const [activeClientCardTab, setActiveClientCardTab] = useState<
    'personal' | 'recommenders' | 'addresses' | 'work'
  >('personal')
  const [activeRightCardTab, setActiveRightCardTab] = useState<
    'loans' | 'payments' | 'operators' | 'call-sms-history' | 'tasks' | 'documents'
  >('loans')
  const [activePaymentTab, setActivePaymentTab] = useState<
    'payments' | 'writes-off' | 'primary-creditor'
  >('payments')
  const [activeOperatorTab, setActiveOperatorTab] = useState<'operators' | 'searchers'>('operators')
  const [activeCallSmsTab, setActiveCallSmsTab] = useState<'all' | 'calls' | 'sms'>('all')

  // Show loading skeleton
  if (isLoading) {
    return <ClientDetailPageSkeleton />
  }

  // Show error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Icons.Warning className="text-error-500 h-8 w-8" strokeWidth={2} />
        <p className="font-medium text-gray-900">Failed to load client</p>
        <p className="text-sm text-gray-600">{error?.message || 'An error occurred'}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/client')} className="mt-4">
          Back to Clients
        </Button>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-600">{t('pages.clients.detail.clientNotFound')}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="mt-4">
          {t('pages.clients.detail.backToClients')}
        </Button>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  const formatCurrencyWithDecimals = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: amount % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: 1,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  const loanColumns: Column<(typeof client.loans)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'loanAmount',
      header: t('pages.clients.detail.tableHeaders.loanAmount'),
      align: 'right',
      render: (loan) => `₴ ${formatCurrency(loan.loanAmount)}`,
    },
    {
      key: 'principalDebt',
      header: t('pages.clients.detail.tableHeaders.principalDebt'),
      align: 'right',
      render: (loan) => `₴ ${formatCurrency(loan.principalDebt)}`,
    },
    {
      key: 'totalToRepay',
      header: t('pages.clients.detail.tableHeaders.totalToBeRepaid'),
      align: 'right',
      render: (loan) => `₴ ${formatCurrency(loan.totalToRepay)}`,
    },
  ]

  const activityColumns: Column<(typeof client.activities)[0]>[] = [
    { key: 'date', header: t('pages.clients.activity.tableHeaders.date'), align: 'left' },
    { key: 'number', header: t('pages.clients.activity.tableHeaders.number'), align: 'left' },
    {
      key: 'contactType',
      header: t('pages.clients.activity.tableHeaders.contactType'),
      align: 'left',
    },
    { key: 'result', header: t('pages.clients.activity.tableHeaders.result'), align: 'left' },
    {
      key: 'promisedAmount',
      header: t('pages.clients.activity.tableHeaders.promisedAmount'),
      align: 'right',
      render: (activity) =>
        activity.promisedAmount ? `${formatCurrencyWithDecimals(activity.promisedAmount)}₴` : '-',
    },
    {
      key: 'promisedDate',
      header: t('pages.clients.activity.tableHeaders.promisedDate'),
      align: 'left',
      render: (activity) => activity.promisedDate || '-',
    },
    { key: 'comment', header: t('pages.clients.activity.tableHeaders.comment'), align: 'left' },
    { key: 'employee', header: t('pages.clients.activity.tableHeaders.employee'), align: 'left' },
  ]

  const paymentColumns: Column<(typeof client.payments)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'paymentDate',
      header: t('pages.clients.detail.tableHeaders.paymentDate'),
      align: 'left',
    },
    {
      key: 'amount',
      header: t('pages.clients.detail.tableHeaders.amount'),
      align: 'right',
      render: (payment) => `₴ ${formatCurrency(payment.amount)}`,
    },
    {
      key: 'paymentMethod',
      header: t('pages.clients.detail.tableHeaders.paymentMethod'),
      align: 'left',
    },
    {
      key: 'status',
      header: t('pages.clients.detail.tableHeaders.status'),
      align: 'left',
      render: (payment) => {
        const statusColors = {
          Done: 'bg-success-500',
          Pending: 'bg-gray-500',
          Failed: 'bg-error-500',
        }
        const statusColor =
          statusColors[payment.status as keyof typeof statusColors] || 'bg-gray-500'
        const textColor =
          payment.status === 'Done'
            ? 'text-success-500'
            : payment.status === 'Failed'
              ? 'text-error-500'
              : 'text-gray-500'
        return (
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', statusColor)} />
            <span className={cn('text-xs font-medium', textColor)}>
              {t(`pages.clients.detail.paymentStatuses.${payment.status.toLowerCase()}`)}
            </span>
          </div>
        )
      },
    },
    {
      key: 'paymentDistribution',
      header: t('pages.clients.detail.tableHeaders.paymentDistribution'),
      align: 'left',
    },
    {
      key: 'employee',
      header: t('pages.clients.detail.tableHeaders.fixationOnEmployee'),
      align: 'left',
    },
  ]

  const writeOffColumns: Column<(typeof client.writesOffs)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'writeOffDate',
      header: t('pages.clients.detail.tableHeaders.writeOffDate'),
      align: 'left',
    },
    {
      key: 'amount',
      header: t('pages.clients.detail.tableHeaders.amount'),
      align: 'right',
      render: (writeOff) => `₴ ${formatCurrency(writeOff.amount)}`,
    },
    {
      key: 'writeOffMethod',
      header: t('pages.clients.detail.tableHeaders.writeOffMethod'),
      align: 'left',
    },
    {
      key: 'employee',
      header: t('pages.clients.detail.tableHeaders.fixationOnEmployee'),
      align: 'left',
    },
  ]

  const primaryCreditorPaymentColumns: Column<(typeof client.primaryCreditorPayments)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'paymentDate',
      header: t('pages.clients.detail.tableHeaders.paymentDate'),
      align: 'left',
    },
    {
      key: 'amount',
      header: t('pages.clients.detail.tableHeaders.amount'),
      align: 'right',
      render: (payment) => `₴ ${formatCurrency(payment.amount)}`,
    },
    {
      key: 'distributionMethod',
      header: t('pages.clients.detail.tableHeaders.writeOffMethod'),
      align: 'left',
    },
  ]

  const operatorColumns: Column<(typeof client.operators)[0]>[] = [
    {
      key: 'creationDate',
      header: t('pages.clients.detail.tableHeaders.creationDate'),
      align: 'left',
    },
    { key: 'whoCreated', header: t('pages.clients.detail.tableHeaders.whoCreated'), align: 'left' },
    {
      key: 'description',
      header: t('pages.clients.detail.tableHeaders.description'),
      align: 'left',
    },
    {
      key: 'reminderDate',
      header: t('pages.clients.detail.tableHeaders.dateOfReminder'),
      align: 'left',
    },
    {
      key: 'reminderRecipient',
      header: t('pages.clients.detail.tableHeaders.whoWillReceiveReminder'),
      align: 'left',
    },
  ]

  const searcherColumns: Column<(typeof client.searchers)[0]>[] = [
    {
      key: 'creationDate',
      header: t('pages.clients.detail.tableHeaders.creationDate'),
      align: 'left',
    },
    { key: 'whoCreated', header: t('pages.clients.detail.tableHeaders.whoCreated'), align: 'left' },
    {
      key: 'description',
      header: t('pages.clients.detail.tableHeaders.description'),
      align: 'left',
    },
    {
      key: 'reminderDate',
      header: t('pages.clients.detail.tableHeaders.dateOfReminder'),
      align: 'left',
    },
    {
      key: 'reminderRecipient',
      header: t('pages.clients.detail.tableHeaders.whoWillReceiveReminder'),
      align: 'left',
    },
  ]

  const taskColumns: Column<(typeof client.tasks)[0]>[] = [
    {
      key: 'creationDate',
      header: t('pages.clients.detail.tableHeaders.creationDate'),
      align: 'left',
    },
    { key: 'whoCreated', header: t('pages.clients.detail.tableHeaders.whoCreated'), align: 'left' },
    {
      key: 'description',
      header: t('pages.clients.detail.tableHeaders.description'),
      align: 'left',
    },
    {
      key: 'reminderDate',
      header: t('pages.clients.detail.tableHeaders.dateOfReminder'),
      align: 'left',
    },
    {
      key: 'reminderRecipient',
      header: t('pages.clients.detail.tableHeaders.whoWillReceiveReminder'),
      align: 'left',
    },
  ]

  // const documentColumns: Column<(typeof client.documents)[0]>[] = [
  //   { key: 'name', header: 'Name', align: 'left' },
  //   { key: 'type', header: 'Type', align: 'left' },
  //   { key: 'uploadDate', header: 'Upload Date', align: 'left' },
  //   { key: 'size', header: 'Size', align: 'left' },
  // ]

  const callSmsHistoryColumns: Column<(typeof client.callSmsHistory.all)[0]>[] = [
    {
      key: 'number',
      header: t('pages.clients.activity.tableHeaders.number'),
      align: 'left',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span>{item.number}</span>
          <div className="flex items-center gap-1">
            <button className="text-primary-500 flex h-[20px] w-[20px] items-center justify-center hover:opacity-80">
              <Icons.Headset size={16} className="flex-shrink-0" />
            </button>
            <button className="text-primary-500 flex h-[20px] w-[20px] items-center justify-center hover:opacity-80">
              <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
            </button>
            <button className="text-primary-500 flex h-[20px] w-[20px] items-center justify-center hover:opacity-80">
              <Icons.PencilEdit size={16} className="flex-shrink-0" />
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'contactType',
      header: t('pages.clients.activity.tableHeaders.contactType'),
      align: 'left',
    },
    { key: 'comment', header: t('pages.clients.activity.tableHeaders.comment'), align: 'left' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Client Header */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex h-6 w-6 items-center justify-center"
          >
            <Icons.ArrowLeft02 size={24} className="text-secondary-800" strokeWidth={1.5} />
          </button>
          <h1 className="text-dark-500 text-center text-2xl leading-[150%] font-light">
            {client.fullName}
          </h1>
          <span className="text-dark-500 flex items-center rounded-[16px] bg-white/10 px-3 py-0">
            {client.score} {t('pages.clients.activity.score')}
          </span>
          <PriorityBadge priority={client.priority} />
        </div>
        <div className="flex items-center gap-5">
          <Button
            size="md"
            variant="transparent-black"
            className="flex flex-row rounded-full text-sm font-medium"
            onClick={() => navigate(`/dashboard/clients/${id}/debt-summary`)}
          >
            {t('pages.clients.debtSummary.title')}
          </Button>
          <Button
            size="md"
            variant="transparent-black"
            leftIcon={<Icons.PencilEdit size={20} />}
            className="flex flex-row rounded-full text-sm font-medium"
            onClick={() => setIsNoteModalOpen(true)}
          >
            {t('pages.clients.activity.addNoteAboutClient')}
          </Button>
          <Button
            size="md"
            leftIcon={<Icons.Headset size={20} />}
            className="rounded-full"
            disabled={!user?.asterisk_extension}
            onClick={() => {
              const phoneNumber = client.phones?.[0]?.number
              if (!phoneNumber) {
                toast.error('Client has no phone number')
                return
              }

              if (isCallActive()) {
                toast.warning(
                  t('pages.clients.modals.callDialog.callInProgress') ||
                    'Another call or recording is already in progress. Please finish or close it first.'
                )
                return
              }

              // Open modal in 'initial' state to let user select call type
              setOpenCallModal('call-dialog')
              setIsCallModalOpen(true)
            }}
          >
            {t('pages.clients.activity.call')}
          </Button>
          <Button
            size="md"
            variant="secondary"
            leftIcon={<Icons.RemoveMale size={20} />}
            className="rounded-full"
          >
            {t('pages.clients.activity.deleteClient')}
          </Button>
        </div>
      </div>
      <div className="flex items-start gap-5 self-stretch">
        {/* Client Card */}
        <div className="flex min-h-[44px] w-[428px] flex-col items-start justify-center gap-0 rounded-lg bg-white/50 p-0">
          {/* Credit Details (top part of card) */}
          <div className="flex flex-col items-start gap-3 self-stretch px-6 py-5">
            <div className="flex flex-col gap-2 self-stretch">
              <div className="flex items-center justify-between gap-2 self-stretch">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {clientTags && clientTags.length > 0 ? (
                    clientTags.map((tag) => (
                      <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
                    ))
                  ) : (
                    <span className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                      No tags assigned
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsTagModalOpen(true)}
                  className="text-gray-500 transition-colors hover:text-gray-700"
                  title="Manage tags"
                  type="button"
                >
                  <Icons.PencilEdit02 size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1 self-stretch">
              <div className="flex min-h-8 items-center self-stretch p-0">
                <label className="flex-1 text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                  {t('pages.clients.detail.department')}
                </label>
                <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                  {client.department}
                </p>
              </div>
              <div className="flex min-h-8 items-center self-stretch p-0">
                <label className="flex-1 text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                  {t('pages.clients.filters.responsibleEmployee')}
                </label>
                <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                  {client.responsibleEmployee}
                </p>
              </div>
              <div className="flex min-h-8 items-center self-stretch p-0">
                <label className="flex-1 text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                  {t('pages.clients.filters.responsibleSearcher')}
                </label>
                <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                  {client.responsibleResearcher}
                </p>
              </div>
            </div>
            <div className="flex items-start self-stretch p-0">
              <div className="flex w-[131px] items-center gap-2.5">
                <label className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.detail.phones')}
                </label>
              </div>
              <div className="flex flex-1 flex-col items-start justify-center gap-2">
                {client.phones.map((phone, index) => (
                  <div key={index} className="flex items-center gap-3 self-stretch">
                    <span className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {phone.number}
                    </span>
                    <button
                      onClick={() => {
                        if (isCallActive()) {
                          toast.warning(
                            t('pages.clients.modals.callDialog.callInProgress') ||
                              'Another call or recording is already in progress. Please finish or close it first.'
                          )
                          return
                        }
                        setOpenCallModal('call-dialog')
                        setIsCallModalOpen(true)
                      }}
                      className="text-primary-500 flex h-[20px] w-[20px] cursor-pointer items-center justify-center hover:opacity-80"
                    >
                      <Icons.Headset size={16} className="flex-shrink-0" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPhoneForSMS(phone.number)
                        setIsSendSMSModalOpen(true)
                      }}
                      className="text-primary-500 flex h-[20px] w-[20px] cursor-pointer items-center justify-center hover:opacity-80"
                    >
                      <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
                    </button>
                    <button
                      onClick={() => setIsNoteModalOpen(true)}
                      className="text-primary-500 flex h-[20px] w-[20px] cursor-pointer items-center justify-center hover:opacity-80"
                    >
                      <Icons.PencilEdit size={16} className="flex-shrink-0" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex h-px w-[428px] flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>

          {/* Personal & Contact Details - 4 left tabs inside client card */}
          <div className="flex items-center gap-6 self-stretch pr-6">
            {/* Vertical tab icons */}
            <div className="flex min-h-[44px] flex-col items-start gap-1 self-stretch rounded-bl-lg bg-white py-2.5">
              <button
                type="button"
                onClick={() => setActiveClientCardTab('personal')}
                className={cn(
                  'flex max-w-[100px] flex-col items-start justify-center self-stretch rounded-none border-l-2 bg-white/10 p-4',
                  activeClientCardTab === 'personal' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.UserAccount
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeClientCardTab === 'personal' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => setActiveClientCardTab('work')}
                className={cn(
                  'flex max-w-[100px] flex-col items-start justify-center self-stretch rounded-none border-l-2 bg-white/10 p-4',
                  activeClientCardTab === 'work' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.Briefcase01
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeClientCardTab === 'work' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => setActiveClientCardTab('recommenders')}
                className={cn(
                  'flex max-w-[100px] flex-col items-start justify-center self-stretch rounded-none border-l-2 bg-white/10 p-4',
                  activeClientCardTab === 'recommenders'
                    ? 'border-primary-300'
                    : 'border-transparent'
                )}
              >
                <Icons.UserCheck01
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeClientCardTab === 'recommenders' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => setActiveClientCardTab('addresses')}
                className={cn(
                  'flex max-w-[100px] flex-col items-start justify-center self-stretch rounded-none border-l-2 bg-white/10 p-4',
                  activeClientCardTab === 'addresses' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.Location01
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeClientCardTab === 'addresses' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
            </div>

            {/* Right side content for selected client card tab */}
            <div className="flex w-[324px] flex-col items-center gap-6 self-stretch py-4">
              {activeClientCardTab === 'personal' && (
                <>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.tin')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.tin}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.dateOfBirth')}
                      </label>
                      <Icons.Info size={14} className="text-gray-800" />
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.dateOfBirth}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.age')}
                      </label>
                      <Icons.Info size={14} className="text-gray-800" />
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.age}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.passport')}
                      </label>
                      <Icons.Info size={14} className="text-gray-800" />
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.passport}
                    </p>
                  </div>
                  <div className="flex items-center justify-between self-stretch p-0">
                    <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                      {t('pages.clients.detail.maritalStatus')}
                    </label>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <p className="text-dark-500 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                        {client.personalDetails.maritalStatus}
                      </p>
                      <Icons.Tick01 size={18} className="text-gray-800" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                      {t('pages.clients.detail.numberOfFamilyMembers')}
                    </label>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.familyMembers}
                    </p>
                  </div>
                </>
              )}

              {activeClientCardTab === 'recommenders' && (
                <>
                  {client.recommenders.map((friend) => (
                    <>
                      {/* <div key={friend.id} className="flex flex-col gap-3 self-stretch"> */}
                      <div className="flex items-center self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.fullName')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.fullName}
                        </p>
                      </div>
                      <div className="flex items-center self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.relationshipTo')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.relationship}
                        </p>
                      </div>
                      <div className="flex items-center self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.phoneNumber')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.phoneNumber}
                        </p>
                      </div>
                      <div className="flex items-start self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.comment')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-sm leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.comment}
                        </p>
                      </div>
                      {/* </div> */}
                      {friend.id < client.recommenders.length && (
                        <div className="flex h-px flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>
                      )}
                    </>
                  ))}
                </>
              )}

              {activeClientCardTab === 'addresses' && (
                <>
                  <div className="flex items-start self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.registrationAddress')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-sm leading-[140%] font-medium tracking-[-0.24px]">
                      {client.addresses.registrationAddress}
                    </p>
                  </div>
                  <div className="flex h-px flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>
                  <div className="flex items-start self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.personalAddress')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-sm leading-[140%] font-medium tracking-[-0.24px]">
                      {client.addresses.personalAddress}
                    </p>
                  </div>
                </>
              )}

              {activeClientCardTab === 'work' && (
                <>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.tin')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.tin}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.dateOfBirth')}
                      </label>
                      <Icons.Info size={14} className="text-gray-800" />
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.dateOfBirth}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.age')}
                      </label>
                      <Icons.Info size={14} className="text-gray-800" />
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.age}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.passport')}
                      </label>
                      <Icons.Info size={14} className="text-gray-800" />
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.passport}
                    </p>
                  </div>
                  <div className="flex items-center justify-between self-stretch p-0">
                    <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                      {t('pages.clients.detail.maritalStatus')}
                    </label>
                    <div className="flex flex-1 items-center justify-end gap-2">
                      <p className="text-dark-500 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                        {client.personalDetails.maritalStatus}
                      </p>
                      <Icons.Tick01 size={18} className="text-gray-800" />
                    </div>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                      {t('pages.clients.detail.numberOfFamilyMembers')}
                    </label>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.familyMembers}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Data + Comments Card with 6 left tabs */}
        <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
          <div className="flex min-h-[44px] flex-1 items-start justify-center gap-0 self-stretch rounded-lg bg-white/50 p-0">
            {/* Vertical tab icons - 6 tabs */}
            <div className="flex flex-col items-start gap-2.5 self-stretch rounded-l-lg bg-white py-2.5">
              {/* Tab 1: Loans (Calendar icon) */}
              <button
                type="button"
                onClick={() => setActiveRightCardTab('loans')}
                className={cn(
                  'border-primary-300 flex flex-col items-start justify-center gap-2 rounded-none border-l-2 bg-white/10 p-4',
                  activeRightCardTab === 'loans' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.Briefcase08
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeRightCardTab === 'loans' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
              {/* Tab 2: Payments (Contact icon) */}
              <button
                type="button"
                onClick={() => setActiveRightCardTab('payments')}
                className={cn(
                  'border-primary-300 flex flex-col items-start justify-center gap-2 rounded-none border-l-2 bg-white/10 p-4',
                  activeRightCardTab === 'payments' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.PieChart02
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeRightCardTab === 'payments' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
              {/* Tab 3: documents */}
              <button
                type="button"
                onClick={() => setActiveRightCardTab('documents')}
                className={cn(
                  'border-primary-300 flex flex-col items-start justify-center gap-2 rounded-none border-l-2 bg-white/10 p-4',
                  activeRightCardTab === 'documents' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.UserStatus
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeRightCardTab === 'documents' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
              {/* Tab 4: tasks (User icon) */}
              <button
                type="button"
                onClick={() => setActiveRightCardTab('tasks')}
                className={cn(
                  'border-primary-300 flex flex-col items-start justify-center gap-2 rounded-none border-l-2 bg-white/10 p-4',
                  activeRightCardTab === 'tasks' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.Calendar03
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeRightCardTab === 'tasks' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
              {/* Tab 5: call-sms-history (Activity icon) */}
              <button
                type="button"
                onClick={() => setActiveRightCardTab('call-sms-history')}
                className={cn(
                  'border-primary-300 flex flex-col items-start justify-center gap-2 rounded-none border-l-2 bg-white/10 p-4',
                  activeRightCardTab === 'call-sms-history'
                    ? 'border-primary-300'
                    : 'border-transparent'
                )}
              >
                <Icons.TransactionHistory
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeRightCardTab === 'call-sms-history'
                      ? 'text-secondary-800'
                      : 'text-gray-700'
                  )}
                />
              </button>
              {/* Tab 6: operators (File icon) */}
              <button
                type="button"
                onClick={() => setActiveRightCardTab('operators')}
                className={cn(
                  'border-primary-300 flex flex-col items-start justify-center gap-2 rounded-none border-l-2 bg-white/10 p-4',
                  activeRightCardTab === 'operators' ? 'border-primary-300' : 'border-transparent'
                )}
              >
                <Icons.UserMultiple02
                  size={24}
                  className={cn(
                    'mx-0.5 my-1',
                    activeRightCardTab === 'operators' ? 'text-secondary-800' : 'text-gray-700'
                  )}
                />
              </button>
            </div>

            {/* Right side content for selected right card tab */}
            <div className="flex flex-1 flex-col items-start gap-6 p-0">
              {/* Tab 1: Loans */}
              {activeRightCardTab === 'loans' && (
                <div className="flex w-full flex-col gap-4">
                  <div className="flex min-h-[44px] items-center gap-6 self-stretch border-b border-gray-200 px-6 pt-6 pb-0">
                    <button
                      onClick={() => setActiveLoanTab('process')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activeLoanTab === 'process'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.loansInProcess')}
                    </button>
                    <button
                      onClick={() => setActiveLoanTab('closed')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activeLoanTab === 'closed'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.closedLoans')}
                    </button>
                    <button
                      onClick={() => setActiveLoanTab('rr')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activeLoanTab === 'rr'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.loansOnRR')}
                    </button>
                  </div>
                  <div className="flex flex-col items-start gap-2.5 self-stretch px-6">
                    <DataTable columns={loanColumns} data={client.loans} className="w-full" />
                  </div>
                  <div className="flex flex-wrap content-start items-start gap-3 self-stretch p-[0_24px_24px_24px]">
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.MoneyRemove01 size={20} />}
                      className="rounded"
                    >
                      {t('pages.clients.detail.writeOff')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.MoneyNotFound04 size={20} />}
                      className="rounded"
                    >
                      {t('pages.clients.detail.reversal')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.CancelCircle size={20} />}
                      className="rounded"
                    >
                      {t('pages.clients.detail.closeLoan')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.MailSend01 size={20} />}
                      className="rounded"
                    >
                      {t('pages.clients.detail.sendToUBCI')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.Calculate size={20} />}
                      className="rounded"
                    >
                      {t('pages.clients.detail.rrCalculator')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.PlusSignCircle size={20} />}
                      className="rounded"
                    >
                      {t('pages.clients.detail.makePayment')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Payments */}
              {activeRightCardTab === 'payments' && (
                <div className="flex w-full flex-col gap-4">
                  <div className="flex min-h-[44px] items-center gap-6 self-stretch border-b border-gray-200 px-6 pt-6 pb-0">
                    <button
                      onClick={() => setActivePaymentTab('payments')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activePaymentTab === 'payments'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.payments')}
                    </button>
                    <button
                      onClick={() => setActivePaymentTab('writes-off')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activePaymentTab === 'writes-off'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.writesOff')}
                    </button>
                    <button
                      onClick={() => setActivePaymentTab('primary-creditor')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activePaymentTab === 'primary-creditor'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.paymentToPrimaryCreditor')}
                    </button>
                  </div>
                  <div className="flex flex-col items-start gap-2.5 self-stretch px-6">
                    {activePaymentTab === 'payments' && (
                      <DataTable
                        columns={paymentColumns}
                        data={client.payments}
                        className="w-full"
                      />
                    )}
                    {activePaymentTab === 'writes-off' && (
                      <DataTable
                        columns={writeOffColumns}
                        data={client.writesOffs}
                        className="w-full"
                      />
                    )}
                    {activePaymentTab === 'primary-creditor' && (
                      <DataTable
                        columns={primaryCreditorPaymentColumns}
                        data={client.primaryCreditorPayments}
                        className="w-full"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Operators/Searchers */}
              {activeRightCardTab === 'operators' && (
                <div className="flex w-full flex-col gap-4">
                  <div className="flex min-h-[44px] items-center gap-6 self-stretch border-b border-gray-200 px-6 pt-6 pb-0">
                    <button
                      onClick={() => setActiveOperatorTab('operators')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activeOperatorTab === 'operators'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.operators')}
                    </button>
                    <button
                      onClick={() => setActiveOperatorTab('searchers')}
                      className={cn(
                        'text-dark-500 flex items-center justify-center gap-2.5 border-b-[3px] border-transparent pb-5 text-sm leading-[150%] font-medium tracking-[-0.28px]',
                        activeOperatorTab === 'searchers'
                          ? 'border-primary-300 border-b-[3px]'
                          : 'hover:text-dark-500 cursor-pointer text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.searchers')}
                    </button>
                  </div>
                  <div className="flex flex-col items-start gap-2.5 self-stretch px-6">
                    {activeOperatorTab === 'operators' && (
                      <DataTable
                        columns={operatorColumns}
                        data={client.operators}
                        className="w-full"
                      />
                    )}
                    {activeOperatorTab === 'searchers' && (
                      <DataTable
                        columns={searcherColumns}
                        data={client.searchers}
                        className="w-full"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Call and SMS History */}
              {activeRightCardTab === 'call-sms-history' && (
                <div className="flex flex-1 flex-col items-start justify-end gap-5 self-stretch p-6">
                  <div className="flex h-[41px] items-center gap-5 self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        {t('pages.clients.detail.callAndSMSHistory')}
                      </span>
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-1 rounded-lg bg-white p-1 shadow-sm">
                      <button
                        onClick={() => setActiveCallSmsTab('all')}
                        className={cn(
                          'flex max-w-[120px] flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors',
                          activeCallSmsTab === 'all'
                            ? 'bg-secondary-800 text-white'
                            : 'text-dark-500 hover:text-secondary-800 hover:bg-primary-500/10 cursor-pointer'
                        )}
                      >
                        {t('pages.clients.activity.all')}
                      </button>
                      <button
                        onClick={() => setActiveCallSmsTab('calls')}
                        className={cn(
                          'flex max-w-[120px] flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors',
                          activeCallSmsTab === 'calls'
                            ? 'bg-secondary-800 text-white'
                            : 'text-dark-500 hover:text-secondary-800 hover:bg-primary-500/10 cursor-pointer'
                        )}
                      >
                        {t('pages.clients.activity.calls')}
                      </button>
                      <button
                        onClick={() => setActiveCallSmsTab('sms')}
                        className={cn(
                          'flex max-w-[120px] flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors',
                          activeCallSmsTab === 'sms'
                            ? 'bg-secondary-800 text-white'
                            : 'text-dark-500 hover:text-secondary-800 hover:bg-primary-500/10 cursor-pointer'
                        )}
                      >
                        {t('pages.clients.activity.sms')}
                      </button>
                    </div>
                    <div className="flex flex-1 flex-col items-end gap-2.5">
                      <Button
                        leftIcon={<Icons.Download size={20} />}
                        className="bg-secondary-800 flex flex-row items-center gap-1 rounded px-4 py-2.5 text-xs leading-[140%] font-medium tracking-[-0.24px] text-white"
                      >
                        {t('pages.clients.detail.exportCSV')}
                      </Button>
                    </div>
                  </div>
                  {activeCallSmsTab === 'all' && (
                    <div className="flex flex-col items-start gap-6 self-stretch">
                      {/* Date-grouped Calls and SMS */}
                      {(() => {
                        // Combine calls and SMS, group by date
                        const allItems = [
                          ...client.callSmsHistory.calls.map((item) => ({
                            ...item,
                            itemType: 'call' as const,
                          })),
                          ...client.callSmsHistory.sms.map((item) => ({
                            ...item,
                            itemType: 'sms' as const,
                          })),
                        ]

                        const grouped = allItems.reduce(
                          (acc, item) => {
                            const date = new Date(item.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                            if (!acc[date]) acc[date] = { calls: [], sms: [] }
                            if (item.itemType === 'call') {
                              acc[date].calls.push(
                                item as (typeof client.callSmsHistory.calls)[0] & {
                                  itemType: 'call'
                                }
                              )
                            } else {
                              acc[date].sms.push(
                                item as (typeof client.callSmsHistory.sms)[0] & { itemType: 'sms' }
                              )
                            }
                            return acc
                          },
                          {} as Record<
                            string,
                            {
                              calls: ((typeof client.callSmsHistory.calls)[0] & {
                                itemType: 'call'
                              })[]
                              sms: ((typeof client.callSmsHistory.sms)[0] & { itemType: 'sms' })[]
                            }
                          >
                        )

                        return Object.entries(grouped)
                          .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                          .map(([date, items]) => (
                            <div key={date} className="w-full space-y-4">
                              <h3 className="text-dark-500 text-base font-semibold">{date}</h3>
                              <div className="grid grid-cols-2 gap-4">
                                {/* Calls for this date */}
                                {items.calls.map((call) => (
                                  <CallLogCard
                                    key={`call-${call.id}`}
                                    clientName={client.fullName}
                                    title={`${t('pages.clients.detail.play')} (${call.duration})`}
                                    time={call.time}
                                    date={call.date}
                                    duration={call.duration}
                                    status={call.status}
                                    type={call.type}
                                    phone={call.phone}
                                    line={call.line}
                                    operator={call.operator}
                                    call_id={
                                      'call_id' in call ? (call.call_id as string) : undefined
                                    }
                                    icon={
                                      <Icons.PlayCircle02
                                        size={20}
                                        className="text-secondary-800"
                                      />
                                    }
                                    setSelectedCallData={setSelectedCallData}
                                    setIsCallRecordingModalOpen={setIsCallRecordingModalOpen}
                                  />
                                ))}
                                {/* SMS for this date */}
                                {items.sms.map((sms) => (
                                  <CallLogCard
                                    key={`sms-${sms.id}`}
                                    clientName={client.fullName}
                                    title={t('pages.clients.detail.viewSms')}
                                    time={sms.time}
                                    date={sms.date}
                                    status={sms.status}
                                    template={sms.template}
                                    message={sms.message}
                                    operator={sms.operator}
                                    icon={
                                      <Icons.ChatFeedback01
                                        size={20}
                                        className="text-secondary-800"
                                      />
                                    }
                                    setSelectedSMSData={setSelectedSMSData}
                                    setIsViewSMSModalOpen={setIsViewSMSModalOpen}
                                  />
                                ))}
                              </div>
                            </div>
                          ))
                      })()}
                    </div>
                  )}
                  {activeCallSmsTab === 'calls' && (
                    <div className="flex flex-col items-start gap-4 self-stretch">
                      {/* Summary Statistics */}
                      <div className="flex h-14 w-full items-start gap-5 p-0">
                        <div className="flex flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-5 py-2 pl-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                              <Icons.Call02 size={24} className="text-gray-700" />
                            </div>
                            <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                              Total Calls
                            </div>
                          </div>
                          <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                            {client.callSmsHistory.calls.length}
                          </div>
                        </div>
                        <div className="flex flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-5 py-2 pl-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                              <Icons.CallDone02 size={24} className="text-gray-700" />
                            </div>
                            <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                              Answered
                            </div>
                          </div>
                          <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                            {(() => {
                              const answered = client.callSmsHistory.calls.filter(
                                (c) => c.status === 'Answered'
                              ).length
                              const total = client.callSmsHistory.calls.length
                              const percentage =
                                total > 0 ? Math.round((answered / total) * 100) : 0
                              return `${answered} (${percentage}%)`
                            })()}
                          </div>
                        </div>
                        <div className="flex flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-5 py-2 pl-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                              <Icons.Clock01 size={24} className="text-gray-700" />
                            </div>
                            <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                              Avg. Duration
                            </div>
                          </div>
                          <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                            {(() => {
                              const durations = client.callSmsHistory.calls
                                .filter((c) => c.duration)
                                .map((c) => {
                                  const match = c.duration?.match(/(\d+)m (\d+)s/)
                                  if (match) {
                                    return parseInt(match[1]) * 60 + parseInt(match[2])
                                  }
                                  return 0
                                })
                              if (durations.length === 0) return '0m 0s'
                              const avg = Math.round(
                                durations.reduce((a, b) => a + b, 0) / durations.length
                              )
                              const minutes = Math.floor(avg / 60)
                              const seconds = avg % 60
                              return `${minutes}m ${seconds}s`
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Date-grouped Calls */}
                      <div className="w-full space-y-6">
                        {(() => {
                          const groupedCalls = client.callSmsHistory.calls.reduce(
                            (acc, call) => {
                              const date = new Date(call.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                              if (!acc[date]) acc[date] = []
                              acc[date].push(call)
                              return acc
                            },
                            {} as Record<string, typeof client.callSmsHistory.calls>
                          )

                          return Object.entries(groupedCalls)
                            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                            .map(([date, calls]) => (
                              <div key={date} className="space-y-4">
                                <h3 className="text-dark-500 text-base font-semibold">{date}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                  {calls.map((call) => (
                                    <CallLogCard
                                      key={call.id}
                                      clientName={client.fullName}
                                      title={`${t('pages.clients.detail.play')} (${call.duration})`}
                                      time={call.time}
                                      date={call.date}
                                      duration={call.duration}
                                      status={call.status}
                                      type={call.type}
                                      phone={call.phone}
                                      line={call.line}
                                      operator={call.operator}
                                      call_id={
                                        'call_id' in call ? (call.call_id as string) : undefined
                                      }
                                      icon={
                                        <Icons.PlayCircle02
                                          size={20}
                                          className="text-secondary-800"
                                        />
                                      }
                                      setSelectedCallData={setSelectedCallData}
                                      setIsCallRecordingModalOpen={setIsCallRecordingModalOpen}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))
                        })()}
                      </div>
                    </div>
                  )}
                  {activeCallSmsTab === 'sms' && (
                    <div className="flex flex-col items-start gap-4 self-stretch">
                      {/* Summary Statistics */}
                      <div className="flex h-14 w-full items-start gap-5 p-0">
                        <div className="flex flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-5 py-4 pl-3">
                          <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                            {t('pages.clients.detail.totalCost')}
                          </div>

                          <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                            ₹15.00 ({client.callSmsHistory.sms.length}{' '}
                            {t('pages.clients.modals.viewSMS.smsParts')})
                          </div>
                        </div>
                        <div className="flex flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-5 py-4 pl-3">
                          <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                            {t('pages.clients.detail.deliveryRate')}
                          </div>

                          <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                            {(() => {
                              const delivered = client.callSmsHistory.sms.filter(
                                (s) => s.status === 'Delivered'
                              ).length
                              const failed = client.callSmsHistory.sms.filter(
                                (s) => (s.status as string) === 'Failed'
                              ).length
                              const pending = client.callSmsHistory.sms.filter(
                                (s) => (s.status as string) === 'Pending'
                              ).length
                              const total = client.callSmsHistory.sms.length
                              const rate = total > 0 ? Math.round((delivered / total) * 100) : 0
                              return `${rate}% (${delivered} ${t('pages.clients.detail.delivered')}, ${failed} ${t('pages.clients.detail.failed')}, ${pending} ${t('pages.clients.detail.pending')})`
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Date-grouped SMS */}
                      <div className="w-full space-y-6">
                        {(() => {
                          const groupedSms = client.callSmsHistory.sms.reduce(
                            (acc, sms) => {
                              const date = new Date(sms.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                              if (!acc[date]) acc[date] = []
                              acc[date].push(sms)
                              return acc
                            },
                            {} as Record<string, typeof client.callSmsHistory.sms>
                          )

                          return Object.entries(groupedSms)
                            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                            .map(([date, smsList]) => (
                              <div key={date} className="space-y-4">
                                <h3 className="text-dark-500 text-base font-semibold">{date}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                  {smsList.map((sms) => (
                                    <CallLogCard
                                      key={sms.id}
                                      clientName={client.fullName}
                                      title={t('pages.clients.detail.viewSms')}
                                      time={sms.time}
                                      date={sms.date}
                                      status={sms.status}
                                      template={sms.template}
                                      message={sms.message}
                                      operator={sms.operator}
                                      icon={
                                        <Icons.ChatFeedback01
                                          size={20}
                                          className="text-secondary-800"
                                        />
                                      }
                                      setSelectedSMSData={setSelectedSMSData}
                                      setIsViewSMSModalOpen={setIsViewSMSModalOpen}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Tasks */}
              {activeRightCardTab === 'tasks' && (
                <div className="flex flex-1 flex-col items-start gap-2.5 self-stretch p-6">
                  <DataTable columns={taskColumns} data={client.tasks} className="w-full" />
                </div>
              )}

              {/* Tab 3: Documents - Shows Call and SMS History table per Figma */}
              {activeRightCardTab === 'documents' && (
                <div className="flex flex-1 flex-col items-start gap-2.5 self-stretch p-6">
                  <DataTable
                    columns={callSmsHistoryColumns}
                    data={client.callSmsHistory.all}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="flex items-center gap-5 self-stretch rounded-xl border border-white bg-white/50 p-3">
        <div className="flex w-[416px] flex-col items-start gap-2.5">
          <div className="flex items-center rounded-lg border border-white bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveCommentTab('comments')}
              className={cn(
                'text-dark-500 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px]',
                activeCommentTab === 'comments'
                  ? 'bg-secondary-800 text-white'
                  : 'hover:bg-primary-200/10 hover:text-secondary-800'
              )}
            >
              {t('pages.clients.detail.comments')}
            </button>
            <button
              onClick={() => setActiveCommentTab('primary')}
              className={cn(
                'text-dark-500 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px]',
                activeCommentTab === 'primary'
                  ? 'bg-secondary-800 text-white'
                  : 'hover:bg-primary-200/10 hover:text-secondary-800'
              )}
            >
              {t('pages.clients.detail.commentsFromPrimaryCreditor')}
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 self-stretch">
          {client.comments.map((comment) => (
            <div key={comment.id} className="flex flex-1 items-center gap-2 self-stretch">
              <span className="truncate text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-700">
                {comment.date}
              </span>
              <span className="text-dark-500 flex-1 truncate text-sm leading-[150%] font-light tracking-[-0.28px]">
                {' '}
                {comment.text}
              </span>
              <LinkButton variant="regular-secondary" size="xs">
                {t('pages.clients.detail.readMore')}
              </LinkButton>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-6">
        <div className="flex items-center justify-between self-stretch">
          <h2 className="text-dark-500 text-lg font-medium">
            {t('pages.clients.detail.recentActivityTimeline')}
          </h2>
          <LinkButton
            variant="regular-secondary"
            size="xs"
            onClick={() => navigate(`/dashboard/clients/${client.id}/activity`)}
            rightIcon={<Icons.ArrowRight size={18} />}
          >
            {t('pages.clients.detail.viewAll')}
          </LinkButton>
        </div>
        {client.activities.length == 0 ? (
          <div className="flex flex-col items-center gap-6 self-stretch">
            <div className="flex items-center justify-center gap-6 self-stretch">
              <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
              <p className="text-dark-500 text-center text-2xl leading-tight font-light tracking-[-0.48px]">
                {t('pages.clients.detail.noHistoryYet')}
              </p>
            </div>
            <p className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
              {t('pages.clients.detail.startByCallingSendingSMSOrAddingNote')}
            </p>
            <button
              className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
              aria-label={t('pages.clients.detail.addFirstNote')}
            >
              <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
                <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
              </div>
              <span className="px-4 py-3 text-sm font-medium text-white">
                {t('pages.clients.detail.addFirstNote')}
              </span>
            </button>
          </div>
        ) : (
          <DataTable columns={activityColumns} data={client.activities} className="w-full" />
        )}
      </div>

      {/* Add Note Modal */}
      <AddNoteModal
        open={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        phoneNumber={client.phones?.[0]?.number || ''}
        onSave={(data) => {
          // TODO: Save note to API
          console.log('Note saved:', data)
        }}
      />

      {/* Call Dialog Modal */}
      <CallDialogModal
        open={isCallModalOpen}
        onClose={() => {
          setOpenCallModal(null)
          setIsCallModalOpen(false)
          setCurrentCallId(null)
          handleClearCallError()
        }}
        clientName={client.fullName}
        phoneNumber={client.phones?.[0]?.number || ''}
        callId={currentCallId}
        initialState="initial"
        error={callError}
        isLoading={isOriginatingCall}
        onCallStart={(_callType: CallType) => {
          // User selected call type and clicked "Call Now"
          const phoneNumber = client.phones?.[0]?.number
          if (!phoneNumber) {
            setCallError('Client has no phone number')
            return
          }

          // Originate call via API (callType can be used for future call type handling)
          handleOriginateCall(phoneNumber, client.fullName, client.id.toString())
        }}
        onCallEnd={(duration: number, status: CallStatus) => {
          console.log('Call ended:', { duration, status })
          setOpenCallModal(null)
          setCurrentCallId(null)
        }}
        onRetry={() => {
          handleClearCallError()
        }}
      />

      {/* Call Recording Modal */}
      {selectedCallData && (
        <CallRecordingModal
          open={isCallRecordingModalOpen}
          onClose={() => {
            setOpenCallModal(null)
            setIsCallRecordingModalOpen(false)
            setSelectedCallData(null)
          }}
          callData={selectedCallData}
        />
      )}

      {/* View SMS Modal */}
      {selectedSMSData && (
        <ViewSMSModal
          open={isViewSMSModalOpen}
          onClose={() => {
            setIsViewSMSModalOpen(false)
            setSelectedSMSData(null)
          }}
          smsData={selectedSMSData}
        />
      )}

      {/* Send SMS Modal */}
      <SendSMSModal
        open={isSendSMSModalOpen}
        onClose={() => {
          setIsSendSMSModalOpen(false)
          setSelectedPhoneForSMS('')
        }}
        clientId={clientId}
        clientName={client.fullName}
        phoneNumber={selectedPhoneForSMS || client.phones?.[0]?.number || ''}
        debtAmount={client.loans?.reduce((sum, loan) => sum + (loan.totalToRepay || 0), 0) || 0}
        onSent={() => {
          // SMS sent successfully - history will refresh automatically via query invalidation
        }}
      />

      {/* Tag Selector Modal */}
      <TagSelectorModal
        open={isTagModalOpen}
        clientId={clientId}
        clientName={client.fullName}
        projectId={1}
        onClose={() => setIsTagModalOpen(false)}
      />
    </div>
  )
}

export default ClientDetailPage
