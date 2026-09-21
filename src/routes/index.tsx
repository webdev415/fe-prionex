/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionRoute } from './PermissionRoute'
import { GuestRoute } from './GuestRoute'
import { useTabTracker } from '@/features/auth/hooks/useTabTracker'
import { DashboardLayout } from '@/components/layout'
import { RouteErrorElement } from '@/components/RouteErrorElement'
import { V3CutoverRoute } from '@/features/scoring/components/V3CutoverRoute'
// Рубильник раздела кредита закрывает и МАРШРУТЫ, а не только пункт меню:
// прямая ссылка на выключенный раздел обязана объяснить, а не открыть его.
// Импорт точечный, не через бочку `@/pages/Credit`: та тянет все страницы
// раздела в главный чанк и убила бы их ленивую загрузку.
import { CreditSectionGate } from '@/pages/Credit/components/CreditSectionGate'
import { DRAFT_PAGE_PERMISSIONS, PERMISSIONS } from '@/constants/permissions'
import { BulkOperatorAssignmentPageSkeleton } from '@/pages/Operations/BulkOperatorAssignmentPageSkeleton'
import { BulkTagAssignmentPageSkeleton } from '@/pages/Operations/BulkTagAssignmentPageSkeleton'
import { BulkContactTagAssignmentPageSkeleton } from '@/pages/Operations/BulkContactTagAssignmentPageSkeleton'
import { BulkPaymentVerificationPageSkeleton } from '@/pages/Operations/BulkPaymentVerificationPageSkeleton'
import { BulkSaleNotesImportPageSkeleton } from '@/pages/Operations/BulkSaleNotesImportPageSkeleton'
import { BulkDocumentImportPageSkeleton } from '@/pages/Operations/BulkDocumentImportPageSkeleton'
import { RepaymentConfigurationPageSkeleton } from '@/pages/RepaymentConfiguration/RepaymentConfigurationPageSkeleton'
import { AppLoadingFallback } from '@/components/ui/AppLoadingFallback'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ForceChangePasswordPage = lazy(() => import('@/pages/auth/ForceChangePasswordPage'))
const EmployeeCardPage = lazy(() =>
  import('@/pages/EmployeeCard').then((m) => ({ default: m.EmployeeCardPage }))
)
const UserManagementPage = lazy(() =>
  import('@/pages/UserManagement').then((m) => ({ default: m.UserManagementPage }))
)
const IpWhitelistPage = lazy(() =>
  import('@/pages/IpWhitelist').then((m) => ({ default: m.IpWhitelistPage }))
)
const AiSettingsPage = lazy(() =>
  import('@/pages/AiSettings').then((m) => ({ default: m.AiSettingsPage }))
)
const ImportClientsPage = lazy(() => import('@/pages/ImportClients/ImportClientsPage'))
const ImportHistoryPage = lazy(() => import('@/pages/ImportClients/ImportHistoryPage'))
const ImportDetailsPage = lazy(() => import('@/pages/ImportClients/ImportDetailsPage'))
const ProjectManagementPage = lazy(() => import('@/pages/ProjectManagement/ProjectManagementPage'))
const DialerPage = lazy(() => import('@/pages/Dialer').then((m) => ({ default: m.DialerPage })))
const RoleManagementPage = lazy(() =>
  import('@/pages/RoleManagement/RoleManagementPage').then((m) => ({
    default: m.RoleManagementPage,
  }))
)
const DepartmentManagementPage = lazy(() =>
  import('@/pages/DepartmentManagement').then((m) => ({
    default: m.DepartmentManagementPage,
  }))
)
const ClientManagementPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.ClientManagementPage,
  }))
)
const ClientDetailPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.ClientDetailPage,
  }))
)
const ActivityTimelinePage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.ActivityTimelinePage,
  }))
)
const DebtSummaryPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.DebtSummaryPage,
  }))
)
const PaymentHistoryPage = lazy(() =>
  import('@/pages/ClientManagement').then((m) => ({
    default: m.PaymentHistoryPage,
  }))
)
const CreditApplicationsPage = lazy(() =>
  import('@/pages/Credit').then((m) => ({ default: m.CreditApplicationsPage }))
)
const CreditApplicationDetailPage = lazy(() =>
  import('@/pages/Credit').then((m) => ({ default: m.CreditApplicationDetailPage }))
)
const CreditUnderwritingQueuePage = lazy(() =>
  import('@/pages/Credit').then((m) => ({ default: m.CreditUnderwritingQueuePage }))
)
const CreditLoansPage = lazy(() =>
  import('@/pages/Credit').then((m) => ({ default: m.CreditLoansPage }))
)
const CreditLoanDetailPage = lazy(() =>
  import('@/pages/Credit').then((m) => ({ default: m.CreditLoanDetailPage }))
)
const CreditSettingsPage = lazy(() =>
  import('@/pages/Credit').then((m) => ({ default: m.CreditSettingsPage }))
)
const SmsTemplatesPage = lazy(() =>
  import('@/pages/SmsTemplates').then((m) => ({
    default: m.SmsTemplatesPage,
  }))
)
const MessagingCampaignsPage = lazy(() =>
  import('@/pages/MessagingCampaigns').then((m) => ({
    default: m.MessagingCampaignsPage,
  }))
)
const MessagingDraftsPage = lazy(() =>
  import('@/pages/MessagingDrafts').then((m) => ({
    default: m.MessagingDraftsPage,
  }))
)
const MessagingIntegrationsPage = lazy(() =>
  import('@/pages/MessagingIntegrations').then((m) => ({
    default: m.MessagingIntegrationsPage,
  }))
)
const UbkiIntegrationPage = lazy(() =>
  import('@/pages/UbkiIntegration').then((m) => ({
    default: m.UbkiIntegrationPage,
  }))
)
const RRNotificationsPage = lazy(() =>
  import('@/pages/RRNotifications').then((m) => ({
    default: m.RRNotificationsPage,
  }))
)
const RRPeriodicityPage = lazy(() =>
  import('@/pages/RRPeriodicity').then((m) => ({
    default: m.RRPeriodicityPage,
  }))
)
const TAManagementPage = lazy(() =>
  import('@/pages/TAManagement').then((m) => ({
    default: m.TAManagementPage,
  }))
)
const InteractionLogPage = lazy(() =>
  import('@/pages/InteractionLog').then((m) => ({
    default: m.InteractionLogPage,
  }))
)
const DocumentGenerationPage = lazy(() =>
  import('@/pages/DocumentGeneration').then((m) => ({
    default: m.DocumentGenerationPage,
  }))
)
const ReportsDashboardPage = lazy(() =>
  import('@/pages/ReportsDashboard').then((m) => ({
    default: m.ReportsDashboardPage,
  }))
)
const TrainingPage = lazy(() =>
  import('@/pages/Training').then((m) => ({
    default: m.TrainingPage,
  }))
)
const LawyerWorkplacePage = lazy(() =>
  import('@/pages/LawyerWorkplace').then((m) => ({
    default: m.LawyerWorkplacePage,
  }))
)
const ActionAnalysisPage = lazy(() =>
  import('@/pages/ActionAnalysis').then((m) => ({
    default: m.ActionAnalysisPage,
  }))
)
const SellerManagementPage = lazy(() =>
  import('@/pages/SellerManagement').then((m) => ({
    default: m.SellerManagementPage,
  }))
)
const SellerDetailPage = lazy(() =>
  import('@/pages/SellerManagement').then((m) => ({
    default: m.SellerDetailPage,
  }))
)
const ScoringConfigurationPage = lazy(() =>
  import('@/pages/ScoringConfiguration').then((m) => ({
    default: m.ScoringConfigurationPage,
  }))
)
const ConfigurationHistoryPage = lazy(() =>
  import('@/pages/ScoringConfiguration/ConfigurationHistoryPage').then((m) => ({
    default: m.ConfigurationHistoryPage,
  }))
)
const OperatorWorkListPage = lazy(() =>
  import('@/pages/OperatorWorkList').then((m) => ({
    default: m.OperatorWorkListPage,
  }))
)
const ScoringV3SettingsPage = lazy(() =>
  import('@/pages/ScoringV3Settings').then((m) => ({
    default: m.ScoringV3SettingsPage,
  }))
)
const ScoringV3MonitoringPage = lazy(() =>
  import('@/pages/ScoringV3Monitoring').then((m) => ({
    default: m.ScoringV3MonitoringPage,
  }))
)
const AuditLogsPage = lazy(() =>
  import('@/pages/AuditLogs').then((m) => ({ default: m.AuditLogsPage }))
)
const TagsPage = lazy(() => import('@/pages/Tags/TagsPage').then((m) => ({ default: m.TagsPage })))
const ContactTypesPage = lazy(() =>
  import('@/pages/ContactTypes/ContactTypesPage').then((m) => ({ default: m.ContactTypesPage }))
)
const ContactTagsPage = lazy(() =>
  import('@/pages/ContactTags/ContactTagsPage').then((m) => ({ default: m.ContactTagsPage }))
)
const ProfileSettingsPage = lazy(() =>
  import('@/pages/ProfileSettings/ProfileSettingsPage').then((m) => ({
    default: m.ProfileSettingsPage,
  }))
)
const AiAssistantPage = lazy(() =>
  import('@/pages/AiAssistant/AiAssistantBetaPage').then((m) => ({
    default: m.AiAssistantBetaPage,
  }))
)
// /ai-assistant теперь рендерит бета-страницу с реальным API (@/features/aiAssistant).
// Старая мок-страница (AiAssistantPage.tsx, buildMockAssistantReply) удалена.
const BulkOperatorAssignmentPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkOperatorAssignmentPage,
  }))
)
const BulkPaymentVerificationPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkPaymentVerificationPage,
  }))
)
const BulkTagAssignmentPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkTagAssignmentPage,
  }))
)
const BulkContactTagAssignmentPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkContactTagAssignmentPage,
  }))
)
const BulkWriteoffImportPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkWriteoffImportPage,
  }))
)
const BulkReversalImportPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkReversalImportPage,
  }))
)
const RepaymentConfigurationPage = lazy(() =>
  import('@/pages/RepaymentConfiguration/RepaymentConfigurationPage').then((m) => ({
    default: m.RepaymentConfigurationPage,
  }))
)
const BulkSaleNotesImportPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkSaleNotesImportPage,
  }))
)
const BulkDocumentImportPage = lazy(() =>
  import('@/pages/Operations').then((m) => ({
    default: m.BulkDocumentImportPage,
  }))
)

