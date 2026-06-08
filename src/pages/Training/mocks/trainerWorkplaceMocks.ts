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

export type OperatorPresenceStatus = 'online' | 'offline' | 'busy' | 'on_call'

/**
 * Figma Team tab — work status pill rendered next to the operator name.
 *   in_norm   → green dot · operator is hitting the plan
 *   behind    → amber dot · operator is lagging the plan
 *   in_queue  → red dot   · operator is queued for a coaching intervention
 */
export type OperatorWorkStatus = 'in_norm' | 'behind' | 'in_queue'

export interface TeamOperatorRow {
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
  /** False when the BE returned a null composite score (no source data).
   *  Views render a `—` ring instead of the `score` value. */
  hasScore?: boolean
  lastActiveLabel: string
  /** Figma Team tab — presence label + dot color */
  presenceStatus?: OperatorPresenceStatus
  /** Daily plan progress 0–100 (operator card bar) */
  dailyPlanPct?: number
  /** Figma Team tab — work status pill (In norm / Behind / In queue) */
  workStatus?: OperatorWorkStatus
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
// Team tab mocks (KAN-414)
// ─────────────────────────────────────────────────────────────

// KAN-414 — the Team tab itself now reads `useTeamRoster` + the real
// `teamRosterAdapter` (see TeamTab.tsx); `MOCK_DEPARTMENTS` is kept
// intact only as a reference fixture, not consumed at runtime. The
// helpers below stay because other Trainer-Workplace surfaces
// (calibration sessions, scorecards, etc.) still reuse them.

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

const PRESENCE_LABEL: Record<OperatorPresenceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Busy',
  on_call: 'On the call',
}

function deriveWorkStatus(score: number, dailyPlanPct: number): OperatorWorkStatus {
  if (score < 60 || dailyPlanPct < 50) return 'in_queue'
  if (score < 75 || dailyPlanPct < 75) return 'behind'
  return 'in_norm'
}

