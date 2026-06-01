/**
 * Mock data for the Trainer Workplace redesign (KAN-413/414/415/416 +
 * KAN-498..504). This file is the single source of truth for all FE
 * boilerplate built ahead of the backend endpoints. Each export mirrors the
 * eventual API payload shape so the swap to react-query hooks is mechanical.
 *
 * Replace with real `features/quality/*` hooks when backend lands.
 */

// ─────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────

export type ScoreBand = 'red' | 'amber' | 'green'

export interface MockOperator {
  id: number
  name: string
  initials: string
  avatarColor: string
  team: string
  department: string
  extension: string
  online: boolean
  score: number
  scoreBand: ScoreBand
  lastActiveLabel: string
}

const AVATAR_PALETTE = [
  '#E0F2EC',
  '#FEF3C7',
  '#FEE4E2',
  '#E0E7FF',
  '#FCE7F3',
  '#DBEAFE',
  '#FFEDD5',
  '#D1FAE5',
]

function scoreBandFor(score: number): ScoreBand {
  if (score >= 75) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

// ─────────────────────────────────────────────────────────────
// Header KPI strip mocks (KAN-413 §2.3)
// ─────────────────────────────────────────────────────────────

export interface MockHeaderKpis {
  inProgress: number
  averageScore: number
  averageScoreOutOf: number
  averageScoreDeltaPct: number
  teamPlanPct: number
  teamPlanDeltaPct: number
  tasksToday: number
  oneOnOneToday: number
}

export const MOCK_HEADER_KPIS: MockHeaderKpis = {
  inProgress: 3,
  averageScore: 67,
  averageScoreOutOf: 100,
  averageScoreDeltaPct: 5,
  teamPlanPct: 57,
  teamPlanDeltaPct: 5,
  tasksToday: 3,
  oneOnOneToday: 1,
}

// ─────────────────────────────────────────────────────────────
// Team tab mocks (KAN-414)
// ─────────────────────────────────────────────────────────────

const OPERATOR_NAMES = [
  'Kateryna Antonova',
  'Oleh Bondar',
  'Marina Shevchenko',
  'Denys Polyakov',
  'Iryna Sokol',
  'Artem Honchar',
  'Oleksandra Bila',
  'Natalia Yefremova',
  'Yurii Kravtsov',
  'Bohdan Melnyk',
  'Sofia Lytvyn',
  'Mykyta Tarasenko',
]

function buildOperator(id: number, team: string, department: string, score: number): MockOperator {
  const name = OPERATOR_NAMES[id % OPERATOR_NAMES.length]
  const parts = name.split(' ')
  const initials = `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return {
    id,
    name,
    initials,
    avatarColor: AVATAR_PALETTE[id % AVATAR_PALETTE.length],
    team,
    department,
    extension: `12${String(id).padStart(2, '0')}`,
    online: id % 3 !== 0,
    score,
    scoreBand: scoreBandFor(score),
    lastActiveLabel: id % 3 === 0 ? '15m ago' : 'Online',
  }
}

export interface MockTeam {
  id: string
  name: string
  managerName: string
  memberCount: number
  averageScore: number
  scoreBand: ScoreBand
  operators: MockOperator[]
}

export interface MockDepartment {
  id: string
  name: string
  managerName: string
  memberCount: number
  averageScore: number
  scoreBand: ScoreBand
  teams: MockTeam[]
}

export const MOCK_DEPARTMENTS: MockDepartment[] = [
  {
    id: 'dept-a',
    name: 'Department A · Hard Collection',
    managerName: 'Volodymyr Senchuk',
    memberCount: 18,
    averageScore: 75,
    scoreBand: 'green',
    teams: [
      {
        id: 'team-alpha',
        name: 'Team "Alpha"',
        managerName: 'Volodymyr Senchuk',
        memberCount: 6,
        averageScore: 76,
        scoreBand: 'green',
        operators: [
          buildOperator(1, 'Team "Alpha"', 'Hard Collection', 82),
          buildOperator(2, 'Team "Alpha"', 'Hard Collection', 78),
          buildOperator(3, 'Team "Alpha"', 'Hard Collection', 71),
        ],
      },
      {
        id: 'team-bravo',
        name: 'Team "Bravo"',
        managerName: 'Olena Lytvynenko',
        memberCount: 6,
        averageScore: 68,
        scoreBand: 'amber',
        operators: [
          buildOperator(4, 'Team "Bravo"', 'Hard Collection', 65),
          buildOperator(5, 'Team "Bravo"', 'Hard Collection', 72),
        ],
      },
      {
        id: 'team-charlie',
        name: 'Team "Charlie"',
        managerName: 'Sergii Kovalenko',
        memberCount: 6,
        averageScore: 77,
        scoreBand: 'green',
        operators: [
          buildOperator(6, 'Team "Charlie"', 'Hard Collection', 80),
          buildOperator(7, 'Team "Charlie"', 'Hard Collection', 74),
        ],
      },
    ],
  },
  {
    id: 'dept-b',
    name: 'Department B · Soft Collection',
    managerName: 'Mariia Petrenko',
    memberCount: 12,
    averageScore: 70,
    scoreBand: 'green',
    teams: [
      {
        id: 'team-delta',
        name: 'Team "Delta"',
        managerName: 'Mariia Petrenko',
        memberCount: 4,
        averageScore: 73,
        scoreBand: 'green',
        operators: [
          buildOperator(8, 'Team "Delta"', 'Soft Collection', 78),
          buildOperator(9, 'Team "Delta"', 'Soft Collection', 67),
        ],
      },
      {
        id: 'team-echo',
        name: 'Team "Echo"',
        managerName: 'Andrii Shevchuk',
        memberCount: 4,
        averageScore: 64,
        scoreBand: 'amber',
        operators: [
          buildOperator(10, 'Team "Echo"', 'Soft Collection', 60),
          buildOperator(11, 'Team "Echo"', 'Soft Collection', 68),
        ],
      },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// Trainings & Sessions — Courses Catalogue (KAN-498)
// ─────────────────────────────────────────────────────────────

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type CourseStatus = 'draft' | 'published' | 'archived'

export interface MockCourse {
  id: number
  title: string
  author: string
  category: string
  level: CourseLevel
  durationMinutes: number
  moduleCount: number
  enrolledCount: number
  avgCompletionPct: number
  status: CourseStatus
  coverGradient: string
}

const COURSE_GRADIENTS = [
  'linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 100%)',
  'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)',
  'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
  'linear-gradient(135deg, #FCE7F3 0%, #FDF2F8 100%)',
  'linear-gradient(135deg, #E0E7FF 0%, #EEF2FF 100%)',
  'linear-gradient(135deg, #FFE4E6 0%, #FFF1F2 100%)',
]

export const MOCK_COURSES: MockCourse[] = [
  {
    id: 1,
    title: 'Working with objections',
    author: 'Anna Kovalenko',
    category: 'Hard Collection',
    level: 'beginner',
    durationMinutes: 250,
    moduleCount: 8,
    enrolledCount: 12,
    avgCompletionPct: 68,
    status: 'published',
    coverGradient: COURSE_GRADIENTS[0],
  },
  {
    id: 2,
    title: 'Empathy and active listening',
    author: 'Sergii Tarasov',
    category: 'Soft Skills',
    level: 'intermediate',
    durationMinutes: 220,
    moduleCount: 6,
    enrolledCount: 18,
    avgCompletionPct: 72,
    status: 'published',
    coverGradient: COURSE_GRADIENTS[1],
  },
  {
    id: 3,
    title: 'Successful dialogue structure',
    author: 'Mariia Petrenko',
    category: 'Hard Collection',
    level: 'advanced',
    durationMinutes: 240,
    moduleCount: 12,
    enrolledCount: 9,
    avgCompletionPct: 54,
    status: 'published',
    coverGradient: COURSE_GRADIENTS[2],
  },
  {
    id: 4,
    title: 'Closing complex agreements',
    author: 'Andrii Shevchuk',
    category: 'Hard Collection',
    level: 'advanced',
    durationMinutes: 180,
    moduleCount: 6,
    enrolledCount: 7,
    avgCompletionPct: 41,
    status: 'draft',
    coverGradient: COURSE_GRADIENTS[3],
  },
  {
    id: 5,
    title: 'Mastering tone of voice',
    author: 'Olena Lytvynenko',
    category: 'Tone',
    level: 'beginner',
    durationMinutes: 150,
    moduleCount: 5,
    enrolledCount: 22,
    avgCompletionPct: 84,
    status: 'published',
    coverGradient: COURSE_GRADIENTS[4],
  },
  {
    id: 6,
    title: 'Analytics of a classic dialogue',
    author: 'Volodymyr Senchuk',
    category: 'Analytics',
    level: 'intermediate',
    durationMinutes: 200,
    moduleCount: 7,
    enrolledCount: 15,
    avgCompletionPct: 61,
    status: 'archived',
    coverGradient: COURSE_GRADIENTS[5],
  },
]

// ─────────────────────────────────────────────────────────────
// Trainings & Sessions — Assignments grid (KAN-498)
// ─────────────────────────────────────────────────────────────

export type AssignmentStatus = 'not_started' | 'in_progress' | 'done' | 'overdue'

export interface MockAssignment {
  id: number
  operator: MockOperator
  courseId: number
  courseTitle: string
  courseCategory: string
  courseDurationMinutes: number
  courseModules: number
  progressPct: number
  deadlineLabel: string
  status: AssignmentStatus
}

export const MOCK_ASSIGNMENTS: MockAssignment[] = [
  {
    id: 1,
    operator: buildOperator(1, 'Team "Alpha"', 'Hard Collection', 82),
    courseId: 1,
    courseTitle: 'Working with objections',
    courseCategory: 'Hard Collection',
    courseDurationMinutes: 250,
    courseModules: 8,
    progressPct: 64,
    deadlineLabel: '15.06.2026',
    status: 'in_progress',
  },
  {
    id: 2,
    operator: buildOperator(4, 'Team "Bravo"', 'Hard Collection', 65),
    courseId: 2,
    courseTitle: 'Empathy and active listening',
    courseCategory: 'Soft Skills',
    courseDurationMinutes: 220,
    courseModules: 6,
    progressPct: 100,
    deadlineLabel: '01.06.2026',
    status: 'done',
  },
  {
    id: 3,
    operator: buildOperator(6, 'Team "Charlie"', 'Hard Collection', 80),
    courseId: 3,
    courseTitle: 'Successful dialogue structure',
    courseCategory: 'Hard Collection',
    courseDurationMinutes: 240,
    courseModules: 12,
    progressPct: 12,
    deadlineLabel: '22.05.2026',
    status: 'overdue',
  },
  {
    id: 4,
    operator: buildOperator(8, 'Team "Delta"', 'Soft Collection', 78),
    courseId: 5,
    courseTitle: 'Mastering tone of voice',
    courseCategory: 'Tone',
    courseDurationMinutes: 150,
    courseModules: 5,
    progressPct: 0,
    deadlineLabel: '20.06.2026',
    status: 'not_started',
  },
  {
    id: 5,
    operator: buildOperator(10, 'Team "Echo"', 'Soft Collection', 60),
    courseId: 1,
    courseTitle: 'Working with objections',
    courseCategory: 'Hard Collection',
    courseDurationMinutes: 250,
    courseModules: 8,
    progressPct: 38,
    deadlineLabel: '30.06.2026',
    status: 'in_progress',
  },
]

export interface MockAssignmentsKpis {
  totalActive: number
  completed: number
  completedOfTotal: number
  overdue: number
}

export const MOCK_ASSIGNMENT_KPIS: MockAssignmentsKpis = {
  totalActive: 24,
  completed: 16,
  completedOfTotal: 24,
  overdue: 3,
}

// ─────────────────────────────────────────────────────────────
// Trainings & Sessions — Materials Library (KAN-499)
// ─────────────────────────────────────────────────────────────

export type MaterialType = 'pdf' | 'docx' | 'video' | 'audio'

export interface MockMaterial {
  id: number
  name: string
  type: MaterialType
  sizeBytes: number
  uploadedBy: string
  updatedLabel: string
}

export const MOCK_MATERIALS: MockMaterial[] = [
  {
    id: 1,
    name: 'Objection handling — script v3',
    type: 'pdf',
    sizeBytes: 2_400_000,
    uploadedBy: 'Mariia Petrenko',
    updatedLabel: '2 days ago',
  },
  {
    id: 2,
    name: 'Successful closure example call',
    type: 'audio',
    sizeBytes: 5_800_000,
    uploadedBy: 'Sergii Tarasov',
    updatedLabel: '1 week ago',
  },
  {
    id: 3,
    name: 'Tone of voice — masterclass',
    type: 'video',
    sizeBytes: 92_000_000,
    uploadedBy: 'Olena Lytvynenko',
    updatedLabel: '3 weeks ago',
  },
  {
    id: 4,
    name: 'New product brief Q2 2026',
    type: 'docx',
    sizeBytes: 540_000,
    uploadedBy: 'Andrii Shevchuk',
    updatedLabel: '1 month ago',
  },
  {
    id: 5,
    name: 'Soft Collection playbook',
    type: 'pdf',
    sizeBytes: 4_100_000,
    uploadedBy: 'Volodymyr Senchuk',
    updatedLabel: '6 weeks ago',
  },
  {
    id: 6,
    name: 'Compliance walkthrough',
    type: 'video',
    sizeBytes: 124_000_000,
    uploadedBy: 'Anna Kovalenko',
    updatedLabel: '2 months ago',
  },
]

// ─────────────────────────────────────────────────────────────
// Dialogue Evaluation (KAN-504)
// ─────────────────────────────────────────────────────────────

export type ScorecardType = 'client' | 'third_party'

export interface MockScorecardRow {
  id: number
  dateLabel: string
  operatorName: string
  operatorInitials: string
  avatarColor: string
  category: 'New' | 'Average' | 'Risk'
  duration: string
  trigger: string
  score: number
  scoreOutOf: number
  scorecardType: ScorecardType
}

export const MOCK_SCORECARD_ROWS: MockScorecardRow[] = Array.from({ length: 12 }, (_, i) => {
  const score = 60 + ((i * 7) % 40)
  const operatorName = OPERATOR_NAMES[i % OPERATOR_NAMES.length]
  const parts = operatorName.split(' ')
  return {
    id: i + 1,
    dateLabel: '15.05',
    operatorName,
    operatorInitials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`,
    avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
    category: i % 4 === 0 ? 'Risk' : i % 3 === 0 ? 'Average' : 'New',
    duration: `${3 + (i % 5)}:${String(10 + i).slice(-2)}`,
    trigger: i % 2 === 0 ? 'Promise' : 'Missed call',
    score,
    scoreOutOf: 100,
    scorecardType: i % 3 === 0 ? 'third_party' : 'client',
  }
})

