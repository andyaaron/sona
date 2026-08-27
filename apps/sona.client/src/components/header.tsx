import { useContext } from "react";
import { Link } from "@tanstack/react-router";
import {UserContext} from "@/hooks/useUser.tsx";
import { CircleUserRound } from "lucide-react";

function Header() {
  
  const user = useContext(UserContext);
  console.log("user", user);
  return (
    <header
      className={"p-4 flex justify-between items-center border-b border-gray-200"}
    >
      <nav className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">Sona Admin</span>
          <Link
              to="/"
              className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-medium [&.active]:text-gray-900"
          >
              Dashboard
          </Link>
          <Link
              to="/patients"
              className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-medium [&.active]:text-gray-900"
          >
              Patients
          </Link>
          <Link
              to="/providers/manage"
              className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-medium [&.active]:text-gray-900"
          >
              Providers
          </Link>
                  <Link
              to="/user-management"
              className="text-sm text-gray-600 hover:text-gray-900 [&.active]:font-medium [&.active]:text-gray-900"
          >
              User Management
          </Link>
        
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