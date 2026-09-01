import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Client-only UI state (rule 0.4): which of their departments a multi-department
 * staff user is currently acting in. The notify flow sends it as
 * MessageOut.DepartmentId (docs/tasks/08 §8e). Opaque id only — never a name.
 */
interface DepartmentContextState {
  selectedDepartmentId: string | null
  setSelectedDepartmentId: (id: string | null) => void
}

export const useDepartmentContextStore = create<DepartmentContextState>()(
  persist(
    (set) => ({
      selectedDepartmentId: null,
      setSelectedDepartmentId: (id) => set({ selectedDepartmentId: id }),
    }),
    { name: 'sona.department-context' },
  ),
)
