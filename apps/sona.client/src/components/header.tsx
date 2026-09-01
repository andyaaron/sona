import { useContext } from "react";
import NavLink from "@/components/NavLink.tsx"
import {UserContext} from "@/hooks/useUser.tsx";
import { CircleUserRound } from "lucide-react";
import { Link } from "@tanstack/react-router";

function Header() {
  
  const user = useContext(UserContext);
  const isAdmin = user?.role === 'org_admin' || user?.role === 'system_admin';
  return (
    <header
      className={"p-4 flex justify-between items-center border-b border-gray-200"}
    >
      <nav className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Sona" className="h-7 w-auto" />
          </Link>
          <NavLink to="/">
              Dashboard
          </NavLink>
          <NavLink to="/patients">
              Patients
          </NavLink>
          <NavLink to="/providers/manage">
              Providers
          </NavLink>
          {isAdmin && (
              <NavLink to="/user-management">
                  User Management
              </NavLink>
          )}
        
      </nav>

      <div className={'flex flex-row items-center gap-3'}>
        {user ? (
          <div
            className={
              'relative flex flex-row gap-2 items-center text-text-color cursor-pointer'
            }

          >
            <CircleUserRound size={24} />
            <div className={'flex flex-col text-xs'}>
              <div>
                {user?.displayName}
              </div>
              <div>{user?.hca34Id}</div>
            </div>
          </div>
        ) : (
          <button
            // onClick={handleRedirect}
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