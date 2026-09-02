import { useContext } from "react";
import NavLink from "@/components/NavLink.tsx"
import {UserContext} from "@/hooks/useUser.tsx";
import { useDepartmentContextStore } from "@/stores/department-context";
import { CircleUserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { userQueryOptions } from "@/features/user/api/getUser";
import AnimatedLogo from "@/components/animated-logo.tsx";

function Header() {
  const user = useContext(UserContext);
  const { isPending } = useQuery(userQueryOptions);
  const isSystemAdmin = user?.role === 'system_admin';
  const isAdmin = user?.role === 'org_admin' || isSystemAdmin;
  // Multi-department staff pick the department they're acting in; it rides
  // along on notification sends as MessageOut.DepartmentId (opaque id).
  const departments = user?.role === 'staff' ? user.departments : [];
  const canChooseDepartment = departments.length > 1;
  const selectedDepartmentId = useDepartmentContextStore((s) => s.selectedDepartmentId);
  const setSelectedDepartmentId = useDepartmentContextStore((s) => s.setSelectedDepartmentId);
  return (
    <header
      data-testid="header"
      className={"p-4 flex justify-between items-center border-b border-gray-200"}
    >
      <nav className="flex items-center gap-6">
          <Link to="/" data-testid="header-logo" className="flex items-center gap-2">
            {isPending ? (
              <AnimatedLogo className="h-7" />
            ) : (
              <img src="/logo.svg" alt="Sona" className="h-7 w-auto" />
            )}
          </Link>
          <NavLink to="/" testId="header-nav-dashboard">
              Dashboard
          </NavLink>
          <NavLink to="/patients" testId="header-nav-patients">
              Patients
          </NavLink>
          {isAdmin && (
              <NavLink to="/providers/manage" testId="header-nav-providers">
                  Providers
              </NavLink>
          )}
          {isAdmin && (
              <NavLink to="/user-management" testId="header-nav-user-management">
                  User Management
              </NavLink>
          )}
          {isAdmin && (
              <NavLink to="/organization" testId="header-nav-organization">
                  Organization
              </NavLink>
          )}
          {isSystemAdmin && (
              <NavLink to="/organizations" testId="header-nav-organizations">
                  Organizations
              </NavLink>
          )}

      </nav>

      <div className={'flex flex-row items-center gap-3'}>
        {canChooseDepartment && (
          <label className="text-xs text-gray-600">
            Department{' '}
            <select
              data-testid="header-department-select"
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm"
              value={departments.some((d) => d.id === selectedDepartmentId) ? selectedDepartmentId ?? '' : ''}
              onChange={(e) => setSelectedDepartmentId(e.target.value || null)}
            >
              <option value="">Choose…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {user ? (
          <div
            data-testid="header-user"
            className={
              'relative flex flex-row gap-2 items-center text-text-color cursor-pointer'
            }
          >
            <CircleUserRound size={24} />
            <div className={'flex flex-col text-xs'}>
              <div data-testid="header-user-name">{user.displayName}</div>
              <div>
                <span data-testid="header-user-id">{user.hca34Id}</span>
                {user.organizationName ? (
                  <span data-testid="header-org-name">{` · ${user.organizationName}`}</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <button
            data-testid="header-authenticate"
            className="p-2 rounded text-white bg-btn-active-bg cursor-pointer"
          >
            Authenticate
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