export interface MockAvgByType {
  client: { avg: number; count: number }
  thirdParty: { avg: number; count: number }
}

export const MOCK_AVG_BY_TYPE: MockAvgByType = {
  client: { avg: 78, count: 134 },
  thirdParty: { avg: 71, count: 42 },
}

// ─────────────────────────────────────────────────────────────
// Tasks tab mocks (KAN-411 revised)
// ─────────────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'
export type TaskStatus = 'open' | 'in_progress' | 'overdue' | 'completed'

export interface MockTaskRow {
  id: number
  dateLabel: string
  title: string
  executor: string
  author: string
  priority: TaskPriority
  status: TaskStatus
}

export const MOCK_TASKS: MockTaskRow[] = [
  {
    id: 1,
    dateLabel: '05/15',
    title: 'Script — closing the deal',
    executor: 'Andrii Pavlenko',
    author: 'Yulia Marchuk',
    priority: 'critical',
    status: 'in_progress',
  },
  {
    id: 2,
    dateLabel: '05/16',
    title: 'Call processing — milestone 1',
    executor: 'Kateryna Antonova',
    author: 'Yulia Marchuk',
    priority: 'critical',
    status: 'open',
  },
  {
    id: 3,
    dateLabel: '05/15',
    title: 'Analysis of result distribution',
    executor: 'Oleh Bondar',
    author: 'Yulia Marchuk',
    priority: 'high',
    status: 'in_progress',
  },
  {
    id: 4,
    dateLabel: '05/13',
    title: 'Soft refusal technique',
    executor: 'Marina Shevchenko',
    author: 'Yulia Marchuk',
    priority: 'medium',
    status: 'completed',
  },
  {
    id: 5,
    dateLabel: '05/12',
    title: 'Course "Effective Calling"',
    executor: 'Oleksandra Bila',
    author: 'Yulia Marchuk',
    priority: 'low',
    status: 'completed',
  },
  {
    id: 6,
    dateLabel: '05/11',
    title: 'Correction of greeting script',
    executor: 'Oksana Tkachenko',
    author: 'Yulia Marchuk',
    priority: 'high',
    status: 'completed',
  },
  {
    id: 7,
    dateLabel: '05/10',
    title: 'Training "Callback on lead"',
    executor: 'Iryna Sokol',
    author: 'Yulia Marchuk',
    priority: 'medium',
    status: 'open',
  },
]

