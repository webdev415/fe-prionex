import { PERMISSIONS } from '@/constants/permissions'
import { useHasAnyPermission } from '@/hooks/usePermissions'

/** Matches backend ``require_legal_kanban_access`` (view_legal_kanban | manage_settings). */
export function useCanAccessLegalKanban(): boolean {
  return useHasAnyPermission([
    PERMISSIONS.LEGAL_WORKPLACE.VIEW_KANBAN,
    PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
  ])
}

/** Matches backend ``require_legal_workplace_manage`` (manage_legal_workplace | manage_settings). */
export function useCanManageLegalWorkplaceSettings(): boolean {
  return useHasAnyPermission([
    PERMISSIONS.LEGAL_WORKPLACE.MANAGE,
    PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
  ])
}
