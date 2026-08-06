import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center gap-6 border-b border-gray-200 bg-white px-6 py-3">
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
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  )
}