export interface MockTaskKpis {
  total: number
  open: number
  inProgress: number
  overdue: number
  completed: number
}

export const MOCK_TASK_KPIS: MockTaskKpis = {
  total: 11,
  open: 4,
  inProgress: 3,
  overdue: 2,
  completed: 2,
}

// ─────────────────────────────────────────────────────────────
// Action Analysis — Weekly Tasks heatmap (KAN-415)
// ─────────────────────────────────────────────────────────────

export interface MockWeeklyTasksKpis {
  weekTotal: number
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
}

export const MOCK_WEEKLY_TASKS_KPIS: MockWeeklyTasksKpis = {
  weekTotal: 11,
  monday: 1,
  tuesday: 4,
  wednesday: 2,
  thursday: 0,
  friday: 2,
  saturday: 2,
}

// ─────────────────────────────────────────────────────────────
// Action Analysis — Promises and Callbacks (KAN-415)
// ─────────────────────────────────────────────────────────────

export type PromiseStatus = 'pending' | 'paid' | 'overdue' | 'expected'

export interface MockPromiseRow {
  id: number
  dateLabel: string
  operator: string
  client: string
  agreement: string
  amount: number
  paymentDateLabel: string
  status: PromiseStatus
}

export const MOCK_PROMISES_KPIS = {
  total: { amount: 44000, currency: '₴' },
  paid: { amount: 44000, currency: '₴' },
  pending: { count: 18 },
  expected: { amount: 44000, currency: '₴' },
}