function buildOperator(
  id: number,
  team: string,
  department: string,
  score: number
): TeamOperatorRow {
  const name = OPERATOR_NAMES[id % OPERATOR_NAMES.length]
  const parts = name.split(' ')
  const initials = `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase()
  const presenceStatus: OperatorPresenceStatus =
    id % 4 === 0 ? 'offline' : id % 4 === 1 ? 'on_call' : id % 4 === 2 ? 'busy' : 'online'
  const dailyPlanPct = 40 + ((id * 17) % 55)
  return {
    id,
    name,
    initials,
    avatarColor: '#BBFB5B',
    team,
    department,
    extension: `${2000 + id}`,
    online: presenceStatus !== 'offline',
    score,
    scoreBand: scoreBandFor(score),
    lastActiveLabel: PRESENCE_LABEL[presenceStatus],
    presenceStatus,
    dailyPlanPct,
    workStatus: deriveWorkStatus(score, dailyPlanPct),
  }
}

function teamOp(
  id: number,
  name: string,
  initials: string,
  team: string,
  department: string,
  extension: string,
  score: number,
  presenceStatus: OperatorPresenceStatus,
  dailyPlanPct: number
): TeamOperatorRow {
  return {
    id,
    name,
    initials,
    avatarColor: '#BBFB5B',
    team,
    department,
    extension,
    online: presenceStatus !== 'offline',
    score,
    scoreBand: scoreBandFor(score),
    lastActiveLabel: PRESENCE_LABEL[presenceStatus],
    presenceStatus,
    dailyPlanPct,
    workStatus: deriveWorkStatus(score, dailyPlanPct),
  }
}

export interface TeamGroupRow {
  id: string
  name: string
  teamLeadName: string
  memberCount: number
  averageScore: number
  scoreBand: ScoreBand
  queueCount: number
  operators: TeamOperatorRow[]
}

export interface TeamDepartmentRow {
  id: string
  name: string
  managerName: string
  managerInitials: string
  memberCount: number
  teamCount: number
  averageScore: number
  scoreBand: ScoreBand
  queueCount: number
  teams: TeamGroupRow[]
}

/** Figma `ENG - Training _ Team.svg` roster */
export const MOCK_DEPARTMENTS: TeamDepartmentRow[] = [
  {
    id: 'dept-a',
    name: 'Department A · Hard Collection',
    managerName: 'Volodymyr Korsa',
    managerInitials: 'VK',
    memberCount: 18,
    teamCount: 3,
    averageScore: 73,
    scoreBand: 'amber',
    queueCount: 4,
    teams: [
      {
        id: 'team-alpha',
        name: 'Team "Alpha"',
        teamLeadName: 'Dmytro Shpak',
        memberCount: 3,
        averageScore: 88,
        scoreBand: 'green',
        queueCount: 0,
        operators: [
          teamOp(
            1,
            'Kateryna Antonova',
            'KA',
            'Team "Alpha"',
            'Hard Collection',
            '2097',
            93,
            'on_call',
            93
          ),
          teamOp(
            2,
            'Oleh Bondar',
            'OB',
            'Team "Alpha"',
            'Hard Collection',
            '1004',
            81,
            'online',
            76
          ),
          teamOp(
            3,
            'Marina Shevchenko',
            'MS',
            'Team "Alpha"',
            'Hard Collection',
            '2098',
            67,
            'busy',
            52
          ),
        ],
      },
      {
        id: 'team-bravo',
        name: 'Team "Bravo"',
        teamLeadName: 'Olena Hryshchuk',
        memberCount: 2,
        averageScore: 71,
        scoreBand: 'green',
        queueCount: 2,
        operators: [
          teamOp(
            4,
            'Denys Poltavets',
            'DP',
            'Team "Bravo"',
            'Hard Collection',
            '2052',
            74,
            'online',
            68
          ),
          teamOp(
            5,
            'Iryna Sokol',
            'IS',
            'Team "Bravo"',
            'Hard Collection',
            '2055',
            68,
            'online',
            61
          ),
        ],
      },
      {
        id: 'team-charlie',
        name: 'Team "Charlie"',
        teamLeadName: 'Ivan Petrenko',
        memberCount: 2,
        averageScore: 65,
        scoreBand: 'amber',
        queueCount: 1,
        operators: [
          teamOp(
            6,
            'Artem Honchar',
            'AH',
            'Team "Charlie"',
            'Hard Collection',
            '5022',
            58,
            'offline',
            38
          ),
          teamOp(
            7,
            'Oleksandra Bila',
            'OB',
            'Team "Charlie"',
            'Hard Collection',
            '5023',
            72,
            'online',
            84
          ),
        ],
      },
    ],
  },
  {
    id: 'dept-b',
    name: 'Department B · Soft Collection',
    managerName: 'Natalia Pokrova',
    managerInitials: 'NP',
    memberCount: 14,
    teamCount: 2,
    averageScore: 70,
    scoreBand: 'green',
    queueCount: 2,
    teams: [
      {
        id: 'team-delta',
        name: 'Team "Delta"',
        teamLeadName: 'Anna Sydorenko',
        memberCount: 2,
        averageScore: 73,
        scoreBand: 'green',
        queueCount: 0,
        operators: [
          teamOp(
            8,
            'Natalia Yefremova',
            'NY',
            'Team "Delta"',
            'Soft Collection',
            '3041',
            78,
            'online',
            71
          ),
          teamOp(
            9,
            'Serhiy Lytvyn',
            'SL',
            'Team "Delta"',
            'Soft Collection',
            '3042',
            69,
            'busy',
            55
          ),
        ],
      },
      {
        id: 'team-echo',
        name: 'Team "Echo"',
        teamLeadName: 'Mykhailo Yakobchuk',
        memberCount: 1,
        averageScore: 64,
        scoreBand: 'amber',
        queueCount: 0,
        operators: [
          teamOp(
            10,
            'Yuriy Kravtsov',
            'YK',
            'Team "Echo"',
            'Soft Collection',
            '3051',
            64,
            'on_call',
            47
          ),
        ],
      },
    ],
  },
  {
    id: 'dept-c',
    name: 'Department C · Restructuring',
    managerName: 'Ihor Hnatiuk',
    managerInitials: 'IH',
    memberCount: 12,
    teamCount: 2,
    averageScore: 68,
    scoreBand: 'amber',
    queueCount: 3,
    teams: [
      {
        id: 'team-foxtrot',
        name: 'Team "Foxtrot"',
        teamLeadName: 'Taras Kushnir',
        memberCount: 1,
        averageScore: 71,
        scoreBand: 'green',
        queueCount: 1,
        operators: [
          teamOp(
            11,
            'Bohdan Melnyk',
            'BM',
            'Team "Foxtrot"',
            'Restructuring',
            '4015',
            71,
            'online',
            62
          ),
        ],
      },
      {
        id: 'team-golf',
        name: 'Team "Golf"',
        teamLeadName: 'Yuriy Romanov',
        memberCount: 1,
        averageScore: 62,
        scoreBand: 'amber',
        queueCount: 2,
        operators: [
          teamOp(
            12,
            'Svitlana Hordiienko',
            'SH',
            'Team "Golf"',
            'Restructuring',
            '4020',
            62,
            'offline',
            41
          ),
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
// Trainings & Sessions — Group Trainings (Figma step 2)
// ─────────────────────────────────────────────────────────────

export type GroupTrainingType = 'webinar' | 'workshop' | 'masterclass'

export interface MockGroupTraining {
  id: number
  title: string
  type: GroupTrainingType
  trainer: string
  dateLabel: string
  timeLabel: string
  participantsRegistered: number
  participantsCapacity: number
  category: string
  isRegistered: boolean
  status: 'upcoming' | 'recording_available' | 'cancelled'
  coverGradient: string
}

export const MOCK_GROUP_TRAININGS: MockGroupTraining[] = [
  {
    id: 1,
    title: 'Hard Collection — call escalations',
    type: 'workshop',
    trainer: 'Sergii Tarasov',
    dateLabel: '14.06',
    timeLabel: '10:00-12:00',
    participantsRegistered: 12,
    participantsCapacity: 18,
    category: 'Hard Collection',
    isRegistered: true,
    status: 'upcoming',
    coverGradient: 'linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 100%)',
  },
  {
    id: 2,
    title: 'Tone of voice — practical drill',
    type: 'masterclass',
    trainer: 'Olena Lytvynenko',
    dateLabel: '15.06',
    timeLabel: '15:00-16:30',
    participantsRegistered: 8,
    participantsCapacity: 12,
    category: 'Soft Skills',
    isRegistered: false,
    status: 'upcoming',
    coverGradient: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)',
  },
  {
    id: 3,
    title: 'Restructuring agreements analysis',
    type: 'webinar',
    trainer: 'Volodymyr Senchuk',
    dateLabel: '16.06',
    timeLabel: '11:00-12:30',
    participantsRegistered: 22,
    participantsCapacity: 30,
    category: 'Analytics',
    isRegistered: true,
    status: 'upcoming',
    coverGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
  },
  {
    id: 4,
    title: 'How to win back your voice',
    type: 'workshop',
    trainer: 'Mariia Petrenko',
    dateLabel: '18.06',
    timeLabel: '14:00-15:30',
    participantsRegistered: 5,
    participantsCapacity: 15,
    category: 'Soft Skills',
    isRegistered: false,
    status: 'upcoming',
    coverGradient: 'linear-gradient(135deg, #FCE7F3 0%, #FDF2F8 100%)',
  },
  {
    id: 5,
    title: 'Overview of the new product',
    type: 'webinar',
    trainer: 'Anna Kovalenko',
    dateLabel: '20.06',
    timeLabel: '10:00-11:00',
    participantsRegistered: 30,
    participantsCapacity: 50,
    category: 'Product',
    isRegistered: false,
    status: 'upcoming',
    coverGradient: 'linear-gradient(135deg, #E0E7FF 0%, #EEF2FF 100%)',
  },
  {
    id: 6,
    title: 'Technical seminar — CRM tips',
    type: 'masterclass',
    trainer: 'Andrii Shevchuk',
    dateLabel: '22.06',
    timeLabel: '13:00-14:30',
    participantsRegistered: 10,
    participantsCapacity: 20,
    category: 'Tools',
    isRegistered: false,
    status: 'upcoming',
    coverGradient: 'linear-gradient(135deg, #FFE4E6 0%, #FFF1F2 100%)',
  },
]

// ─────────────────────────────────────────────────────────────
// Trainings & Sessions — Short Drills (Figma step 3)
// ─────────────────────────────────────────────────────────────

export interface MockDrill {
  id: number
  title: string
  durationMinutes: number
  attempts: number
  topic: string
  coverGradient: string
}

export const MOCK_DRILLS: MockDrill[] = [
  {
    id: 1,
    title: '5 objections in 5 minutes',
    durationMinutes: 5,
    attempts: 145,
    topic: 'Objections',
    coverGradient: 'linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 100%)',
  },
  {
    id: 2,
    title: 'Topic talk — fast pitch',
    durationMinutes: 10,
    attempts: 117,
    topic: 'Pitch',
    coverGradient: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)',
  },
  {
    id: 3,
    title: 'Active listening practice',
    durationMinutes: 4,
    attempts: 41,
    topic: 'Listening',
    coverGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
  },
  {
    id: 4,
    title: 'Close in 30 seconds',
    durationMinutes: 1,
    attempts: 78,
    topic: 'Closing',
    coverGradient: 'linear-gradient(135deg, #FCE7F3 0%, #FDF2F8 100%)',
  },
  {
    id: 5,
    title: 'Topic talk — quick win',
    durationMinutes: 2,
    attempts: 20,
    topic: 'Pitch',
    coverGradient: 'linear-gradient(135deg, #E0E7FF 0%, #EEF2FF 100%)',
  },
]

// ─────────────────────────────────────────────────────────────
// Trainings & Sessions — 1-on-1 Calendar (Figma step 4)
// ─────────────────────────────────────────────────────────────

export type SessionFormat = 'in_person' | 'zoom' | 'phone'

export interface MockOneOnOneSession {
  id: number
  timeLabel: string
  dateLabel: string
  title: string
  topic: string
  trainerName: string
  trainerInitials: string
  trainerAvatar: string
  operatorName: string
  operatorInitials: string
  operatorAvatar: string
  durationLabel: string
  format: SessionFormat
  isPlanned: boolean
}

export const MOCK_ONE_ON_ONES_PLANNED: MockOneOnOneSession[] = [
  {
    id: 1,
    timeLabel: '14:00',
    dateLabel: '15.06',
    title: 'Simple time management',
    topic: 'Time management',
    trainerName: 'Yulia Marchuk',
    trainerInitials: 'YM',
    trainerAvatar: AVATAR_PALETTE[0],
    operatorName: 'Kateryna Antonova',
    operatorInitials: 'KA',
    operatorAvatar: AVATAR_PALETTE[1],
    durationLabel: '30 min',
    format: 'in_person',
    isPlanned: true,
  },
  {
    id: 2,
    timeLabel: '15:00',
    dateLabel: '15.06',
    title: 'Dialogue analysis #1012',
    topic: 'Dialogue feedback',
    trainerName: 'Anna Kovalenko',
    trainerInitials: 'AK',
    trainerAvatar: AVATAR_PALETTE[2],
    operatorName: 'Iryna Sokol',
    operatorInitials: 'IS',
    operatorAvatar: AVATAR_PALETTE[3],
    durationLabel: '45 min',
    format: 'zoom',
    isPlanned: true,
  },
  {
    id: 3,
    timeLabel: '15:00',
    dateLabel: '15.06',
    title: 'Dialogue analysis #101000',
    topic: 'Restructuring',
    trainerName: 'Sergii Tarasov',
    trainerInitials: 'ST',
    trainerAvatar: AVATAR_PALETTE[4],
    operatorName: 'Svetlana Hordienko',
    operatorInitials: 'SH',
    operatorAvatar: AVATAR_PALETTE[5],
    durationLabel: '30 min',
    format: 'zoom',
    isPlanned: true,
  },
]

export const MOCK_ONE_ON_ONES_PAST: MockOneOnOneSession[] = [
  {
    id: 4,
    timeLabel: '14:00',
    dateLabel: '12.06',
    title: 'Working with objections',
    topic: 'Objections',
    trainerName: 'Yulia Marchuk',
    trainerInitials: 'YM',
    trainerAvatar: AVATAR_PALETTE[0],
    operatorName: 'Artem Honchar',
    operatorInitials: 'AH',
    operatorAvatar: AVATAR_PALETTE[6],
    durationLabel: '30 min',
    format: 'in_person',
    isPlanned: false,
  },
  {
    id: 5,
    timeLabel: '11:00',
    dateLabel: '11.06',
    title: 'Tone of voice review',
    topic: 'Tone',
    trainerName: 'Olena Lytvynenko',
    trainerInitials: 'OL',
    trainerAvatar: AVATAR_PALETTE[7],
    operatorName: 'Bohdan Melnyk',
    operatorInitials: 'BM',
    operatorAvatar: AVATAR_PALETTE[0],
    durationLabel: '45 min',
    format: 'phone',
    isPlanned: false,
  },
  {
    id: 6,
    timeLabel: '16:30',
    dateLabel: '10.06',
    title: 'Restructuring agreements',
    topic: 'Restructuring',
    trainerName: 'Volodymyr Senchuk',
    trainerInitials: 'VS',
    trainerAvatar: AVATAR_PALETTE[1],
    operatorName: 'Marina Shevchenko',
    operatorInitials: 'MS',
    operatorAvatar: AVATAR_PALETTE[2],
    durationLabel: '60 min',
    format: 'zoom',
    isPlanned: false,
  },
]

// ─────────────────────────────────────────────────────────────
// Trainings & Sessions — Tests (Figma step 5)
// ─────────────────────────────────────────────────────────────

export type TestStatus = 'passed' | 'failed' | 'in_progress' | 'not_started'

export interface MockTest {
  id: number
  title: string
  course: string
  category: string
  authorName: string
  authorInitials: string
  authorAvatar: string
  deadlineLabel: string
  scoreLabel: string
  status: TestStatus
  coverGradient: string
}

export const MOCK_TESTS: MockTest[] = [
  {
    id: 1,
    title: 'Test "Objections"',
    course: 'Working with objections',
    category: 'Hard Collection',
    authorName: 'Denys Poltavets',
    authorInitials: 'DP',
    authorAvatar: AVATAR_PALETTE[0],
    deadlineLabel: '15.05',
    scoreLabel: '96 / 100',
    status: 'passed',
    coverGradient: 'linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 100%)',
  },
  {
    id: 2,
    title: 'Test "Structure"',
    course: 'Successful dialogue structure',
    category: 'Hard Collection',
    authorName: 'Iryna Smol',
    authorInitials: 'IS',
    authorAvatar: AVATAR_PALETTE[1],
    deadlineLabel: '15.05',
    scoreLabel: '78 / 100',
    status: 'passed',
    coverGradient: 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)',
  },
  {
    id: 3,
    title: 'Test "Closure"',
    course: 'Closing complex agreements',
    category: 'Hard Collection',
    authorName: 'Denys Poltavets',
    authorInitials: 'DP',
    authorAvatar: AVATAR_PALETTE[2],
    deadlineLabel: '15.05',
    scoreLabel: '96 / 100',
    status: 'passed',
    coverGradient: 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)',
  },
  {
    id: 4,
    title: 'Test "Empathy"',
    course: 'Empathy and active listening',
    category: 'Soft Skills',
    authorName: 'Kateryna Antonova',
    authorInitials: 'KA',
    authorAvatar: AVATAR_PALETTE[3],
    deadlineLabel: '15.05',
    scoreLabel: '54 / 100',
    status: 'failed',
    coverGradient: 'linear-gradient(135deg, #FCE7F3 0%, #FDF2F8 100%)',
  },
  {
    id: 5,
    title: 'Test "Objections"',
    course: 'Working with objections',
    category: 'Hard Collection',
    authorName: 'Artem Honchar',
    authorInitials: 'AH',
    authorAvatar: AVATAR_PALETTE[4],
    deadlineLabel: '15.05',
    scoreLabel: '41 / 100',
    status: 'failed',
    coverGradient: 'linear-gradient(135deg, #E0E7FF 0%, #EEF2FF 100%)',
  },
  {
    id: 6,
    title: 'Test "Closure"',
    course: 'Closing complex agreements',
    category: 'Hard Collection',
    authorName: 'Denys Poltavets',
    authorInitials: 'DP',
    authorAvatar: AVATAR_PALETTE[5],
    deadlineLabel: '15.05',
    scoreLabel: '96 / 100',
    status: 'passed',
    coverGradient: 'linear-gradient(135deg, #FFE4E6 0%, #FFF1F2 100%)',
  },
]

// ─────────────────────────────────────────────────────────────
// Trainings & Sessions — Assignments grid (KAN-498)
// ─────────────────────────────────────────────────────────────

export type AssignmentStatus = 'not_started' | 'in_progress' | 'done' | 'overdue'

export interface MockAssignment {
  id: number
  operator: TeamOperatorRow
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
  scoreDelta?: number
  exampleLabel?: string
  audioDuration?: string
  /** Figma dialogue-evaluation row — small icons under the trigger column. */
  triggerFlags?: {
    promise?: boolean
    refusal?: boolean
    missedCall?: boolean
    willPass?: boolean
    flagged?: boolean
  }
}

export type CriterionRating = 'not_done' | 'weak' | 'normal' | 'excellent'

export interface MockScorecardCriterion {
  id: string
  label: string
  weight: number
  score: number
  maxScore: number
  rating: CriterionRating
}

export const DEFAULT_SCORECARD_CRITERIA: MockScorecardCriterion[] = [
  {
    id: 'greeting',
    label: 'Greeting per script',
    weight: 10,
    score: 10,
    maxScore: 10,
    rating: 'excellent',
  },
  {
    id: 'reason',
    label: 'Reason for the call',
    weight: 10,
    score: 10,
    maxScore: 10,
    rating: 'excellent',
  },
  {
    id: 'info',
    label: 'Information gathering',
    weight: 10,
    score: 8,
    maxScore: 10,
    rating: 'normal',
  },
  {
    id: 'tone',
    label: 'Tone & orientation',
    weight: 10,
    score: 9,
    maxScore: 10,
    rating: 'excellent',
  },
  {
    id: 'objections',
    label: 'Objection handling',
    weight: 20,
    score: 18,
    maxScore: 20,
    rating: 'excellent',
  },
  {
    id: 'motivation',
    label: 'Motivation & visualisation',
    weight: 20,
    score: 16,
    maxScore: 20,
    rating: 'normal',
  },
  { id: 'negotiation', label: 'Negotiation', weight: 15, score: 11, maxScore: 15, rating: 'weak' },
  { id: 'summary', label: 'Summary', weight: 10, score: 8, maxScore: 10, rating: 'normal' },
  { id: 'crm', label: 'CRM entry', weight: 5, score: 4, maxScore: 5, rating: 'excellent' },
]

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
    scoreDelta: i % 3 === 0 ? 3 : i % 5 === 0 ? -2 : undefined,
    exampleLabel: i % 2 === 0 ? 'Sample example' : undefined,
    audioDuration: `${3 + (i % 5)}:${String(10 + i).slice(-2)}`,
    triggerFlags: {
      promise: i % 2 === 0,
      refusal: i % 5 === 0,
      missedCall: i % 3 === 0,
      willPass: i % 4 === 0,
      flagged: i % 4 === 0,
    },
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

/** Figma Tasks Kanban column (Ukrainian source: "ДО РОБОТИ / У РОБОТІ /
 *  ЗАПЛАНОВАНО / ГОТОВО"). */
export type TaskKanbanColumn = 'to_do' | 'in_progress' | 'planned' | 'done'

/** Figma Tasks filter chip — All / Today / Tomorrow / Week. */
export type TaskTimeBucket = 'today' | 'tomorrow' | 'this_week'

/** Per-card category — drives the small icon on the top-left of the card. */
export type TaskCategory =
  | 'listen'
  | 'assign_drill'
  | 'check_test'
  | 'checklist'
  | 'prepare'
  | 'session'

export interface MockTaskRow {
  id: number
  dateLabel: string
  title: string
  executor: string
  author: string
  priority: TaskPriority
  status: TaskStatus
  /** Mock scope for Tasks sub-tab filtering. */
  assignmentScope: 'by_me' | 'to_scope'
  deadlineLabel?: string
  /** Figma Tasks Kanban column placement. */
  kanbanColumn?: TaskKanbanColumn
  /** Figma Tasks card subtitle (action verb, e.g. "Listen + rate"). */
  subtitle?: string
  /** Figma Tasks card category icon. */
  category?: TaskCategory
  /** Figma Tasks card timestamp ("today 16:00", "tomorrow 11:00", "17.05"). */
  cardTimestamp?: string
  /** Figma Weekly Tasks table — clock time shown beneath the date (e.g. "14:00"). */
  timeLabel?: string
  /** Figma Tasks operator initials + colored avatar. */
  operatorInitials?: string
  operatorAvatarColor?: string
  /** Figma Tasks filter-chip bucket. */
  timeBucket?: TaskTimeBucket
}

export const MOCK_TASKS: MockTaskRow[] = [
  // Column 1 — ДО РОБОТИ (To do) · 5 cards
  {
    id: 1,
    dateLabel: '05/16',
    title: 'Listen and rate 3 calls',
    subtitle: 'Listen + rate',
    category: 'listen',
    executor: 'Artem Honchar',
    operatorInitials: 'AH',
    operatorAvatarColor: '#FEE4E2',
    author: 'Yulia Marchuk',
    priority: 'high',
    status: 'open',
    assignmentScope: 'by_me',
    kanbanColumn: 'to_do',
    cardTimestamp: 'today 16:00',
    timeLabel: '16:00',
    timeBucket: 'today',
    deadlineLabel: 'today 16:00',
  },
  {
    id: 2,
    dateLabel: '05/16',
    title: 'Assign drill "Objections"',
    subtitle: 'Assign training',
    category: 'assign_drill',
    executor: 'Denys Poltavets',
    operatorInitials: 'DP',
    operatorAvatarColor: '#FEF3C7',
    author: 'Yulia Marchuk',
    priority: 'medium',
    status: 'open',
    assignmentScope: 'by_me',
    kanbanColumn: 'to_do',
    cardTimestamp: 'today',
    timeLabel: '09:00',
    timeBucket: 'today',
    deadlineLabel: 'today',
  },
  {
    id: 3,
    dateLabel: '05/15',
    title: 'Check test after course "Closing"',
    subtitle: 'Check test',
    category: 'check_test',
    executor: 'Bohdan Melnyk',
    operatorInitials: 'BM',
    operatorAvatarColor: '#DBEAFE',
    author: 'Yulia Marchuk',
    priority: 'low',
    status: 'open',
    assignmentScope: 'by_me',
    kanbanColumn: 'to_do',
    cardTimestamp: '15.05',
    timeLabel: '11:30',
    timeBucket: 'this_week',
    deadlineLabel: '15.05',
  },
  {
    id: 4,
    dateLabel: '05/17',
    title: 'Weekly checklist: 3 courses + test',
    subtitle: 'Checklist for N days',
    category: 'checklist',
    executor: 'Artem Honchar',
    operatorInitials: 'AH',
    operatorAvatarColor: '#FEE4E2',
    author: 'Yulia Marchuk',
    priority: 'high',
    status: 'open',
    assignmentScope: 'by_me',
    kanbanColumn: 'to_do',
    cardTimestamp: '17.05',
    timeLabel: '15:00',
    timeBucket: 'this_week',
    deadlineLabel: '17.05',
  },
  {
    id: 5,
    dateLabel: '05/14',
    title: 'Listen to 5 random calls',
    subtitle: 'Listen + rate',
    category: 'listen',
    executor: 'Oleh Bondar',
    operatorInitials: 'OB',
    operatorAvatarColor: '#E0E7FF',
    author: 'Yulia Marchuk',
    priority: 'low',
    status: 'open',
    assignmentScope: 'by_me',
    kanbanColumn: 'to_do',
    cardTimestamp: '14.05',
    timeLabel: '13:00',
    timeBucket: 'this_week',
    deadlineLabel: '14.05',
  },

  // Column 2 — У РОБОТІ (In progress) · 1 card
  {
    id: 6,
    dateLabel: '05/16',
    title: 'Prepare materials for 1-on-1',
    subtitle: '1-on-1 session',
    category: 'prepare',
    executor: 'Svitlana Hordiienko',
    operatorInitials: 'SH',
    operatorAvatarColor: '#FCE7F3',
    author: 'Yulia Marchuk',
    priority: 'high',
    status: 'in_progress',
    assignmentScope: 'by_me',
    kanbanColumn: 'in_progress',
    cardTimestamp: 'today 14:00',
    timeLabel: '14:00',
    timeBucket: 'today',
    deadlineLabel: 'today 14:00',
  },

  // Column 3 — ЗАПЛАНОВАНО (Planned) · 1 card
  {
    id: 7,
    dateLabel: '05/17',
    title: '1-on-1 session',
    subtitle: '1-on-1 session',
    category: 'session',
    executor: 'Iryna Sokol',
    operatorInitials: 'IS',
    operatorAvatarColor: '#D1FAE5',
    author: 'Yulia Marchuk',
    priority: 'medium',
    status: 'open',
    assignmentScope: 'by_me',
    kanbanColumn: 'planned',
    cardTimestamp: 'tomorrow 11:00',
    timeLabel: '11:00',
    timeBucket: 'tomorrow',
    deadlineLabel: 'tomorrow 11:00',
  },

  // Column 4 — ГОТОВО (Done) · 0 cards in the demo
]

export interface MockTaskKpis {
  total: number
  open: number
  inProgress: number
  overdue: number
  completed: number
}

export const MOCK_TASK_KPIS: MockTaskKpis = {
  total: MOCK_TASKS.length,
  open: MOCK_TASKS.filter((t) => t.status === 'open').length,
  inProgress: MOCK_TASKS.filter((t) => t.status === 'in_progress').length,
  overdue: MOCK_TASKS.filter((t) => t.status === 'overdue').length,
  completed: MOCK_TASKS.filter((t) => t.status === 'completed').length,
}

// ─────────────────────────────────────────────────────────────
// Action Analysis — Weekly Tasks heatmap (KAN-415)
// ─────────────────────────────────────────────────────────────

/**
 * Per-day status for the Figma Weekly-Tasks KPI strip indicator bar.
 *   overdue — red bar (at least one task on this day is overdue)
 *   healthy — green bar (all tasks for this day are on-track or done)
 *   none    — gray bar / no bar (zero tasks)
 */
export type WeeklyDayStatus = 'overdue' | 'healthy' | 'none'

export interface MockWeeklyDay {
  /** Short abbreviation (e.g. "Mon"). Used as a fallback. */
  label: string
  /** Full day name shown in the tile body (e.g. "Monday"). */
  fullLabel: string
  /** Calendar date label shown above the day name (e.g. "05/13"). */
  dateLabel: string
  /** Marks the tile as "today" — adds the "today" sub-label in the Figma. */
  isToday: boolean
  count: number
  status: WeeklyDayStatus
}

export interface MockWeeklyTasksKpis {
  weekTotal: number
  days: MockWeeklyDay[]
}

export const MOCK_WEEKLY_TASKS_KPIS: MockWeeklyTasksKpis = {
  weekTotal: 11,
  days: [
    {
      label: 'Mon',
      fullLabel: 'Monday',
      dateLabel: '05/13',
      isToday: true,
      count: 2,
      status: 'overdue',
    },
    {
      label: 'Tue',
      fullLabel: 'Tuesday',
      dateLabel: '05/14',
      isToday: false,
      count: 3,
      status: 'overdue',
    },
    {
      label: 'Wed',
      fullLabel: 'Wednesday',
      dateLabel: '05/15',
      isToday: false,
      count: 4,
      status: 'overdue',
    },
    {
      label: 'Thu',
      fullLabel: 'Thursday',
      dateLabel: '05/16',
      isToday: false,
      count: 2,
      status: 'overdue',
    },
    {
      label: 'Fri',
      fullLabel: 'Friday',
      dateLabel: '05/17',
      isToday: false,
      count: 9,
      status: 'overdue',
    },
    {
      label: 'Sat',
      fullLabel: 'Saturday',
      dateLabel: '05/18',
      isToday: false,
      count: 0,
      status: 'none',
    },
  ],
}

// ─────────────────────────────────────────────────────────────
// Action Analysis — Promises and Callbacks (KAN-415)
// ─────────────────────────────────────────────────────────────

export type PromiseStatus = 'pending' | 'paid' | 'overdue' | 'expected'

/** Promise-row priority — drives the right-side chip filter (All / Critical / Average / Low). */
export type PromisePriority = 'critical' | 'average' | 'low'

export interface MockPromiseRow {
  id: number
  dateLabel: string
  operator: string
  operatorInitials?: string
  operatorAvatarColor?: string
  client: string
  agreement: string
  amount: number
  paymentDateLabel: string
  status: PromiseStatus
  priority: PromisePriority
}

export const MOCK_PROMISES_KPIS = {
  total: { amount: 44000, currency: '₴' },
  paid: { amount: 44000, currency: '₴' },
  overdue: { count: 18 },
  pending: { count: 44000 },
}

const PROMISE_ROWS: Omit<MockPromiseRow, 'id' | 'operatorInitials' | 'operatorAvatarColor'>[] = [
  {
    dateLabel: '05/13 09:14',
    operator: 'Kateryna Antonova',
    client: '#230114',
    agreement: 'D-7012',
    amount: 4500,
    paymentDateLabel: '05/15',
    status: 'expected',
    priority: 'average',
  },
  {
    dateLabel: '05/13 10:31',
    operator: 'Oleh Bondar',
    client: '#231088',
    agreement: 'D-7044',
    amount: 2200,
    paymentDateLabel: '05/16',
    status: 'expected',
    priority: 'low',
  },
  {
    dateLabel: '05/12 14:22',
    operator: 'Kateryna Antonova',
    client: '#232001',
    agreement: 'D-7102',
    amount: 7800,
    paymentDateLabel: '05/13',
    status: 'overdue',
    priority: 'critical',
  },
  {
    dateLabel: '05/13 11:05',
    operator: 'Marina Shevchenko',
    client: '#233500',
    agreement: 'D-7215',
    amount: 1500,
    paymentDateLabel: '05/14',
    status: 'expected',
    priority: 'average',
  },
  {
    dateLabel: '05/12 16:40',
    operator: 'Natalia Yefremova',
    client: '#234010',
    agreement: 'D-7318',
    amount: 9200,
    paymentDateLabel: '05/14',
    status: 'expected',
    priority: 'critical',
  },
  {
    dateLabel: '05/11 15:10',
    operator: 'Sofia Lytvyn',
    client: '#235100',
    agreement: 'D-7421',
    amount: 3300,
    paymentDateLabel: '05/13',
    status: 'paid',
    priority: 'low',
  },
  {
    dateLabel: '05/13 08:55',
    operator: 'Denys Polyakov',
    client: '#236200',
    agreement: 'D-7519',
    amount: 5000,
    paymentDateLabel: '05/20',
    status: 'expected',
    priority: 'average',
  },
  {
    dateLabel: '05/10 13:44',
    operator: 'Iryna Sokol',
    client: '#237300',
    agreement: 'D-7621',
    amount: 1800,
    paymentDateLabel: '05/13',
    status: 'overdue',
    priority: 'critical',
  },
]

export const MOCK_PROMISES: MockPromiseRow[] = PROMISE_ROWS.map((row, i) => {
  const parts = row.operator.split(' ')
  return {
    id: i + 1,
    ...row,
    operatorInitials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase(),
    operatorAvatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
  }
})

// ─────────────────────────────────────────────────────────────
// Successful Closures (KAN-415)
// ─────────────────────────────────────────────────────────────

export interface MockClosureRow {
  id: number
  closureDateLabel: string
  operator: string
  operatorInitials?: string
  operatorAvatarColor?: string
  client: string
  deal: string
  paymentAmount: number
  statusInCrm: string
}

export const MOCK_CLOSURES_KPIS = {
  successfulClosures: 7,
  totalAmount: { amount: 59000, currency: '₴' },
  conversionPromisePaymentPct: 19,
  closureLeader: 'Antonova K.',
  closureLeaderSubValue: '3 closures',
}

export const MOCK_CLOSURES_FUNNEL = [
  { label: 'Interactions', actual: 90, expected: 100, pct: 100 },
  { label: 'Promises', actual: 36, expected: 90, pct: 40 },
  { label: 'Closure', actual: 7, expected: 36, pct: 10 },
]

const CLOSURE_ROWS: Omit<MockClosureRow, 'id' | 'operatorInitials' | 'operatorAvatarColor'>[] = [
  {
    closureDateLabel: '13.05 10:22',
    operator: 'Kateryna Antonova',
    client: '#230014',
    deal: 'D-6811',
    paymentAmount: 12000,
    statusInCrm: 'Paid',
  },
  {
    closureDateLabel: '13.05 11:15',
    operator: 'Sofia Lytvyn',
    client: '#231500',
    deal: 'D-6944',
    paymentAmount: 8500,
    statusInCrm: 'Paid',
  },
  {
    closureDateLabel: '12.05 16:48',
    operator: 'Natalia Yefremova',
    client: '#232800',
    deal: 'D-7001',
    paymentAmount: 5200,
    statusInCrm: 'Paid',
  },
  {
    closureDateLabel: '12.05 14:30',
    operator: 'Oleh Bondar',
    client: '#233100',
    deal: 'D-7055',
    paymentAmount: 3800,
    statusInCrm: 'Paid',
  },
  {
    closureDateLabel: '11.05 15:10',
    operator: 'Oleksandra Bila',
    client: '#234400',
    deal: 'D-7122',
    paymentAmount: 15000,
    statusInCrm: 'Paid',
  },
  {
    closureDateLabel: '11.05 12:05',
    operator: 'Yurii Kravtsov',
    client: '#235600',
    deal: 'D-7200',
    paymentAmount: 9700,
    statusInCrm: 'Paid',
  },
  {
    closureDateLabel: '10.05 17:42',
    operator: 'Bohdan Melnyk',
    client: '#236700',
    deal: 'D-7288',
    paymentAmount: 4900,
    statusInCrm: 'Paid',
  },
]

export const MOCK_CLOSURES: MockClosureRow[] = CLOSURE_ROWS.map((row, i) => {
  const parts = row.operator.split(' ')
  return {
    id: i + 1,
    ...row,
    operatorInitials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase(),
    operatorAvatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
  }
})

// ─────────────────────────────────────────────────────────────
// Leaks (KAN-415)
// ─────────────────────────────────────────────────────────────

export interface MockLeakRow {
  id: number
  operator: string
  operatorInitials?: string
  operatorAvatarColor?: string
  /** Presence dot rendered over the avatar (online/busy/offline). */
  operatorPresence?: 'online' | 'busy' | 'offline'
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

/** Per-operator presence dot shown on the avatar in the Leaks table. */
export type LeakOperatorPresence = 'online' | 'busy' | 'offline'

const LEAK_ROWS: Omit<
  MockLeakRow,
  'id' | 'operatorInitials' | 'operatorAvatarColor' | 'operatorPresence'
>[] = [
  {
    operator: 'Denys Polyakov',
    client: '#236200',
    agreement: 'D-7519',
    promiseAmount: 5000,
    promiseDateLabel: '13.05',
    followedUp: false,
    callAfterEscalationLabel: 'No call',
  },
  {
    operator: 'Iryna Sokol',
    client: '#237300',
    agreement: 'D-7621',
    promiseAmount: 1800,
    promiseDateLabel: '10.05',
    followedUp: false,
    callAfterEscalationLabel: 'No call',
  },
  {
    operator: 'Artem Honchar',
    client: '#239800',
    agreement: 'D-7890',
    promiseAmount: 3200,
    promiseDateLabel: '13.05',
    followedUp: true,
    callAfterEscalationLabel: '13.05 12:10',
  },
  {
    operator: 'Bohdan Melnyk',
    client: '#241000',
    agreement: 'D-7942',
    promiseAmount: 7500,
    promiseDateLabel: '12.05',
    followedUp: false,
    callAfterEscalationLabel: 'No call',
  },
  {
    operator: 'Sofia Lytvyn',
    client: '#242100',
    agreement: 'D-8001',
    promiseAmount: 2100,
    promiseDateLabel: '13.05',
    followedUp: true,
    callAfterEscalationLabel: '13.05 11:30',
  },
  {
    operator: 'Marina Shevchenko',
    client: '#243200',
    agreement: 'D-8102',
    promiseAmount: 4800,
    promiseDateLabel: '11.05',
    followedUp: false,
    callAfterEscalationLabel: 'No call',
  },
]

const LEAK_PRESENCE: LeakOperatorPresence[] = [
  'online',
  'online',
  'online',
  'offline',
  'online',
  'busy',
]

export const MOCK_LEAKS: MockLeakRow[] = LEAK_ROWS.map((row, i) => {
  const parts = row.operator.split(' ')
  return {
    id: i + 1,
    ...row,
    operatorInitials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase(),
    operatorAvatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
    operatorPresence: LEAK_PRESENCE[i % LEAK_PRESENCE.length],
  }
})

// ─────────────────────────────────────────────────────────────
// Third Parties (KAN-415)
// ─────────────────────────────────────────────────────────────

export type ThirdPartyResult = 'promise' | 'refusal' | 'will_pass_on' | 'positive' | 'missed_call'

export interface MockThirdPartyRow {
  id: number
  dateLabel: string
  operator: string
  operatorInitials?: string
  operatorAvatarColor?: string
  operatorPresence?: 'online' | 'busy' | 'offline'
  /** Master client identifier shown as a blue link (e.g. "#230114"). */
  clientCode: string
  /** Third-party phone number called (raw digits). */
  thirdPartyPhone: string
  /** Relation label shown beneath the phone (e.g. "Wife", "Father"). */
  thirdPartyRelation: string
  duration: string
  result: ThirdPartyResult
  /** True = third party returned the call to the registered client. */
  returnedToClient: boolean
  /** Optional callback timestamp shown beneath the Yes pill. */
  returnedAtLabel?: string
}

export const MOCK_THIRD_PARTIES_KPIS = {
  callsToThirdParties: 8,
  returnedToClient: 26,
  didNotReturn: 18,
  positiveResult: 5,
}

const THIRD_PARTY_ROWS: Omit<
  MockThirdPartyRow,
  'id' | 'operatorInitials' | 'operatorAvatarColor' | 'operatorPresence'
>[] = [
  {
    dateLabel: '05/13 09:30',
    operator: 'Kateryna Antonova',
    clientCode: '#230114',
    thirdPartyPhone: '0970001122',
    thirdPartyRelation: 'Wife',
    duration: '1:35',
    result: 'promise',
    returnedToClient: true,
    returnedAtLabel: '05/13 10:15',
  },
  {
    dateLabel: '05/13 10:45',
    operator: 'Oleh Bondar',
    clientCode: '#231088',
    thirdPartyPhone: '0501234567',
    thirdPartyRelation: 'Father',
    duration: '1:02',
    result: 'missed_call',
    returnedToClient: false,
  },
  {
    dateLabel: '05/12 14:55',
    operator: 'Natalia Yefremova',
    clientCode: '#234010',
    thirdPartyPhone: '0732345678',
    thirdPartyRelation: 'Colleague',
    duration: '3:00',
    result: 'will_pass_on',
    returnedToClient: true,
    returnedAtLabel: '05/12 16:00',
  },
  {
    dateLabel: '05/12 11:20',
    operator: 'Sofia Lytvyn',
    clientCode: '#235100',
    thirdPartyPhone: '0663456789',
    thirdPartyRelation: 'Mother',
    duration: '4:00',
    result: 'promise',
    returnedToClient: true,
    returnedAtLabel: '05/12 12:00',
  },
  {
    dateLabel: '05/13 09:10',
    operator: 'Denys Polyakov',
    clientCode: '#236200',
    thirdPartyPhone: '0504567890',
    thirdPartyRelation: 'Brother',
    duration: '0:45',
    result: 'refusal',
    returnedToClient: false,
  },
  {
    dateLabel: '05/13 08:45',
    operator: 'Artem Honchar',
    clientCode: '#239800',
    thirdPartyPhone: '0675678901',
    thirdPartyRelation: 'Neighbor',
    duration: '0:30',
    result: 'missed_call',
    returnedToClient: false,
  },
  {
    dateLabel: '05/13 10:10',
    operator: 'Yurii Kravtsov',
    clientCode: '#238000',
    thirdPartyPhone: '0636789099',
    thirdPartyRelation: 'Wife',
    duration: '2:35',
    result: 'promise',
    returnedToClient: true,
    returnedAtLabel: '05/13 11:00',
  },
  {
    dateLabel: '05/12 13:30',
    operator: 'Bohdan Melnyk',
    clientCode: '#239100',
    thirdPartyPhone: '0997890123',
    thirdPartyRelation: 'Employer',
    duration: '1:28',
    result: 'will_pass_on',
    returnedToClient: true,
    returnedAtLabel: '05/12 15:00',
  },
]

const THIRD_PARTY_PRESENCE: NonNullable<MockThirdPartyRow['operatorPresence']>[] = [
  'online',
  'online',
  'online',
  'online',
  'online',
  'online',
  'busy',
  'offline',
]

export const MOCK_THIRD_PARTIES: MockThirdPartyRow[] = THIRD_PARTY_ROWS.map((row, i) => {
  const parts = row.operator.split(' ')
  return {
    id: i + 1,
    ...row,
    operatorInitials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase(),
    operatorAvatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
    operatorPresence: THIRD_PARTY_PRESENCE[i % THIRD_PARTY_PRESENCE.length],
  }
})

// ─────────────────────────────────────────────────────────────
// Time at Work (KAN-415)
// ─────────────────────────────────────────────────────────────

export interface MockTimeAtWorkRow {
  id: number
  operator: string
  initials: string
  avatarColor: string
  department: string
  calls: number
  /** Average seconds-to-card (e.g. "25c"). */
  timeToCard: string
  /** Including-credits duration label (e.g. "1min 33s"). */
  inclCredits: string
  /** Fill-form duration label (e.g. "37c"). */
  fillForms: string
  /** Downtime per shift label (e.g. "58 min"). */
  downtimeShift: string
  /** After-call duration label (e.g. "45c"). */
  afterCall: string
}

export const MOCK_TIME_AT_WORK_KPIS = {
  toCardAvg: '12c',
  creditsAvg: '45c',
  toFormAvg: '18c',
  downtimeAvg: '28 min',
  afterCallAvg: '22c',
}

const TIME_AT_WORK_ROWS: Omit<MockTimeAtWorkRow, 'id' | 'initials' | 'avatarColor'>[] = [
  {
    operator: 'Bohdan Melnyk',
    department: 'Department C',
    calls: 18,
    timeToCard: '25c',
    inclCredits: '1min 33s',
    fillForms: '37c',
    downtimeShift: '58 min',
    afterCall: '45c',
  },
  {
    operator: 'Svitlana Hordiienko',
    department: 'Department C',
    calls: 5,
    timeToCard: '25c',
    inclCredits: '1min 33s',
    fillForms: '37c',
    downtimeShift: '58 min',
    afterCall: '46c',
  },
  {
    operator: 'Serhii Lytvyn',
    department: 'Department B',
    calls: 9,
    timeToCard: '23c',
    inclCredits: '1min 25s',
    fillForms: '34c',
    downtimeShift: '53 min',
    afterCall: '42c',
  },
  {
    operator: 'Yurii Kravtsov',
    department: 'Department B',
    calls: 10,
    timeToCard: '23c',
    inclCredits: '1min 26s',
    fillForms: '34c',
    downtimeShift: '53 min',
    afterCall: '42c',
  },
  {
    operator: 'Nataliia Yefremova',
    department: 'Department B',
    calls: 8,
    timeToCard: '22c',
    inclCredits: '1min 24s',
    fillForms: '34c',
    downtimeShift: '52 min',
    afterCall: '41c',
  },
  {
    operator: 'Artem Honchar',
    department: 'Department A',
    calls: 17,
    timeToCard: '21c',
    inclCredits: '1min 20s',
    fillForms: '32c',
    downtimeShift: '50 min',
    afterCall: '39c',
  },
  {
    operator: 'Oleksandra Bila',
    department: 'Department A',
    calls: 18,
    timeToCard: '22c',
    inclCredits: '1min 21s',
    fillForms: '32c',
    downtimeShift: '50 min',
    afterCall: '40c',
  },
  {
    operator: 'Denys Poltavets',
    department: 'Department A',
    calls: 15,
    timeToCard: '21c',
    inclCredits: '1min 18s',
    fillForms: '31c',
    downtimeShift: '49 min',
    afterCall: '38c',
  },
]

export const MOCK_TIME_AT_WORK: MockTimeAtWorkRow[] = TIME_AT_WORK_ROWS.map((row, i) => {
  const parts = row.operator.split(' ')
  return {
    id: i + 1,
    ...row,
    initials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase(),
    avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
  }
})

// ─────────────────────────────────────────────────────────────
// Script Analytics (KAN-503)
// ─────────────────────────────────────────────────────────────

export interface MockScriptAlert {
  id: number
  /** Short category label rendered as a colored pill on the left. */
  category: string
  /** Severity drives the category pill color tone. */
  severity: 'info' | 'warn' | 'critical'
  operator: string
  operatorInitials: string
  operatorAvatarColor: string
  /** Longer description line explaining the flag. */
  description: string
  /** Short date/time label rendered before the action buttons. */
  dateLabel: string
}

export const MOCK_SCRIPT_ALERTS: MockScriptAlert[] = [
  {
    id: 1,
    category: 'Series of missed calls',
    severity: 'critical',
    operator: 'Artem Honchar',
    operatorInitials: 'AH',
    operatorAvatarColor: '#FEE4E2',
    description: '5 consecutive calls - "missed call"',
    dateLabel: '05/13 09:40',
  },
  {
    id: 2,
    category: 'Quick result (< 10s)',
    severity: 'warn',
    operator: 'Denys Poltavets',
    operatorInitials: 'DP',
    operatorAvatarColor: '#E0E7FF',
    description: 'Result posted 7s after the call',
    dateLabel: '05/13 10:15',
  },
  {
    id: 3,
    category: 'No promises for several days',
    severity: 'warn',
    operator: 'Iryna Sokil',
    operatorInitials: 'IS',
    operatorAvatarColor: '#FCE7F3',
    description: 'Did not use "promise" for 3 consecutive days',
    dateLabel: '05/13 08:00',
  },
  {
    id: 4,
    category: 'Result without card',
    severity: 'critical',
    operator: 'Oleg Bondar',
    operatorInitials: 'OB',
    operatorAvatarColor: '#D1FAE5',
    description: "Result without opening the client's card",
    dateLabel: '05/13 11:00',
  },
  {
    id: 5,
    category: 'Promise without the Credits tab',
    severity: 'info',
    operator: 'Yuriy Kravtsov',
    operatorInitials: 'YK',
    operatorAvatarColor: '#E0E7FF',
    description: '"Promise" - the Credits tab was not opened',
    dateLabel: '05/13 09:55',
  },
  {
    id: 6,
    category: 'Repeat call < 10 min',
    severity: 'critical',
    operator: 'Marina Shevchenko',
    operatorInitials: 'MS',
    operatorAvatarColor: '#FEF3C7',
    description: 'Same client - repeat call after 8 min',
    dateLabel: '05/13 12:10',
  },
]

export interface MockScriptDistribution {
  id: number
  operator: string
  initials: string
  avatarColor: string
  department: string
  total: number
  promises: number
  promisesPct: number
  refusals: number
  refusalsPct: number
  missedCalls: number
  missedCallsPct: number
  willPass: number
  willPassPct: number
  flags: number
}

const SCRIPT_DISTRIBUTION_ROWS: Omit<MockScriptDistribution, 'id' | 'initials' | 'avatarColor'>[] =
  [
    {
      operator: 'Oleg Bondar',
      department: 'Department A',
      total: 6,
      promises: 2,
      promisesPct: 33,
      refusals: 1,
      refusalsPct: 17,
      missedCalls: 2,
      missedCallsPct: 33,
      willPass: 1,
      willPassPct: 17,
      flags: 1,
    },
    {
      operator: 'Marina Shevchenko',
      department: 'Department A',
      total: 7,
      promises: 3,
      promisesPct: 43,
      refusals: 2,
      refusalsPct: 29,
      missedCalls: 2,
      missedCallsPct: 29,
      willPass: 0,
      willPassPct: 0,
      flags: 1,
    },
    {
      operator: 'Iryna Sokil',
      department: 'Department A',
      total: 9,
      promises: 4,
      promisesPct: 44,
      refusals: 2,
      refusalsPct: 22,
      missedCalls: 2,
      missedCallsPct: 22,
      willPass: 1,
      willPassPct: 11,
      flags: 1,
    },
    {
      operator: 'Artem Honchar',
      department: 'Department A',
      total: 11,
      promises: 5,
      promisesPct: 45,
      refusals: 3,
      refusalsPct: 27,
      missedCalls: 2,
      missedCallsPct: 18,
      willPass: 1,
      willPassPct: 10,
      flags: 2,
    },
    {
      operator: 'Denys Poltavets',
      department: 'Department A',
      total: 8,
      promises: 3,
      promisesPct: 38,
      refusals: 2,
      refusalsPct: 25,
      missedCalls: 2,
      missedCallsPct: 25,
      willPass: 1,
      willPassPct: 12,
      flags: 1,
    },
  ]

export const MOCK_SCRIPT_DISTRIBUTION: MockScriptDistribution[] = SCRIPT_DISTRIBUTION_ROWS.map(
  (row, i) => {
    const parts = row.operator.split(' ')
    return {
      id: i + 1,
      ...row,
      initials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase(),
      avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
    }
  }
)

/** Footer banner data shown at the bottom of Script Analytics. */
export const MOCK_COACH_CONTEXT = {
  title: "Coach's Workspace",
  region: 'UA',
  product: 'Consumer Loans',
  assignmentText: "You are assigned to the department 'Department A · Hard Collection'.",
  operatorsInOperation: 7,
}

// ─────────────────────────────────────────────────────────────
// Action Analysis — Interactions (existing surface, with new visuals)
// ─────────────────────────────────────────────────────────────

export type InteractionSource = 'Promise' | 'Missed call' | 'Refusal' | 'Will pass' | 'Positive'

export interface MockInteractionRow {
  id: number
  dateLabel: string
  operator: string
  /** Initials for the small avatar in the operator column. */
  operatorInitials?: string
  /** Avatar background color for the operator column. */
  operatorAvatarColor?: string
  duration: string
  source: InteractionSource
  /** "Break in row" — gap since the previous call by the same operator. */
  breakInRowLabel: string
  client: string
  deal: string
  /** Optional promised amount (in ₴). */
  amountPromised?: number
}

export const MOCK_INTERACTIONS_KPIS = {
  interactionsTotal: 90,
  promises: 36,
  refusals: 18,
  willPass: 26,
  missedCalls: 26,
  averageDuration: '15 min',
}

const INTERACTION_SOURCES: InteractionSource[] = [
  'Promise',
  'Missed call',
  'Refusal',
  'Will pass',
  'Positive',
]

export const MOCK_INTERACTIONS: MockInteractionRow[] = Array.from({ length: 12 }, (_, i) => {
  const operator = OPERATOR_NAMES[i % OPERATOR_NAMES.length]
  const parts = operator.split(' ')
  const source = INTERACTION_SOURCES[i % INTERACTION_SOURCES.length]
  return {
    id: i + 1,
    dateLabel: `May ${10 + (i % 6)} 1${i % 9}:30`,
    operator,
    operatorInitials: `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase(),
    operatorAvatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
    duration: `${2 + (i % 5)}:${String(10 + i).slice(-2)}`,
    source,
    breakInRowLabel: i % 3 === 0 ? '14m' : i % 3 === 1 ? '7m' : '23m',
    client: `Client #${i + 1}`,
    deal: i % 2 === 0 ? `AGR-${1000 + i}` : '–',
    amountPromised: source === 'Promise' ? 2300 + i * 100 : undefined,
  }
})

