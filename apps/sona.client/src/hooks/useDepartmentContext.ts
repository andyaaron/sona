import { useDepartmentContextStore } from '@/stores/department-context'
import { useUser } from '@/hooks/useUser'

/**
 * Effective department context for the signed-in user:
 * - staff with one department: always that department (no picker)
 * - staff with several: the persisted selection, if it is still one of theirs
 * - everyone else: none (org admins send without a department)
 */
export function useDepartmentContext() {
  const user = useUser()
  const selectedDepartmentId = useDepartmentContextStore((s) => s.selectedDepartmentId)
  const setSelectedDepartmentId = useDepartmentContextStore((s) => s.setSelectedDepartmentId)

  const departments = user.role === 'staff' ? user.departments : []
  const canChoose = departments.length > 1

  let effectiveDepartmentId: string | null = null
  if (departments.length === 1) {
    effectiveDepartmentId = departments[0].id
  } else if (canChoose && departments.some((d) => d.id === selectedDepartmentId)) {
    effectiveDepartmentId = selectedDepartmentId
  }

  return { departments, canChoose, effectiveDepartmentId, setSelectedDepartmentId }
}