export const MOCK_PROMISES: MockPromiseRow[] = Array.from({ length: 10 }, (_, i) => {
  const op = OPERATOR_NAMES[i % OPERATOR_NAMES.length]
  return {
    id: i + 1,
    dateLabel: `12.05 1${i % 10}:30`,
    operator: op,
    client: `Client #${i + 1}`,
    agreement: `AGR-${1000 + i}`,
    amount: 4500 + i * 350,
    paymentDateLabel: '13.05',
    status: i % 4 === 0 ? 'paid' : i % 4 === 1 ? 'pending' : i % 4 === 2 ? 'expected' : 'overdue',
  }
})

// ─────────────────────────────────────────────────────────────
// Successful Closures (KAN-415)
// ─────────────────────────────────────────────────────────────

export interface MockClosureRow {
  id: number
  closureDateLabel: string
  operator: string
  client: string
  agreement: string
  paymentAmount: number
  statusInCrm: string
}

export const MOCK_CLOSURES_KPIS = {
  successfulClosures: 7,
  totalAmount: { amount: 59000, currency: '₴' },
  conversionPromisePaymentPct: 19,
  closureLeader: 'Antonova K.',
}

export const MOCK_CLOSURES_FUNNEL = [
  { label: 'Interactions', actual: 90, expected: 100, pct: 100 },
  { label: 'Promises', actual: 36, expected: 90, pct: 40 },
  { label: 'Payments', actual: 17, expected: 36, pct: 47 },
  { label: 'Closure', actual: 7, expected: 17, pct: 41 },
]