const withSuspense = (element: React.ReactElement) => (
  <Suspense fallback={<AppLoadingFallback />}>{element}</Suspense>
)

const DashboardLayoutRoute = () => {
  // KAN-585: track tab navigations + close events for the session-restore
  // feature. Hook is mounted here (inside RouterProvider tree) because it
  // calls useLocation internally; mounting in App.tsx would throw.
  useTabTracker()
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
    </ProtectedRoute>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <GuestRoute>{withSuspense(<LoginPage />)}</GuestRoute>,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/change-password',
    element: <ProtectedRoute>{withSuspense(<ForceChangePasswordPage />)}</ProtectedRoute>,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayoutRoute />,
    errorElement: <RouteErrorElement />,
    children: [
      {
        index: true,
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<ClientManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'profile',
        element: withSuspense(<ProfileSettingsPage />),
      },
      {
        path: 'ai-assistant',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.AI_ASSISTANT.USE}>
            {withSuspense(<AiAssistantPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'team-management/users',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.USERS.VIEW}>
            {withSuspense(<UserManagementPage />)}
          </PermissionRoute>
        ),
      },
      // Кредитный модуль — отдельный сервис (credit-service) за собственным
      // API. Права credit.* появятся в auth-service вместе с ролями WS-20;
      // до тех пор раздел доступен и по системному праву, иначе его не увидит
      // никто, включая администратора, который его и принимает.
      //
      // `CreditSectionGate` стоит ВНУТРИ проверки прав, а не снаружи: у кого
      // прав нет — тому 403, это про доступ; у кого права есть — тому
      // объяснение про выключенный рубильник, это про решение риск-менеджера.
      // Порядок наоборот показывал бы постороннему внутреннюю причину.
      {
        path: 'credit',
        element: <Navigate to="/dashboard/credit/applications" replace />,
      },
      {
        path: 'credit/applications',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            <CreditSectionGate>{withSuspense(<CreditApplicationsPage />)}</CreditSectionGate>
          </PermissionRoute>
        ),
      },
      {
        path: 'credit/applications/:applicationId',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            <CreditSectionGate>{withSuspense(<CreditApplicationDetailPage />)}</CreditSectionGate>
          </PermissionRoute>
        ),
      },
      {
        // Очередь ручного разбора — та же выборка заявок, что и список, только
        // отобранная по решению «referred». Право то же, что у списка заявок
        // (`credit.applications.read`): очередь читают все три операторские
        // роли модуля, отдельной проверки на фронте быть не должно.
        path: 'credit/underwriting',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            <CreditSectionGate>{withSuspense(<CreditUnderwritingQueuePage />)}</CreditSectionGate>
          </PermissionRoute>
        ),
      },
      {
        path: 'credit/loans',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.CREDIT.LOANS_VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            <CreditSectionGate>{withSuspense(<CreditLoansPage />)}</CreditSectionGate>
          </PermissionRoute>
        ),
      },
      {
        // Настройки модуля: продукты и параметры — риск-менеджеру, интеграции
        // видны всем, кто имеет доступ к разделу (там нет данных клиентов).
        path: 'credit/settings',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.CREDIT.PARAMETERS_VIEW,
              PERMISSIONS.CREDIT.PRODUCTS_VIEW,
              PERMISSIONS.CREDIT.APPLICATIONS_VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            {/* ⚠️ Настройки калиткой НЕ закрыты, и это не упущение.
                Именно здесь живёт сам рубильник. Закрыв эту страницу, мы
                запираем риск-менеджера снаружи: выключил раздел «на полчаса» —
                и включить обратно нечем, кроме прямого запроса к модулю с
                внутренним ключом. Односторонний выключатель хуже отсутствующего.
                Само содержимое настроек при выключенном разделе объясняет
                положение — см. CreditSettingsPage. */}
            {withSuspense(<CreditSettingsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'credit/loans/:loanId',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.CREDIT.LOANS_VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            <CreditSectionGate>{withSuspense(<CreditLoanDetailPage />)}</CreditSectionGate>
          </PermissionRoute>
        ),
      },
      {
        path: 'team-management/users/:userId',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.EMPLOYEE_CARD.VIEW}>
            {withSuspense(<EmployeeCardPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import',
        element: <Navigate to="/dashboard/import/clients" replace />,
      },
      {
        path: 'import/clients',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            {withSuspense(<ImportClientsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import/history',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            {withSuspense(<ImportHistoryPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import/history/:id',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT}>
            {withSuspense(<ImportDetailsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'messaging',
        element: <Navigate to="/dashboard/messaging/campaigns" replace />,
      },
      {
        path: 'messaging/campaigns',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.MESSAGING.VIEW_CAMPAIGN_ANALYTICS}>
            {withSuspense(<MessagingCampaignsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'projects',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.PROJECTS.MANAGE}>
            {withSuspense(<ProjectManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'dialer',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DIALER.VIEW}>
            {withSuspense(<DialerPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'team-management/roles',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            {withSuspense(<RoleManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'team-management/departments',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            {withSuspense(<DepartmentManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/ip-whitelist',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.USERS.EDIT}>
            {withSuspense(<IpWhitelistPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/ai',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS,
              PERMISSIONS.SYSTEM.MANAGE_CALL_QA,
              PERMISSIONS.SYSTEM.MANAGE_ROLES,
            ]}
            mode="any"
          >
            {withSuspense(<AiSettingsPage />)}
          </PermissionRoute>
        ),
      },
      // Backward-compat redirects: legacy top-level paths (/dashboard/users,
      // /roles, /departments) now bounce to the grouped /team-management/* URLs
      // so existing bookmarks and external links keep working. The parent
      // /team-management path redirects to the first child (mirrors the
      // /dashboard/import → /dashboard/import/clients pattern above).
      {
        path: 'team-management',
        element: <Navigate to="/dashboard/team-management/users" replace />,
      },
      {
        path: 'users',
        element: <Navigate to="/dashboard/team-management/users" replace />,
      },
      {
        path: 'roles',
        element: <Navigate to="/dashboard/team-management/roles" replace />,
      },
      {
        path: 'departments',
        element: <Navigate to="/dashboard/team-management/departments" replace />,
      },
      {
        path: 'reports',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.REPORTS.VIEW_ALL_REPORTS}>
            {withSuspense(<ReportsDashboardPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'training',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.TRAINING.VIEW}>
            {withSuspense(<TrainingPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'action-analysis',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.ACTION_ANALYSIS.VIEW}>
            {withSuspense(<ActionAnalysisPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'lawyer-workplace',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.LEGAL_WORKPLACE.VIEW,
              PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
            ]}
            mode="any"
          >
            {withSuspense(<LawyerWorkplacePage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'sellers',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SELLERS.VIEW}>
            {withSuspense(<SellerManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'sellers/:id',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SELLERS.VIEW}>
            {withSuspense(<SellerDetailPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/tags',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.TAGS.VIEW}>
            {withSuspense(<TagsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/messaging-drafts',
        element: (
          <PermissionRoute requiredPermissions={DRAFT_PAGE_PERMISSIONS} mode="any">
            {withSuspense(<MessagingDraftsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/messaging-integrations',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.MESSAGING.MANAGE_INTEGRATIONS}>
            {withSuspense(<MessagingIntegrationsPage />)}
          </PermissionRoute>
        ),
      },
      {
        // UBKI integration admin page. TODO(ubki): gate behind a dedicated
        // `manage_integrations` permission once it exists; reusing the
        // messaging-integrations permission (admins hold it) for now.
        path: 'system-settings/integrations/ubki',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.MESSAGING.MANAGE_INTEGRATIONS}>
            {withSuspense(<UbkiIntegrationPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/contact-types',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CONTACT_TYPES.VIEW}>
            {withSuspense(<ContactTypesPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/contact-tags',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CONTACT_TAGS.MANAGE}>
            {withSuspense(<ContactTagsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/repayment-configuration',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.REPAYMENT_CONFIG.VIEW}>
            <Suspense fallback={<RepaymentConfigurationPageSkeleton />}>
              <RepaymentConfigurationPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/scoring-configuration',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW}>
            {withSuspense(<ScoringConfigurationPage />)}
          </PermissionRoute>
        ),
      },
      {
        // Scoring v3 operator work list (KAN-791). Two gates, both required:
        // the permission, AND the per-brand cutover switch — the ticket says
        // "hidden until sub-task 8 sign-off", and hiding only the nav entry left
        // the URL reachable during the shadow run.
        //
        // The permission is VIEW_PRIORITY_SCORES, not SCORING_CONFIG.VIEW: this
        // is the operators' own work queue, and gating it on the config-read
        // right would have 403'd every operator (only Admin/Supervisor hold it).
        path: 'operator-work-list',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW_PRIORITY_SCORES}>
            <V3CutoverRoute>{withSuspense(<OperatorWorkListPage />)}</V3CutoverRoute>
          </PermissionRoute>
        ),
      },
      {
        // Scoring v3 tunables (KAN-792). Admin/Supervisor read, Admin edits.
        // NOT behind the cutover switch: tau has to be re-picked from the
        // shadow-run report, i.e. precisely while operators still cannot see v3.
        path: 'system-settings/scoring-v3-settings',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW}>
            {withSuspense(<ScoringV3SettingsPage />)}
          </PermissionRoute>
        ),
      },
      {
        // Scoring v3 shadow-run report (KAN-794). NOT behind the cutover switch —
        // it exists to be read while operators still cannot see v3.
        path: 'system-settings/scoring-v3-monitoring',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW}>
            {withSuspense(<ScoringV3MonitoringPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/scoring-configuration/history',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SCORING_CONFIG.VIEW_HISTORY}>
            {withSuspense(<ConfigurationHistoryPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/sms-templates',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<SmsTemplatesPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/rr-notifications',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<RRNotificationsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/rr-periodicity',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<RRPeriodicityPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/target-actions',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<TAManagementPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/interaction-log',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.MANAGE_SETTINGS}>
            {withSuspense(<InteractionLogPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'system-settings/document-generation',
        element: (
          <PermissionRoute
            requiredPermissions={[
              PERMISSIONS.DOCUMENT_GENERATION.VIEW_JOURNAL,
              PERMISSIONS.DOCUMENT_GENERATION.VIEW_TEMPLATES,
              PERMISSIONS.DOCUMENT_GENERATION.CREATE_EDIT_TEMPLATES,
              PERMISSIONS.DOCUMENT_GENERATION.DELETE_TEMPLATES,
            ]}
            mode="any"
          >
            {withSuspense(<DocumentGenerationPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-operator-assignment',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.EDIT}>
            <Suspense fallback={<BulkOperatorAssignmentPageSkeleton />}>
              <BulkOperatorAssignmentPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-tag-assignment',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.ASSIGN_TAGS}>
            <Suspense fallback={<BulkTagAssignmentPageSkeleton />}>
              <BulkTagAssignmentPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-contact-tag-assignment',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CONTACT_TAGS.ASSIGN}>
            <Suspense fallback={<BulkContactTagAssignmentPageSkeleton />}>
              <BulkContactTagAssignmentPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-payment-import',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT_PAYMENTS}>
            <Suspense fallback={<BulkPaymentVerificationPageSkeleton />}>
              <BulkPaymentVerificationPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-writeoff-import',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.WRITEOFFS.BULK}>
            <Suspense fallback={<AppLoadingFallback />}>
              <BulkWriteoffImportPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-reversal-import',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.REVERSALS.BULK}>
            <Suspense fallback={<AppLoadingFallback />}>
              <BulkReversalImportPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-sale-notes-import',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SALE_NOTES.MANAGE}>
            <Suspense fallback={<BulkSaleNotesImportPageSkeleton />}>
              <BulkSaleNotesImportPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'import/bulk-document-import',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.DATA.IMPORT_DOCUMENTS}>
            <Suspense fallback={<BulkDocumentImportPageSkeleton />}>
              <BulkDocumentImportPage />
            </Suspense>
          </PermissionRoute>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS}>
            {withSuspense(<AuditLogsPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<ClientDetailPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/debt-summary',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<DebtSummaryPage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/activity',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<ActivityTimelinePage />)}
          </PermissionRoute>
        ),
      },
      {
        path: 'clients/:id/payment-history',
        element: (
          <PermissionRoute requiredPermission={PERMISSIONS.CLIENTS.VIEW}>
            {withSuspense(<PaymentHistoryPage />)}
          </PermissionRoute>
        ),
      },
    ],
  },
  // Legacy routes - redirect to new paths
  {
    path: '/dashboard/scoring-configuration',
    element: <Navigate to="/dashboard/system-settings/scoring-configuration" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/dashboard/scoring-configuration/history',
    element: <Navigate to="/dashboard/system-settings/scoring-configuration/history" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/dashboard/sms-templates',
    element: <Navigate to="/dashboard/system-settings/sms-templates" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RouteErrorElement />,
  },
])
