import { Link } from "@tanstack/react-router";

function NavLink( { to, children } : { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="text-sm font-semibold text-gray-600 hover:text-emerald-600
      [&.active]:text-emerald-600 transition-colors duration-300 ease-in-out"
    >
      {children}
    </Link>
  )
}

export default NavLink;