export const MOCK_CLOSURES: MockClosureRow[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  closureDateLabel: '13.05',
  operator: OPERATOR_NAMES[i % OPERATOR_NAMES.length],
  client: `Client #${i + 1}`,
  agreement: `AGR-${2000 + i}`,
  paymentAmount: 5000 + i * 400,
  statusInCrm: 'Paid',
}))

// ─────────────────────────────────────────────────────────────
// Leaks (KAN-415)
// ─────────────────────────────────────────────────────────────

export interface MockLeakRow {
  id: number
  operator: string
  client: string
  agreement: string
  promiseAmount: number
  promiseDateLabel: string
  followedUp: boolean
  callAfterEscalationLabel: string
}

export const MOCK_LEAKS_KPIS = {
  totalEscalations: 6,
  notFollowedUp: 4,
  followedUp: 2,
}

export const MOCK_LEAKS: MockLeakRow[] = Array.from({ length: 7 }, (_, i) => ({
  id: i + 1,
  operator: OPERATOR_NAMES[i % OPERATOR_NAMES.length],
  client: `Client #${i + 11}`,
  agreement: `AGR-${3000 + i}`,
  promiseAmount: 3000 + i * 500,
  promiseDateLabel: '12.05',
  followedUp: i % 3 === 0,
  callAfterEscalationLabel: i % 3 === 0 ? '13.05 14:30' : 'No call',
}))