// ─────────────────────────────────────────────────────────────
// Inbox tab mocks (KAN-413)
// ─────────────────────────────────────────────────────────────

export type InboxAssignmentState =
  | 'wait'
  | 'in_progress'
  | 'awaiting_training'
  | 'scheduled'
  | 'closed'

export type InboxPriority = 'critical' | 'average' | 'low'

export interface MockInboxTrigger {
  id: number
  code: string
  label: string
  severity: 'info' | 'warn' | 'critical'
  detectedAtLabel: string
}

/** Colored trigger chips on Kanban / Grid cards (Figma). */
export interface MockInboxTriggerTag {
  label: string
  tone: 'red' | 'amber' | 'teal'
}

export interface InboxCardRow {
  operatorId: number
  name: string
  initials: string
  avatarColor: string
  team: string
  department: string
  segment: string
  extension: string
  online: boolean
  lastActiveLabel: string
  state: InboxAssignmentState
  priority: InboxPriority
  compositeScore: number
  scoreBand: ScoreBand
  /** False when the BE returned a null composite score (no source data).
   *  Views render a `—` ring instead of the actual `compositeScore` value. */
  hasScore?: boolean
  scoreDeltaPct: number
  triggers: MockInboxTrigger[]
  triggerTags: MockInboxTriggerTag[]
  flagged: boolean
  queueEnteredLabel: string
  dailyPlanPct: number
  dailyPlanDone: number
  dailyPlanTotal: number
  onlineDuration: string
  onlineSince: string
  experienceYear: string
  experienceDate: string
  activityMinutes: number
  listStatusDot: 'red' | 'amber' | 'green'
  cardTimestamp: string
  /** One-line queue context on Inbox View B employee cards. */
  cardSummary: string
}

