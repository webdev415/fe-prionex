/**
 * Plain sample JSON per client-detail API. No functions, no id logic.
 * Replace with real API later.
 */

export const mockClientProfile = {
  id: 1,
  fullName: 'Veronika Denisovna Lapina',
  taxIdNumber: '12145878778',
  phoneNumber: '+380931234567',
  score: 88,
  priority: 'High' as const,
  department: 'Credit',
  responsibleEmployee: 'Sofia Andreevna Belova',
  responsibleResearcher: 'Eva Pavlovna Smirnova',
  phones: [
    { number: '+380931234567', type: 'primary' as const },
    { number: '+380931234577', type: 'secondary' as const },
  ],
  tags: ['Bankrupt', 'Did not answer the phone'],
  personalDetails: {
    tin: '12145878778',
    dateOfBirth: '09/05/1904',
    age: 41,
    passport: '1214587877',
    maritalStatus: 'Contactable',
    familyMembers: 5,
    incomeLevel: '$9,000',
    employmentType: 'Full-time',
  },
  work: {
    organizationName: 'TechCorp Solutions',
    position: 'Senior Developer',
    experience: '8 years',
    managerFullName: 'Dmitry Alexandrovich Ivanov',
  },
  recommenders: [
    {
      id: 1,
      contactValue: '+3809321234567',
      contactType: 'Third party mobile phone',
      comment: 'give their best on and off the field',
    },
    {
      id: 2,
      contactValue: '+3809331234567',
      contactType: 'Third party home phone',
      comment: 'always inspiring the team to give their best.',
    },
  ],
  addresses: {
    registrationAddress: '15 Garden Street, Kyiv, Ukraine, 01001',
    personalAddress: '27 Maple Avenue, Lviv, Ukraine, 79000',
  },
  comments: [
    {
      id: 1,
      date: '01/12/2023',
      text: "In a conversation about loans, a friend said it's important not to hesitate to ask the bank questions...",
      author: 'Sofia Andreevna Belova',
    },
  ],
}

export const mockClientLoans = [
  {
    id: 1,
    loanNumber: '31',
    counterparty: 'Gamma',
    saleDate: '01.23.2023',
    loanAmount: 21000,
    principalDebt: 10500,
    totalToRepay: 65000,
  },
  {
    id: 2,
    loanNumber: '11',
    counterparty: 'Acme Corp.',
    saleDate: '02.20.2023',
    loanAmount: 22800,
    principalDebt: 12600,
    totalToRepay: 68000,
  },
]

export const mockClientPayments = [
  {
    id: 1,
    loanNumber: '31',
    counterparty: 'Gamma',
    saleDate: '01.23.2023',
    paymentDate: '01.23.2023',
    amount: 21000,
    paymentMethod: 'Card',
    status: 'Failed',
    paymentDistribution: '₴ 2100 loan body ₴ 350 commisss',
    employee: 'Sidorov',
  },
]

export const mockClientWritesOffs = [
  {
    id: 1,
    loanNumber: '31',
    counterparty: 'Gamma',
    saleDate: '01.23.2023',
    writeOffDate: '01.23.2023',
    amount: 21000,
    writeOffMethod: 'Card',
    employee: 'Sidorov',
  },
]

export const mockClientPaymentsToPrimaryCreditor = [
  {
    id: 1,
    loanNumber: '31',
    counterparty: 'Gamma',
    saleDate: '01.23.2023',
    paymentDate: '01.23.2023',
    amount: 21000,
    distributionMethod: 'Commission-based',
  },
]

export const mockClientCallSmsHistory = {
  all: [
    {
      id: 1,
      date: '2025-12-01',
      time: '15:30',
      type: 'Call' as const,
      number: '+380931234567',
      phone: '+380931234567',
      phoneLabel: 'Primary',
      status: 'Answered',
      duration: '3 min',
      operator: 'Svitlana',
      cost: 0.5,
    },
    {
      id: 2,
      date: '2025-12-01',
      time: '16:00',
      type: 'SMS' as const,
      number: '+380931234567',
      phone: '+380931234567',
      phoneLabel: 'Primary',
      status: 'Delivered',
      template: 'Payment Reminder',
      message: 'Payment reminder sent.',
      operator: 'Svitlana',
      cost: 0.1,
    },
  ],
  calls: [
    {
      id: 1,
      date: '2025-12-01',
      time: '15:30',
      phone: '+380931234567',
      phoneLabel: 'Primary',
      status: 'Answered',
      duration: '3 min',
      operator: 'Svitlana',
      cost: 0.5,
      type: 'Outgoing' as const,
      line: 'White Line',
    },
  ],
  sms: [
    {
      id: 1,
      date: '2025-12-01',
      time: '16:00',
      phone: '+380931234567',
      phoneLabel: 'Primary',
      status: 'Delivered',
      template: 'Payment Reminder',
      message: 'Payment reminder sent.',
      operator: 'Svitlana',
      cost: 0.1,
    },
    {
      id: 2,
      date: '2025-12-01',
      time: '17:00',
      phone: '+380931234567',
      phoneLabel: 'Primary',
      status: 'Pending',
      template: 'Payment Reminder',
      message: '',
      operator: 'Svitlana',
      cost: 0.1,
    },
  ],
}

export const mockClientTasks = [
  {
    id: 1,
    loanNumber: '31',
    creationDate: '01.23.2023',
    whoCreated: 'Sidorov',
    description: 'Meet Alex, who got a loan to open a café and is excited to start.',
    reminderDate: '01.23.2023',
    reminderRecipient: 'Shevchenko',
  },
]

export const mockClientOperators = [
  {
    id: 1,
    creationDate: '01.23.2023',
    whoCreated: 'Sidorov',
    description: 'Meet Alex, who got a loan to open a café and is excited to start.',
    reminderDate: '01.23.2023',
    reminderRecipient: 'Shevchenko',
  },
]

export const mockClientSearchers = [
  {
    id: 1,
    creationDate: '11.23.2023',
    whoCreated: 'Shevchenko',
    description: 'Say hello to Taylor, who took a loan to redesign their home.',
    reminderDate: '01.23.2023',
    reminderRecipient: 'Shevchenko',
  },
]

export const mockClientDocuments = [
  {
    id: 1,
    name: 'Loan Agreement.pdf',
    type: 'PDF',
    uploadDate: '01.23.2023',
    size: '2.3 MB',
  },
]

export const mockClientActivities = [
  {
    id: 1,
    date: '03/12/2023',
    number: '+380931234567',
    contactType: 'Outgoing' as const,
    result: 'Refusal to pay',
    promisedAmount: 678.1,
    promisedDate: '03/12/2023',
    comment: 'I received a loan of 678 hryvnias, everything went q...',
    employee: 'Sidorov',
  },
  {
    id: 2,
    date: '04/25/2023',
    number: '+3809321234567',
    contactType: 'Incoming' as const,
    result: 'Agreement for full payment',
    promisedAmount: 765,
    promisedDate: '04/25/2023',
    comment: 'The loan of 765 hryvnias was processed without del...',
    employee: 'Shevchenko',
  },
]
