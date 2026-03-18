/**
 * Departments Feature
 * Export all department-related functionality
 */

export * from './api/departmentsApi'
export * from './hooks'
export * from './types'

// Re-export commonly used items
export { departmentsApi } from './api/departmentsApi'
export { useDepartments, useDepartment, departmentsKeys } from './hooks/useDepartments'
export {
  useCreateDepartment,
  useUpdateDepartment,
  useArchiveDepartment,
} from './hooks/useDepartmentMutations'
