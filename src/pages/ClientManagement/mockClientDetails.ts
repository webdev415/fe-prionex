/**
 * Mock Client Details Data
 *
 * Shared mock data for client detail pages.
 * TODO: Replace with actual API calls
 */

// Helper function to create mock client detail
export const createMockClientDetail = (
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
  activities:
    id === 1
      ? [
          {
            id: 1,
            date: '03/12/2023',
            number: phoneNumber,
            contactType: 'Outgoing' as const,
            // Updated to use a status label shown in the UI dropdown
            result: 'Refusal to pay',
            promisedAmount: 678.1,
            promisedDate: '03/12/2023',
            comment: 'I received a loan of 678 hryvnias, everything went q...',
            employee: 'Sidorov',
          },
          {
            id: 2,
            date: '04/25/2023',
            number: phoneNumber.replace(/(\d{2})(\d{3})/, '$1$2' + (id + 20)),
            contactType: 'Incoming' as const,
            result: 'Agreement for full payment',
            promisedAmount: 765,
            promisedDate: '04/25/2023',
            comment: 'The loan of 765 hryvnias was processed without del...',
            employee: 'Shevchenko',
          },
          {
            id: 3,
            date: '05/01/2023',
            number: phoneNumber.replace(/(\d{2})(\d{3})/, '$1$2' + (id + 30)),
            contactType: 'Outgoing' as const,
            result: 'Refusal to pay',
            promisedAmount: 345,
            promisedDate: '05/01/2023',
            comment: 'Getting a loan of 345 hryvnias was easy, I recomm...',
            employee: 'Melnik',
          },
          {
            id: 4,
            date: '05/14/2023',
            number: phoneNumber,
            contactType: 'Outgoing' as const,
            result: 'Agreement for partial payment',
            promisedAmount: 901,
            promisedDate: '05/14/2023',
            comment: 'The loan application for 901 hryvnias took just a fe...',
            employee: 'Savchenko',
          },
          {
            id: 5,
            date: '05/30/2023',
            number: phoneNumber.replace(/(\d{2})(\d{3})/, '$1$2' + (id + 40)),
            contactType: 'Outgoing' as const,
            result: 'Call back later',
            promisedAmount: 522,
            promisedDate: '05/30/2023',
            comment: 'I received a loan of 522 hryvnias without any difficu...',
            employee: 'Lysenko',
          },
        ]
      : [
          {
            id: 1,
            date: `0${id}/12/2023`,
            number: phoneNumber,
            contactType: 'Outgoing' as const,
            // Use simplified status labels for the result column (will be rendered as a status dropdown)
            result:
              id === 2
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
              id === 2
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
              id === 2
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
  paymentsToPrimaryCreditor: [
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
  tasks: [
    {
      id: 1,
      loanNumber: String(30 + id),
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
        date: '2025-12-01',
        time: `${14 + id}:30`,
        type: 'Call',
        phone: phoneNumber,
        phoneLabel: 'Primary',
        status: 'Answered',
        duration: `${2 + id} min`,
        operator: 'Svitlana',
        cost: id * 0.5,
      },
      {
        id: 2,
        date: '2025-12-01',
        time: `${15 + id}:00`,
        type: 'SMS',
        phone: phoneNumber,
        phoneLabel: 'Primary',
        status: 'Delivered',
        template: 'Payment Reminder',
        cost: id * 0.1,
      },
    ],
    calls: [
      {
        id: 1,
        date: '2025-12-01',
        time: `${14 + id}:30`,
        phone: phoneNumber,
        phoneLabel: 'Primary',
        status: 'Answered',
        duration: `${2 + id} min`,
        operator: 'Svitlana',
        cost: id * 0.5,
      },
    ],
    sms: [
      {
        id: 1,
        date: '2025-12-01',
        time: `${15 + id}:00`,
        phone: phoneNumber,
        phoneLabel: 'Primary',
        status: 'Delivered',
        template: 'Payment Reminder',
        cost: id * 0.1,
      },
      {
        id: 2,
        date: '2025-12-01',
        time: `${16 + id}:00`,
        phone: phoneNumber,
        phoneLabel: 'Primary',
        status: 'Pending',
        template: 'Payment Reminder',
        cost: id * 0.1,
      },
    ],
  },
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
export const mockClientsDetail = [
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
