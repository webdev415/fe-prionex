import {
  LawyerWorkplaceLayoutContext,
  useLawyerWorkplaceLayoutMeasure,
} from './lawyerWorkplaceLayout'

export function LawyerWorkplaceLayoutProvider({ children }: { children: React.ReactNode }) {
  const layout = useLawyerWorkplaceLayoutMeasure()

  return (
    <LawyerWorkplaceLayoutContext.Provider value={layout}>
      {children}
    </LawyerWorkplaceLayoutContext.Provider>
  )
}