export interface MockInboxTeamEvent {
  id: number
  timeLabel: string
  operatorName: string
  initials: string
  /** Large avatar ring — Figma Details-RightView Event Feed */
  avatarRingBg: string
  /** 20px type badge beside avatar */
  badgeColor: string
  /** Small status dot on avatar ring */
  statusDotColor?: string
  title: string
  description: string
}

export const MOCK_INBOX_TEAM_EVENTS: MockInboxTeamEvent[] = [
  {
    id: 1,
    timeLabel: '09:41',
    operatorName: 'Artem Honchar',
    initials: 'АГ',
    avatarRingBg: '#FEF2F2',
    badgeColor: '#FCA5A5',
    statusDotColor: '#EF4444',
    title: 'Day plan dropped to 14%',
    description: 'At 11:00 — below the morning threshold.',
  },
  {
    id: 2,
    timeLabel: '09:22',
    operatorName: 'Svetlana Hordiienko',
    initials: 'СГ',
    avatarRingBg: '#EFF6FF',
    badgeColor: '#BFDBFE',
    title: 'Completed drill "Tone and Pace"',
    description: 'Score 82/100 — passed on first attempt.',
  },
  {
    id: 3,
    timeLabel: '08:55',
    operatorName: 'Denys Poltavets',
    initials: 'ДП',
    avatarRingBg: '#F0FDF4',
    badgeColor: '#BBFB5B',
    title: 'Entered a call',
    description: 'Client #C-2044 — Hard Collection.',
  },
  {
    id: 4,
    timeLabel: '08:30',
    operatorName: 'Iryna Sokol',
    initials: 'ІС',
    avatarRingBg: '#FEFCE8',
    badgeColor: '#FCA5A5',
    title: 'Training assigned',
    description: 'Course "Empathy" — due 05/20.',
  },
  {
    id: 5,
    timeLabel: '08:12',
    operatorName: 'Yuriy Kravtsov',
    initials: 'ЮК',
    avatarRingBg: '#FEFCE8',
    badgeColor: '#FDE047',
    title: 'Low dialogue rating',
    description: '38 points on call #C-1016.',
  },
  {
    id: 6,
    timeLabel: '07:58',
    operatorName: 'Bohdan Melnyk',
    initials: 'БМ',
    avatarRingBg: '#FEFCE8',
    badgeColor: '#BFDBFE',
    statusDotColor: '#3B82F6',
    title: '1-on-1 scheduled',
    description: '05/15 — Tough conversation follow-up.',
  },
  {
    id: 7,
    timeLabel: '07:40',
    operatorName: 'Oleh Bondar',
    initials: 'ОБ',
    avatarRingBg: '#F0FDF4',
    badgeColor: '#7ACEC5',
    title: 'Case closed',
    description: 'Resolution: Corrected after coaching.',
  },
  {
    id: 8,
    timeLabel: '07:22',
    operatorName: 'Artem Honchar',
    initials: 'АГ',
    avatarRingBg: '#FEF2F2',
    badgeColor: '#FCA5A5',
    statusDotColor: '#EF4444',
    title: 'Entered the queue',
    description: '4 triggers accumulated — critical priority.',
  },
  {
    id: 9,
    timeLabel: '07:05',
    operatorName: 'Svetlana Hordiienko',
    initials: 'СГ',
    avatarRingBg: '#EFF6FF',
    badgeColor: '#BFDBFE',
    title: 'Weekly plan at risk',
    description: '42% complete — 3 days left in the week.',
  },
  {
    id: 10,
    timeLabel: '06:50',
    operatorName: 'Denys Poltavets',
    initials: 'ДП',
    avatarRingBg: '#FEFCE8',
    badgeColor: '#FCA5A5',
    title: 'Came online',
    description: 'Shift started at 7:30.',
  },
  {
    id: 11,
    timeLabel: '06:30',
    operatorName: 'Iryna Sokol',
    initials: 'ІС',
    avatarRingBg: '#FEF2F2',
    badgeColor: '#BFDBFE',
    statusDotColor: '#EF4444',
    title: 'Dialogue rated',
    description: 'Score 71/100 — no triggers.',
  },
]

