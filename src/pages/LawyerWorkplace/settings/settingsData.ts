import type { LetterTypeConfig, SettingsLawyer, TrainingExample } from './types'

function makeExample(
  id: string,
  titleKey: string,
  titleFallback: string,
  bodyKey: string,
  bodyFallback: string,
  sourceKey: string,
  sourceFallback: string,
  isPlaceholder?: boolean
): TrainingExample {
  return {
    id,
    titleKey,
    titleFallback,
    bodyKey,
    bodyFallback,
    sourceKey,
    sourceFallback,
    isPlaceholder,
  }
}

function makeExampleFromLegacy(
  id: string,
  textKey: string,
  textFallback: string,
  sourceKey: string,
  sourceFallback: string
): TrainingExample {
  const splitIndex = textFallback.indexOf(' — ')
  if (splitIndex === -1) {
    return makeExample(
      id,
      textKey,
      textFallback,
      `${textKey}Body`,
      textFallback,
      sourceKey,
      sourceFallback
    )
  }
  return makeExample(
    id,
    textKey,
    textFallback.slice(0, splitIndex),
    `${textKey}Body`,
    textFallback.slice(splitIndex + 3),
    sourceKey,
    sourceFallback
  )
}

export const INITIAL_LETTER_TYPES: LetterTypeConfig[] = [
  {
    id: 'complaint',
    slug: 'complaint',
    nameKey: 'pages.lawyerWorkplace.settings.letterTypes.items.customerComplaint',
    nameFallback: 'Customer complaint',
    colorId: 'red',
    slaDays: 30,
    descriptionKey: 'pages.lawyerWorkplace.settings.letterTypes.descriptions.customerComplaint',
    descriptionFallback:
      'Direct customer complaints about service, charges, or payment processing.',
    letterCount: 41,
    examples: [
      makeExample(
        'ex-1',
        'pages.lawyerWorkplace.settings.letterTypes.examples.latePaymentTitle',
        'Late-payment interest complaint',
        'pages.lawyerWorkplace.settings.letterTypes.examples.latePaymentBody',
        'I am writing to file a formal complaint regarding the interest charges applied to my account CR-2024-00518. The accrued penalties appear to exceed the contractual rate stated in my loan agreement.',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromPetrenko',
        'from I. Petrenko'
      ),
      makeExample(
        'ex-2',
        'pages.lawyerWorkplace.settings.letterTypes.examples.collectionHarassmentTitle',
        'Collection harassment claim',
        'pages.lawyerWorkplace.settings.letterTypes.examples.collectionHarassmentBody',
        'Multiple daily calls have been made to my personal number despite my request to communicate only in writing. I ask that you provide a written callback schedule.',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromMelnyk',
        'from S. Melnyk'
      ),
      makeExample(
        'ex-3',
        'pages.lawyerWorkplace.settings.letterTypes.examples.incorrectBalanceTitle',
        'Incorrect balance dispute',
        'pages.lawyerWorkplace.settings.letterTypes.examples.incorrectBalanceBody',
        'I am attaching bank statements showing partial payments that were not credited to my account. Please review and correct the outstanding balance.',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromBohdanenko',
        'from O. Bohdanenko'
      ),
      makeExample(
        'ex-4',
        'pages.lawyerWorkplace.settings.letterTypes.examples.serviceQualityTitle',
        'Service quality complaint',
        'pages.lawyerWorkplace.settings.letterTypes.examples.serviceQualityBody',
        'During my last call your operator used inappropriate language and refused to provide their name. I request a written apology and confirmation of corrective action.',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromNalivaiko',
        'from A. Nalivaiko'
      ),
      makeExample(
        'ex-5',
        'pages.lawyerWorkplace.settings.letterTypes.examples.earlyRepaymentTitle',
        'Early repayment penalty dispute',
        'pages.lawyerWorkplace.settings.letterTypes.examples.earlyRepaymentBody',
        'I believe the early repayment penalty applied to my loan is not supported by the original contract. Please provide the clause reference or remove the charge.',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromKovalenko',
        'from N. Kovalenko'
      ),
      makeExample(
        'ex-6',
        'pages.lawyerWorkplace.settings.letterTypes.examples.thirdPartyTitle',
        'Third-party contact complaint',
        'pages.lawyerWorkplace.settings.letterTypes.examples.thirdPartyBody',
        'Your collector contacted my employer without my consent, which I believe violates applicable collection regulations. Please confirm this will not happen again.',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromShevchenko',
        'from M. Shevchenko'
      ),
      makeExample(
        'ex-7',
        'pages.lawyerWorkplace.settings.letterTypes.examples.creditReportTitle',
        'Credit bureau reporting error',
        'pages.lawyerWorkplace.settings.letterTypes.examples.creditReportBody',
        'My credit report still shows an outdated default status despite the settlement completed last year. Please update the bureau records accordingly.',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromKravchenko',
        'from T. Kravchenko'
      ),
    ],
    priorities: [
      { lawyerId: 'vd', stars: 4, role: 'primary' },
      { lawyerId: 'lk', stars: 3, role: 'backup' },
      { lawyerId: 'sm', stars: 2, role: 'secondary' },
      { lawyerId: 'ak', stars: 0, role: 'off' },
    ],
    keywordHints: [
      'complaint',
      'protest',
      'wrongful',
      'unacceptable',
      'demand',
      'consumerProtection',
    ],
  },
  {
    id: 'nbu_inquiry',
    slug: 'nbu_inquiry',
    nameKey: 'pages.lawyerWorkplace.settings.letterTypes.items.nbuInquiry',
    nameFallback: 'NBU inquiry',
    colorId: 'teal',
    slaDays: 15,
    descriptionKey: 'pages.lawyerWorkplace.settings.letterTypes.descriptions.nbuInquiry',
    descriptionFallback:
      'Regulatory inquiries from the National Bank of Ukraine requiring formal compliance responses.',
    letterCount: 12,
    examples: [
      makeExampleFromLegacy(
        'ex-n1',
        'pages.lawyerWorkplace.settings.letterTypes.examples.nbuCreditHistory',
        'NBU credit history disclosure request — quarterly compliance filing',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromSystem',
        'from NBU portal'
      ),
      makeExampleFromLegacy(
        'ex-n2',
        'pages.lawyerWorkplace.settings.letterTypes.examples.nbuAudit',
        'NBU audit follow-up — collection activity documentation request',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromSystem',
        'from NBU portal'
      ),
      makeExampleFromLegacy(
        'ex-n3',
        'pages.lawyerWorkplace.settings.letterTypes.examples.nbuForm5',
        'Form 5-PR submission — borrower verification data',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromSystem',
        'from NBU portal'
      ),
    ],
    priorities: [
      { lawyerId: 'lk', stars: 4, role: 'primary' },
      { lawyerId: 'vd', stars: 3, role: 'backup' },
      { lawyerId: 'sm', stars: 1, role: 'secondary' },
      { lawyerId: 'ak', stars: 0, role: 'off' },
    ],
    keywordHints: [],
  },
  {
    id: 'court_claim',
    slug: 'court_claim',
    nameKey: 'pages.lawyerWorkplace.settings.letterTypes.items.courtClaim',
    nameFallback: 'Court claim',
    colorId: 'orange',
    slaDays: 20,
    descriptionKey: 'pages.lawyerWorkplace.settings.letterTypes.descriptions.courtClaim',
    descriptionFallback:
      'Court filings, summons, and legal claims requiring timely procedural responses.',
    letterCount: 8,
    examples: [
      makeExampleFromLegacy(
        'ex-c1',
        'pages.lawyerWorkplace.settings.letterTypes.examples.courtSummons',
        'District court summons — civil debt recovery case #4521/2026',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromCourt',
        'from District Court'
      ),
      makeExampleFromLegacy(
        'ex-c2',
        'pages.lawyerWorkplace.settings.letterTypes.examples.counterclaim',
        'Counterclaim filing — debtor alleges unlawful collection practices',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromAttorney',
        'from opposing counsel'
      ),
    ],
    priorities: [
      { lawyerId: 'sm', stars: 4, role: 'primary' },
      { lawyerId: 'vd', stars: 2, role: 'backup' },
      { lawyerId: 'lk', stars: 1, role: 'secondary' },
      { lawyerId: 'ak', stars: 0, role: 'off' },
    ],
    keywordHints: [],
  },
  {
    id: 'attorney_request',
    slug: 'attorney_request',
    nameKey: 'pages.lawyerWorkplace.settings.letterTypes.items.attorneyRequest',
    nameFallback: 'Attorney request',
    colorId: 'purple',
    slaDays: 10,
    descriptionKey: 'pages.lawyerWorkplace.settings.letterTypes.descriptions.attorneyRequest',
    descriptionFallback:
      'Requests from external attorneys for documentation, settlement terms, or case status.',
    letterCount: 6,
    examples: [
      makeExampleFromLegacy(
        'ex-a1',
        'pages.lawyerWorkplace.settings.letterTypes.examples.attorneyDocs',
        'Document request — full contract history and payment ledger',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromAttorney',
        'from opposing counsel'
      ),
    ],
    priorities: [
      { lawyerId: 'vd', stars: 3, role: 'primary' },
      { lawyerId: 'lk', stars: 3, role: 'backup' },
      { lawyerId: 'sm', stars: 2, role: 'secondary' },
      { lawyerId: 'ak', stars: 1, role: 'off' },
    ],
    keywordHints: [],
  },
  {
    id: 'inquiry',
    slug: 'inquiry',
    nameKey: 'pages.lawyerWorkplace.settings.letterTypes.items.generalInquiry',
    nameFallback: 'General inquiry',
    colorId: 'green',
    slaDays: 14,
    descriptionKey: 'pages.lawyerWorkplace.settings.letterTypes.descriptions.generalInquiry',
    descriptionFallback:
      'General incoming requests that do not fit other categories. Routed by content analysis.',
    letterCount: 23,
    examples: [
      makeExampleFromLegacy(
        'ex-i1',
        'pages.lawyerWorkplace.settings.letterTypes.examples.paymentPlan',
        'Payment plan inquiry — client requests restructuring options',
        'pages.lawyerWorkplace.settings.letterTypes.examples.fromPetrenko',
        'from J. Petrenko'
      ),
    ],
    priorities: [
      { lawyerId: 'ak', stars: 3, role: 'primary' },
      { lawyerId: 'lk', stars: 2, role: 'backup' },
      { lawyerId: 'vd', stars: 1, role: 'secondary' },
      { lawyerId: 'sm', stars: 0, role: 'off' },
    ],
    keywordHints: [],
  },
]

