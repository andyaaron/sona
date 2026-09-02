import { Link } from "@tanstack/react-router";

function NavLink({ to, children, testId }: { to: string; children: React.ReactNode; testId?: string }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="text-sm font-semibold text-gray-600 hover:text-emerald-600
      [&.active]:text-emerald-600 transition-colors duration-300 ease-in-out"
    >
      {children}
    </Link>
  )
}

export default NavLink;