const INBOX_TRIGGERS_POOL: Omit<MockInboxTrigger, 'detectedAtLabel'>[] = [
  { id: 1, code: 'missed_calls', label: '3 missed calls in a row', severity: 'critical' },
  { id: 2, code: 'low_score', label: 'Score dropped 15%', severity: 'critical' },
  { id: 3, code: 'silence', label: 'Long silence 18s', severity: 'warn' },
  { id: 4, code: 'tone', label: 'Tone-of-voice flag', severity: 'warn' },
  { id: 5, code: 'overdue_promise', label: 'Overdue promise', severity: 'warn' },
  { id: 6, code: 'no_summary', label: 'Missing dialogue summary', severity: 'info' },
]

/** Figma INBOX frames — operator roster, scores, and trigger tags. */
const FIGMA_INBOX_OPERATORS: Omit<
  InboxCardRow,
  'triggers' | 'triggerTags' | 'scoreBand' | 'flagged'
>[] = [
  {
    operatorId: 1,
    name: 'Artem Honchar',
    initials: 'АГ',
    avatarColor: '#FCA5A5',
    team: 'A - Hard Collection',
    department: 'Hard Collection',
    segment: 'Charlie',
    extension: '5022',
    online: false,
    lastActiveLabel: '46 min',
    state: 'in_progress',
    priority: 'critical',
    compositeScore: 42,
    scoreDeltaPct: -8,
    queueEnteredLabel: 'entered the queue on 05/13 at 09:22 (today)',
    dailyPlanPct: 15,
    dailyPlanDone: 8,
    dailyPlanTotal: 55,
    onlineDuration: '1h 04m',
    onlineSince: 'from 8:00',
    experienceYear: '2024',
    experienceDate: '11/21/2024',
    activityMinutes: 46,
    listStatusDot: 'red',
    cardTimestamp: '05/13 09:22 today',
    cardSummary:
      '4 red flags. Escalation likely needed — case open for 0 days, but triggers have accumulated.',
  },
  {
    operatorId: 2,
    name: 'Svetlana Hordiienko',
    initials: 'СГ',
    avatarColor: '#E0E7FF',
    team: 'A - Hard Collection',
    department: 'Hard Collection',
    segment: 'Bravo',
    extension: '5018',
    online: true,
    lastActiveLabel: 'Online',
    state: 'in_progress',
    priority: 'average',
    compositeScore: 58,
    scoreDeltaPct: 2,
    queueEnteredLabel: 'entered the queue on 05/13 at 08:45 (today)',
    dailyPlanPct: 42,
    dailyPlanDone: 23,
    dailyPlanTotal: 55,
    onlineDuration: '2h 10m',
    onlineSince: 'from 7:30',
    experienceYear: '2023',
    experienceDate: '03/14/2023',
    activityMinutes: 12,
    listStatusDot: 'amber',
    cardTimestamp: '05/13 08:45 today',
    cardSummary: 'Weekly plan at 42% — on track but 2 dialogue flags in the last shift.',
  },
  {
    operatorId: 3,
    name: 'Denys Poltavets',
    initials: 'ДП',
    avatarColor: '#FEF3C7',
    team: 'B - Soft Collection',
    department: 'Soft Collection',
    segment: 'Alpha',
    extension: '5031',
    online: false,
    lastActiveLabel: 'In call',
    state: 'wait',
    priority: 'average',
    compositeScore: 61,
    scoreDeltaPct: -3,
    queueEnteredLabel: 'entered the queue on 05/12 at 16:10',
    dailyPlanPct: 38,
    dailyPlanDone: 21,
    dailyPlanTotal: 55,
    onlineDuration: '45m',
    onlineSince: 'from 9:15',
    experienceYear: '2022',
    experienceDate: '08/02/2022',
    activityMinutes: 28,
    listStatusDot: 'amber',
    cardTimestamp: '05/12 16:10',
    cardSummary: 'On a call — monitoring tone-of-voice markers from the live session.',
  },
  {
    operatorId: 4,
    name: 'Iryna Sokol',
    initials: 'ІС',
    avatarColor: '#D1FAE5',
    team: 'A - Hard Collection',
    department: 'Hard Collection',
    segment: 'Charlie',
    extension: '5044',
    online: true,
    lastActiveLabel: 'Online',
    state: 'awaiting_training',
    priority: 'low',
    compositeScore: 72,
    scoreDeltaPct: 5,
    queueEnteredLabel: 'entered the queue on 05/11 at 14:00',
    dailyPlanPct: 68,
    dailyPlanDone: 37,
    dailyPlanTotal: 55,
    onlineDuration: '3h 20m',
    onlineSince: 'from 7:00',
    experienceYear: '2021',
    experienceDate: '01/19/2021',
    activityMinutes: 5,
    listStatusDot: 'green',
    cardTimestamp: '05/11 14:00',
    cardSummary: 'Awaiting training — course assignment pending confirmation.',
  },
  {
    operatorId: 5,
    name: 'Bohdan Melnyk',
    initials: 'БМ',
    avatarColor: '#FFEDD5',
    team: 'B - Soft Collection',
    department: 'Soft Collection',
    segment: 'Delta',
    extension: '5055',
    online: false,
    lastActiveLabel: '22 min',
    state: 'scheduled',
    priority: 'low',
    compositeScore: 78,
    scoreDeltaPct: 4,
    queueEnteredLabel: 'entered the queue on 05/10 at 11:30',
    dailyPlanPct: 81,
    dailyPlanDone: 44,
    dailyPlanTotal: 55,
    onlineDuration: '55m',
    onlineSince: 'from 10:00',
    experienceYear: '2020',
    experienceDate: '06/08/2020',
    activityMinutes: 18,
    listStatusDot: 'green',
    cardTimestamp: '05/10 11:30',
    cardSummary: '1-on-1 scheduled — no new triggers since last session.',
  },
  {
    operatorId: 6,
    name: 'Yuriy Kravtsov',
    initials: 'ЮК',
    avatarColor: '#E0F2EC',
    team: 'A - Hard Collection',
    department: 'Hard Collection',
    segment: 'Bravo',
    extension: '5062',
    online: true,
    lastActiveLabel: 'Online',
    state: 'wait',
    priority: 'critical',
    compositeScore: 39,
    scoreDeltaPct: -12,
    queueEnteredLabel: 'entered the queue on 05/13 at 07:55 (today)',
    dailyPlanPct: 12,
    dailyPlanDone: 7,
    dailyPlanTotal: 55,
    onlineDuration: '1h 30m',
    onlineSince: 'from 8:00',
    experienceYear: '2024',
    experienceDate: '09/03/2024',
    activityMinutes: 52,
    listStatusDot: 'red',
    cardTimestamp: '05/13 07:55 today',
    cardSummary: 'Daily plan at 12% — escalation likely if no improvement by noon.',
  },
  {
    operatorId: 7,
    name: 'Oleh Bondar',
    initials: 'ОБ',
    avatarColor: '#FCE7F3',
    team: 'A - Hard Collection',
    department: 'Hard Collection',
    segment: 'Charlie',
    extension: '5070',
    online: false,
    lastActiveLabel: '1h ago',
    state: 'closed',
    priority: 'average',
    compositeScore: 65,
    scoreDeltaPct: 1,
    queueEnteredLabel: 'entered the queue on 05/09 at 10:15',
    dailyPlanPct: 55,
    dailyPlanDone: 30,
    dailyPlanTotal: 55,
    onlineDuration: '—',
    onlineSince: '—',
    experienceYear: '2019',
    experienceDate: '04/22/2019',
    activityMinutes: 0,
    listStatusDot: 'green',
    cardTimestamp: '05/09 10:15',
    cardSummary: 'Closed with resolution — corrected after last coaching session.',
  },
]

