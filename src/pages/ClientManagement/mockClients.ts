/**
 * Mock Clients Data
 *
 * Shared mock data for client management and search functionality.
 * TODO: Replace with actual API calls
 */

import type { Client } from './types'

export const mockClients: Client[] = [
  {
    id: 1,
    fullName: 'Veronika Denisovna Lapina',
    taxIdNumber: '4578963215',
    tags: ['Bankrupt', 'Fraudster'],
    phoneNumber: '+380 95 123 4567',
    dateOfSale: '12.03.2023',
    creditor: 'Miko',
    debt: 45678,
    amountOfDebt: 45678,
    priority: 'Critical',
    score: 90,
  },
  {
    id: 2,
    fullName: 'Alexandra Petrovna Ilyina',
    taxIdNumber: '7896541230',
    tags: ['Insolvent', 'Deceiver'],
    phoneNumber: '+380 66 987 6543',
    dateOfSale: '25.04.2023',
    creditor: 'Liko',
    debt: 98765,
    amountOfDebt: 98765,
    priority: 'Medium',
    score: 10,
  },
  {
    id: 3,
    fullName: 'Sofia Andreevna Belova',
    taxIdNumber: '1236547890',
    tags: ['Financially insolvent'],
    phoneNumber: '+380 73 555 1212',
    dateOfSale: '01.05.2023',
    creditor: 'Fino',
    debt: 12345,
    amountOfDebt: 12345,
    priority: 'Low',
    score: 12,
  },
  {
    id: 4,
    fullName: 'Polina Antonovna Volkova',
    taxIdNumber: '9874563215',
    tags: ['Creditor', 'Con artist'],
    phoneNumber: '+380 50 222 3434',
    dateOfSale: '14.05.2023',
    creditor: 'Kreo',
    debt: 78901,
    amountOfDebt: 78901,
    priority: 'Low',
    score: 78,
  },
  {
    id: 5,
    fullName: 'Valeria Maksimovna Kuznetsova',
    taxIdNumber: '3692581470',
    tags: ['Insolvent', 'Fraudulent'],
    phoneNumber: '+380 99 111 5656',
    dateOfSale: '30.05.2023',
    creditor: 'Krio',
    debt: 55522,
    amountOfDebt: 55522,
    priority: 'Medium',
    score: 34,
  },
  {
    id: 6,
    fullName: 'Ksenia Ilyinichna Sokolova',
    taxIdNumber: '1470369258',
    tags: ['Financially insolvent'],
    phoneNumber: '+380 63 444 7878',
    dateOfSale: '10.06.2023',
    creditor: 'Laim',
    debt: 67890,
    amountOfDebt: 67890,
    priority: 'High',
    score: 56,
  },
  {
    id: 7,
    fullName: 'Victoria Egorovna Zhukova',
    taxIdNumber: '2589631470',
    tags: ['Employee', 'Con arti'],
    phoneNumber: '+380 97 666 9090',
    dateOfSale: '22.06.2023',
    creditor: 'Viko',
    debt: 32112,
    amountOfDebt: 32112,
    priority: 'Critical',
    score: 23,
  },
  {
    id: 8,
    fullName: 'Alina Nikitichna Popova',
    taxIdNumber: '7418529630',
    tags: ['Creditor', 'Fraudster'],
    phoneNumber: '+380 67 888 2323',
    dateOfSale: '04.07.2023',
    creditor: 'Treo',
    debt: 89034,
    amountOfDebt: 89034,
    priority: 'High',
    score: 89,
  },
  {
    id: 9,
    fullName: 'Eva Pavlovna Smirnova',
    taxIdNumber: '8520147963',
    tags: ['Financially insolvent'],
    phoneNumber: '+380 93 777 4545',
    dateOfSale: '18.07.2023',
    creditor: 'Lime',
    debt: 23456,
    amountOfDebt: 23456,
    priority: 'Medium',
    score: 11,
  },
  {
    id: 10,
    fullName: 'Margarita Lvovna Morozova',
    taxIdNumber: '9637418520',
    tags: ['Insolvent', 'Con artis'],
    phoneNumber: '+380 50 333 6767',
    dateOfSale: '02.08.2023',
    creditor: 'Kred',
    debt: 90123,
    amountOfDebt: 90123,
    priority: 'Low',
    score: 50,
  },
  // Generate additional mock clients to reach 1200 total
  ...Array.from({ length: 1190 }, (_, i) => {
    const id = 11 + i
    const priorities: Array<'Critical' | 'High' | 'Medium' | 'Low'> = [
      'Critical',
      'High',
      'Medium',
      'Low',
    ]
    const priority = priorities[i % 4] as 'Critical' | 'High' | 'Medium' | 'Low'
    const creditors = [
      'Miko',
      'Liko',
      'Fino',
      'Kreo',
      'Krio',
      'Laim',
      'Viko',
      'Treo',
      'Lime',
      'Kred',
    ]
    const tagsOptions = [
      ['Bankrupt', 'Fraudster'],
      ['Insolvent', 'Deceiver'],
      ['Financially insolvent'],
      ['Creditor', 'Con artist'],
      ['Employee', 'Con arti'],
      ['Insolvent', 'Fraudulent'],
    ]

    // Generate debt based on priority
    let debt = 0
    switch (priority) {
      case 'Critical':
        debt = 30000 + (i % 20000)
        break
      case 'High':
        debt = 5000 + (i % 10000)
        break
      case 'Medium':
        debt = 20000 + (i % 60000)
        break
      case 'Low':
        debt = 500 + (i % 5000)
        break
    }

    return {
      id,
      fullName: `Client ${id}`,
      taxIdNumber: `${1000000000 + id}`,
      tags: tagsOptions[i % tagsOptions.length],
      phoneNumber: `+380 ${50 + (i % 50)} ${1000000 + (i % 1000000)}`,
      dateOfSale: `${String((i % 28) + 1).padStart(2, '0')}.${String((i % 12) + 1).padStart(2, '0')}.2023`,
      creditor: creditors[i % creditors.length],
      debt,
      amountOfDebt: debt,
      priority,
      score: i % 100,
    }
  }),
]
