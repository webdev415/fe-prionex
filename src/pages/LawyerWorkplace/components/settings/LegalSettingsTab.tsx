import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

// ─── Mock data ────────────────────────────────────────────────────────────────

interface LetterTypeConfig {
  id: string
  name: string
  defaultDeadlineDays: number
  active: boolean
}

interface LawyerPriorityConfig {
  id: string
  name: string
  priorityTypes: string[]
  activeTasks: number
}

const LETTER_TYPES: LetterTypeConfig[] = [
  { id: 'complaint', name: 'Complaint', defaultDeadlineDays: 14, active: true },
  { id: 'nbu_inquiry', name: 'NBU inquiry', defaultDeadlineDays: 10, active: true },
  { id: 'court_claim', name: 'Court claim', defaultDeadlineDays: 30, active: true },
  { id: 'attorney_request', name: 'Attorney request', defaultDeadlineDays: 7, active: true },
  { id: 'inquiry', name: 'Incoming request', defaultDeadlineDays: 14, active: true },
]

const LAWYER_PRIORITIES: LawyerPriorityConfig[] = [
  { id: 'vd', name: 'V. Doroshenko', priorityTypes: ['complaint', 'nbu_inquiry'], activeTasks: 3 },
  {
    id: 'lk',
    name: 'L. Kostenko',
    priorityTypes: ['nbu_inquiry', 'attorney_request'],
    activeTasks: 1,
  },
  { id: 'sm', name: 'S. Melnychenko', priorityTypes: ['court_claim'], activeTasks: 2 },
  { id: 'yu', name: 'Y. Demchuk', priorityTypes: ['complaint', 'inquiry'], activeTasks: 0 },
]

const TYPE_BADGE_COLOURS: Record<string, string> = {
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-[#EDE9FE] text-[#6D28D9]',
  inquiry: 'bg-success-100 text-success-700',
}

const TYPE_DISPLAY: Record<string, string> = {
  complaint: 'Complaint',
  nbu_inquiry: 'NBU inquiry',
  court_claim: 'Court claim',
  attorney_request: 'Attorney req.',
  inquiry: 'Inquiry',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LegalSettingsTab() {
  const { t } = useTranslation('common')

  return (
    <div className="w-full max-w-4xl space-y-10 px-5 py-6 lg:px-8 lg:py-8">
      {/* ── Letter type directory ─────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-dark-500 text-[16px] font-medium">
              {t('pages.lawyerWorkplace.settings.letterTypesTitle', 'Letter Type Directory')}
            </h2>
            <p className="text-light-600 mt-0.5 text-[12px]">
              {t(
                'pages.lawyerWorkplace.settings.letterTypesDesc',
                'Configurable list of incoming letter types and their default response deadlines.'
              )}
            </p>
          </div>
          <button
            type="button"
            className="bg-primary-300 text-dark-500 hover:bg-primary-400 rounded-full px-4 py-2 text-[12px] font-medium"
          >
            {t('pages.lawyerWorkplace.settings.addType', '+ Add type')}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-light-600 px-4 py-3 text-[11px] font-semibold tracking-wider uppercase">
                  {t('pages.lawyerWorkplace.settings.typeName', 'Name')}
                </th>
                <th className="text-light-600 px-4 py-3 text-[11px] font-semibold tracking-wider uppercase">
                  {t('pages.lawyerWorkplace.settings.defaultDeadline', 'Default deadline')}
                </th>
                <th className="text-light-600 px-4 py-3 text-[11px] font-semibold tracking-wider uppercase">
                  {t('pages.lawyerWorkplace.settings.status', 'Status')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {LETTER_TYPES.map((type, idx) => (
                <tr
                  key={type.id}
                  className={cn(
                    'transition-colors hover:bg-gray-50/50',
                    idx < LETTER_TYPES.length - 1 && 'border-b border-gray-100'
                  )}
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        TYPE_BADGE_COLOURS[type.id] ?? 'bg-gray-100 text-gray-600'
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                      {type.name}
                    </span>
                  </td>
                  <td className="text-dark-500 px-4 py-3 font-light">
                    {type.defaultDeadlineDays}{' '}
                    {t('pages.lawyerWorkplace.settings.workingDays', 'working days')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        type.active
                          ? 'bg-success-100 text-success-700'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {type.active
                        ? t('pages.lawyerWorkplace.settings.active', 'Active')
                        : t('pages.lawyerWorkplace.settings.archived', 'Archived')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-light-500 hover:text-dark-500 text-[11px] hover:underline"
                    >
                      {t('actions.edit', 'Edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Lawyer priority types ─────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-dark-500 text-[16px] font-medium">
            {t('pages.lawyerWorkplace.settings.lawyerPriorityTitle', 'Lawyer Priority Types')}
          </h2>
          <p className="text-light-600 mt-0.5 text-[12px]">
            {t(
              'pages.lawyerWorkplace.settings.lawyerPriorityDesc',
              'Define which letter types each lawyer handles by priority. Used by the auto-assignment algorithm.'
            )}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-light-600 px-4 py-3 text-[11px] font-semibold tracking-wider uppercase">
                  {t('pages.lawyerWorkplace.settings.lawyer', 'Lawyer')}
                </th>
                <th className="text-light-600 px-4 py-3 text-[11px] font-semibold tracking-wider uppercase">
                  {t('pages.lawyerWorkplace.settings.priorityTypes', 'Priority types')}
                </th>
                <th className="text-light-600 px-4 py-3 text-[11px] font-semibold tracking-wider uppercase">
                  {t('pages.lawyerWorkplace.settings.activeTasks', 'Active tasks')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {LAWYER_PRIORITIES.map((lawyer, idx) => (
                <tr
                  key={lawyer.id}
                  className={cn(
                    'transition-colors hover:bg-gray-50/50',
                    idx < LAWYER_PRIORITIES.length - 1 && 'border-b border-gray-100'
                  )}
                >
                  <td className="text-dark-500 px-4 py-3 font-medium">{lawyer.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {lawyer.priorityTypes.length > 0 ? (
                        lawyer.priorityTypes.map((type) => (
                          <span
                            key={type}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                              TYPE_BADGE_COLOURS[type] ?? 'bg-gray-100 text-gray-600'
                            )}
                          >
                            <span className="h-1 w-1 rounded-full bg-current opacity-80" />
                            {TYPE_DISPLAY[type] ?? type}
                          </span>
                        ))
                      ) : (
                        <span className="text-light-400 text-[12px] italic">
                          {t('pages.lawyerWorkplace.settings.noPriority', 'None (fallback only)')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-dark-500 px-4 py-3 font-light">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        lawyer.activeTasks > 0
                          ? 'bg-information-50 text-information-700'
                          : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {lawyer.activeTasks}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-light-500 hover:text-dark-500 text-[11px] hover:underline"
                    >
                      {t('actions.edit', 'Edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