function buildInboxRow(base: (typeof FIGMA_INBOX_OPERATORS)[number]): InboxCardRow {
  const triggersCount = base.priority === 'critical' ? 4 : base.priority === 'average' ? 2 : 1
  const triggers = INBOX_TRIGGERS_POOL.slice(0, triggersCount).map((t, j) => ({
    ...t,
    detectedAtLabel: `${j + 1}h ago`,
  }))
  const triggerTags: MockInboxTriggerTag[] =
    base.priority === 'critical'
      ? [
          { label: 'Assessment', tone: 'red' },
          { label: 'Weekly Plan', tone: 'red' },
          { label: 'Downtime +1', tone: 'amber' },
        ]
      : base.priority === 'average'
        ? [
            { label: 'Rating', tone: 'red' },
            { label: 'Weekly Plan', tone: 'red' },
          ]
        : [{ label: 'Idle', tone: 'amber' }]
  return {
    ...base,
    scoreBand: scoreBandFor(base.compositeScore),
    triggers,
    triggerTags,
    flagged: triggersCount > 0,
  }
}

export const MOCK_INBOX_ROWS: InboxCardRow[] = FIGMA_INBOX_OPERATORS.map(buildInboxRow)

export const MOCK_INBOX_PRIORITY_COUNTS: Record<InboxPriority | 'all', number> = {
  all: MOCK_INBOX_ROWS.length,
  critical: MOCK_INBOX_ROWS.filter((r) => r.priority === 'critical').length,
  average: MOCK_INBOX_ROWS.filter((r) => r.priority === 'average').length,
  low: MOCK_INBOX_ROWS.filter((r) => r.priority === 'low').length,
}