// ─────────────────────────────────────────────────────────────
// Third Parties (KAN-415)
// ─────────────────────────────────────────────────────────────

export type ThirdPartyResult = 'promise' | 'refusal' | 'will_pass_on' | 'positive'

export interface MockThirdPartyRow {
  id: number
  dateLabel: string
  operator: string
  clientPhone: string
  duration: string
  result: ThirdPartyResult
  returnedToClient: string
}

export const MOCK_THIRD_PARTIES_KPIS = {
  callsToThirdParties: 26,
  passedToClient: 18,
  positiveResult: 5,
}

export const MOCK_THIRD_PARTIES: MockThirdPartyRow[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  dateLabel: `12.05 1${i % 10}:30`,
  operator: OPERATOR_NAMES[i % OPERATOR_NAMES.length],
  clientPhone: `+38097${String(1000000 + i).padStart(7, '0')}`,
  duration: `${1 + (i % 4)}:${String(10 + i).slice(-2)}`,
  result:
    i % 4 === 0 ? 'promise' : i % 4 === 1 ? 'refusal' : i % 4 === 2 ? 'will_pass_on' : 'positive',
  returnedToClient: i % 2 === 0 ? 'Yes' : 'No',
}))

// ─────────────────────────────────────────────────────────────
// Time at Work (KAN-415)
// ─────────────────────────────────────────────────────────────

export interface MockTimeAtWorkRow {
  id: number
  operator: string
  initials: string
  avatarColor: string
  calls: number
  timeToLead: string
  successCredits: number
  fillForms: number
  downtime: string
  afterCall: string
}

export const MOCK_TIME_AT_WORK_KPIS = {
  toLeadAvg: '12s',
  creditsAvg: '45c',
  toFormAvg: '18c',
  downtimeAvg: '28 min',
  afterCallAvg: '22c',
}