export const INITIAL_SETTINGS_LAWYERS: SettingsLawyer[] = [
  {
    id: 'vd',
    initials: 'VD',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.doroshenko',
    nameFallback: 'Volodymyr Doroshenko',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.doroshenko',
    roleFallback: 'Senior · complaints lead',
    letterTypeIds: ['complaint', 'attorney_request', 'nbu_inquiry', 'inquiry'],
    currentActive: 7,
    maxInFlight: 11,
    status: 'online',
  },
  {
    id: 'lk',
    initials: 'LK',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.kostenko',
    nameFallback: 'Larysa Kostenko',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.kostenko',
    roleFallback: 'NBU · regulatory specialist',
    letterTypeIds: ['nbu_inquiry', 'complaint', 'attorney_request'],
    currentActive: 5,
    maxInFlight: 10,
    status: 'online',
  },
  {
    id: 'sm',
    initials: 'SM',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.melnychenko',
    nameFallback: 'Serhii Melnychenko',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.melnychenko',
    roleFallback: 'Court · litigation',
    letterTypeIds: ['complaint', 'attorney_request', 'court_claim', 'inquiry'],
    currentActive: 4,
    maxInFlight: 8,
    status: 'away',
  },
  {
    id: 'ak',
    initials: 'AK',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.kovalchuk',
    nameFallback: 'Anna Kovalchuk',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.kovalchuk',
    roleFallback: 'Junior · general inquiries',
    letterTypeIds: ['inquiry', 'complaint'],
    currentActive: 2,
    maxInFlight: 6,
    status: 'online',
  },
]

export const PRIORITY_LAWYER_META = [
  {
    id: 'vd',
    initials: 'VD',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.doroshenko',
    nameFallback: 'Volodymyr Doroshenko',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.doroshenko',
    roleFallback: 'Senior · complaints lead',
    activeCount: 7,
    maxActive: 12,
  },
  {
    id: 'lk',
    initials: 'LK',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.kostenko',
    nameFallback: 'Larysa Kostenko',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.kostenkoShort',
    roleFallback: 'NBU specialist',
    activeCount: 3,
    maxActive: 8,
  },
  {
    id: 'sm',
    initials: 'SM',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.melnychenko',
    nameFallback: 'Serhii Melnychenko',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.melnychenkoShort',
    roleFallback: 'Court litigation',
    activeCount: 2,
    maxActive: 6,
  },
  {
    id: 'ak',
    initials: 'AK',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.kovalchuk',
    nameFallback: 'Anna Kovalchuk',
    roleKey: 'pages.lawyerWorkplace.settings.lawyers.roles.kovalchukShort',
    roleFallback: 'General inquiries',
    activeCount: 1,
    maxActive: 5,
  },
] as const