export const MOCK_INBOX_STATE_COUNTS: Record<InboxAssignmentState, number> = {
  wait: MOCK_INBOX_ROWS.filter((r) => r.state === 'wait').length,
  in_progress: MOCK_INBOX_ROWS.filter((r) => r.state === 'in_progress').length,
  awaiting_training: MOCK_INBOX_ROWS.filter((r) => r.state === 'awaiting_training').length,
  scheduled: MOCK_INBOX_ROWS.filter((r) => r.state === 'scheduled').length,
  closed: MOCK_INBOX_ROWS.filter((r) => r.state === 'closed').length,
}

// Detail panel — per-operator recent calls + score breakdown + 1-on-1 history.

export interface MockOperatorRecentCall {
  id: number
  dateLabel: string
  durationLabel: string
  result: 'Promise' | 'Refusal' | 'Missed' | 'Positive'
  score: number
  scoreBand: ScoreBand
}

export interface MockOperatorScoreSeries {
  label: string
  value: number
}

export interface MockOperatorDetail {
  // Figma "Inbox View A" body sections
  statusBannerText: string
  statsRow: { label: string; value: string; subValue?: string; cardTone: 'red' | 'gray' }[]
  whyInQueue: {
    id: number
    label: string
    meta: string
    tone: 'red' | 'amber' | 'green'
    icon: 'rating' | 'plan' | 'training' | 'delay'
  }[]
  latestDialogueRatings: {
    id: number
    label: string
    meta?: string
    triggerCount: number
    score: number
    scoreOutOf: number
    tone: 'red' | 'amber' | 'green'
  }[]
  nextOneOnOne: { topic: string; dateLabel: string; triggerCount: number }
  // Extra fields used elsewhere (kept for back-compat)
  recentCalls: MockOperatorRecentCall[]
  scoreSeries: MockOperatorScoreSeries[]
  criteria: { label: string; score: number; max: number }[]
  recentOneOnOnes: { dateLabel: string; topic: string; status: 'done' | 'planned' }[]
  feedbackThreadCount: number
  notes: string[]
}