export const MOCK_TIME_AT_WORK: MockTimeAtWorkRow[] = Array.from({ length: 10 }, (_, i) => {
  const name = OPERATOR_NAMES[i % OPERATOR_NAMES.length]
  const parts = name.split(' ')
  return {
    id: i + 1,
    operator: name,
    initials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`,
    avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
    calls: 5 + i,
    timeToLead: `${8 + i}s`,
    successCredits: 30 + i * 2,
    fillForms: 12 + i,
    downtime: `${20 + i} min`,
    afterCall: `${15 + i}s`,
  }
})

// ─────────────────────────────────────────────────────────────
// Script Analytics (KAN-503)
// ─────────────────────────────────────────────────────────────

export interface MockScriptAlert {
  id: number
  message: string
  operator: string
  timeLabel: string
  severity: 'info' | 'warn' | 'critical'
}

export const MOCK_SCRIPT_ALERTS: MockScriptAlert[] = [
  {
    id: 1,
    message: 'Series of missed calls',
    operator: 'Artem Honchar',
    timeLabel: 'today, 12:00',
    severity: 'critical',
  },
  {
    id: 2,
    message: 'Quick refusal · 7s',
    operator: 'Denys Polyakov',
    timeLabel: 'today, 11:42',
    severity: 'warn',
  },
  {
    id: 3,
    message: 'No promise after the consent',
    operator: 'Oleh Bondar',
    timeLabel: 'today, 11:20',
    severity: 'info',
  },
  {
    id: 4,
    message: 'Result without script · 1m',
    operator: 'Iryna Sokol',
    timeLabel: 'today, 10:55',
    severity: 'warn',
  },
  {
    id: 5,
    message: 'Promise without credit-card data',
    operator: 'Yurii Kravtsov',
    timeLabel: 'today, 10:30',
    severity: 'info',
  },
  {
    id: 6,
    message: 'Rapid call · 12s',
    operator: 'Marina Shevchenko',
    timeLabel: 'today, 09:48',
    severity: 'critical',
  },
]

export interface MockScriptDistribution {
  id: number
  operator: string
  initials: string
  avatarColor: string
  total: number
  promises: number
  refusals: number
  missedCalls: number
  willPass: number
  flags: number
}

export const MOCK_SCRIPT_DISTRIBUTION: MockScriptDistribution[] = Array.from(
  { length: 5 },
  (_, i) => {
    const name = OPERATOR_NAMES[i % OPERATOR_NAMES.length]
    const parts = name.split(' ')
    return {
      id: i + 1,
      operator: name,
      initials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`,
      avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
      total: 30 + i * 3,
      promises: 8 + i,
      refusals: 5 + i,
      missedCalls: 3 + i,
      willPass: 2 + (i % 3),
      flags: i + 1,
    }
  }
)

// ─────────────────────────────────────────────────────────────
// Action Analysis — Interactions (existing surface, with new visuals)
// ─────────────────────────────────────────────────────────────

export interface MockInteractionRow {
  id: number
  dateLabel: string
  operator: string
  duration: string
  source: 'Promise' | 'Missed call' | 'Refusal' | 'Positive'
  breakInRowLabel: string
  client: string
  deal: string
  amountPromised?: number
}

export const MOCK_INTERACTIONS_KPIS = {
  interactionsTotal: 90,
  promises: 36,
  refusals: 18,
  willPass: 26,
  averageDuration: '15 min',
}

export const MOCK_INTERACTIONS: MockInteractionRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  dateLabel: `May ${10 + (i % 6)} 1${i % 9}:30`,
  operator: OPERATOR_NAMES[i % OPERATOR_NAMES.length],
  duration: `${2 + (i % 5)}:${String(10 + i).slice(-2)}`,
  source:
    i % 4 === 0 ? 'Promise' : i % 4 === 1 ? 'Missed call' : i % 4 === 2 ? 'Refusal' : 'Positive',
  breakInRowLabel: i % 3 === 0 ? '14m' : i % 3 === 1 ? '7m' : '23m',
  client: `Client #${i + 1}`,
  deal: '–',
  amountPromised: i % 4 === 0 ? 2300 + i * 100 : undefined,
}))