export const MOCK_OPERATOR_DETAIL: MockOperatorDetail = {
  statusBannerText:
    '4 red flags. Escalation likely needed — case open for 0 days, but triggers have accumulated.',
  statsRow: [
    { label: 'Daily plan', value: '15%', subValue: '8/55', cardTone: 'red' },
    { label: 'Online', value: '1h 04m', subValue: 'from 8:00', cardTone: 'gray' },
    { label: 'Internship', value: '2024', subValue: '11/21/2024', cardTone: 'gray' },
  ],
  nextOneOnOne: {
    topic: 'Tough conversation: 4 triggers',
    dateLabel: '05/15',
    triggerCount: 4,
  },
  whyInQueue: [
    {
      id: 1,
      label: 'Low dialogue rating',
      meta: '38 points - call #C-1016',
      tone: 'red',
      icon: 'rating',
    },
    {
      id: 2,
      label: 'Daily plan not being met',
      meta: '14% at 11:00',
      tone: 'amber',
      icon: 'plan',
    },
    {
      id: 3,
      label: 'Overdue training',
      meta: "Course 'Empathy' overdue",
      tone: 'red',
      icon: 'training',
    },
    {
      id: 4,
      label: 'Delay / little online',
      meta: '47 min delay',
      tone: 'amber',
      icon: 'delay',
    },
  ],
  latestDialogueRatings: [
    {
      id: 1,
      label: 'Conflict with client',
      meta: '05/11 at 16:55 · #1016',
      triggerCount: 4,
      score: 38,
      scoreOutOf: 100,
      tone: 'red',
    },
  ],
  recentCalls: Array.from({ length: 5 }, (_, i) => {
    const score = 50 + ((i * 13) % 45)
    return {
      id: i + 1,
      dateLabel: `${13 - i}.05 1${i % 9}:${30 + i}`,
      durationLabel: `${2 + (i % 4)}:${String(10 + i).slice(-2)}`,
      result:
        i % 4 === 0 ? 'Promise' : i % 4 === 1 ? 'Refusal' : i % 4 === 2 ? 'Missed' : 'Positive',
      score,
      scoreBand: scoreBandFor(score),
    }
  }),
  scoreSeries: [
    { label: 'Mon', value: 65 },
    { label: 'Tue', value: 71 },
    { label: 'Wed', value: 60 },
    { label: 'Thu', value: 78 },
    { label: 'Fri', value: 72 },
    { label: 'Sat', value: 68 },
    { label: 'Sun', value: 75 },
  ],
  criteria: [
    { label: 'Greeting', score: 5, max: 5 },
    { label: 'Information gathering', score: 8, max: 10 },
    { label: 'Tone & orientation', score: 9, max: 10 },
    { label: 'Objection handling', score: 14, max: 20 },
    { label: 'Motivation', score: 16, max: 20 },
    { label: 'Summary', score: 7, max: 10 },
  ],
  recentOneOnOnes: [
    { dateLabel: '12.05 10:30', topic: 'Objection handling refresh', status: 'done' },
    { dateLabel: '20.05 15:00', topic: 'Tone of voice coaching', status: 'planned' },
  ],
  feedbackThreadCount: 3,
  notes: [
    'Tends to skip the summary step in long calls.',
    'Strong on empathy — keep pairing with the soft-collection track.',
  ],
}

// ─────────────────────────────────────────────────────────────
// Heat Map (KAN-502) — operator × hour dominant-state grid
// ─────────────────────────────────────────────────────────────

/** Dominant state per operator-hour cell — drives the cell color in Heatmap. */
export type HeatmapState = 'call' | 'after_call' | 'waiting' | 'idle' | 'break' | 'offline'

export const HEATMAP_HOURS = [
  '8:00',
  '9:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
]

export interface MockHeatmapOperator {
  id: number
  name: string
  initials: string
  avatarColor: string
  /** Dominant state per hour, aligned to HEATMAP_HOURS. */
  states: HeatmapState[]
}

const HEATMAP_OPERATORS_BASE: { name: string; states: HeatmapState[] }[] = [
  {
    name: 'Kateryna A.',
    states: [
      'call',
      'after_call',
      'waiting',
      'idle',
      'waiting',
      'call',
      'idle',
      'after_call',
      'waiting',
      'offline',
    ],
  },
  {
    name: 'Oleg B.',
    states: [
      'call',
      'call',
      'after_call',
      'waiting',
      'idle',
      'after_call',
      'waiting',
      'call',
      'offline',
      'call',
    ],
  },
  {
    name: 'Marina Sh.',
    states: [
      'call',
      'after_call',
      'waiting',
      'idle',
      'waiting',
      'call',
      'waiting',
      'offline',
      'call',
      'call',
    ],
  },
  {
    name: 'Denys P.',
    states: [
      'after_call',
      'waiting',
      'idle',
      'waiting',
      'idle',
      'waiting',
      'call',
      'call',
      'after_call',
      'call',
    ],
  },
  {
    name: 'Iryna S.',
    states: [
      'waiting',
      'call',
      'idle',
      'after_call',
      'waiting',
      'offline',
      'call',
      'call',
      'call',
      'after_call',
    ],
  },
  {
    name: 'Artem H.',
    states: [
      'call',
      'idle',
      'idle',
      'after_call',
      'waiting',
      'offline',
      'call',
      'call',
      'offline',
      'offline',
    ],
  },
  {
    name: 'Oleksandra B.',
    states: [
      'idle',
      'after_call',
      'call',
      'call',
      'call',
      'call',
      'after_call',
      'waiting',
      'call',
      'call',
    ],
  },
  {
    name: 'Natalia Ye.',
    states: [
      'call',
      'call',
      'after_call',
      'call',
      'call',
      'call',
      'idle',
      'offline',
      'waiting',
      'offline',
    ],
  },
  {
    name: 'Serhiy L.',
    states: [
      'call',
      'call',
      'call',
      'call',
      'idle',
      'after_call',
      'waiting',
      'call',
      'call',
      'call',
    ],
  },
  {
    name: 'Yuriy K.',
    states: [
      'call',
      'after_call',
      'waiting',
      'waiting',
      'after_call',
      'waiting',
      'call',
      'offline',
      'call',
      'call',
    ],
  },
  {
    name: 'Bohdan M.',
    states: [
      'call',
      'after_call',
      'waiting',
      'call',
      'idle',
      'after_call',
      'waiting',
      'call',
      'call',
      'offline',
    ],
  },
  {
    name: 'Svitlana S.',
    states: [
      'call',
      'call',
      'waiting',
      'call',
      'idle',
      'call',
      'after_call',
      'call',
      'call',
      'call',
    ],
  },
]

export const MOCK_HEATMAP_OPERATORS: MockHeatmapOperator[] = HEATMAP_OPERATORS_BASE.map(
  (row, i) => {
    const parts = row.name.split(' ')
    const initials = `${parts[0][0]}${parts[1]?.[0] ?? ''}`.toUpperCase()
    return {
      id: i + 1,
      name: row.name,
      initials,
      avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
      states: row.states,
    }
  }
)
