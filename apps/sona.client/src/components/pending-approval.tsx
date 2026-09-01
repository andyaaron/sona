/**
 * Shown instead of the app shell to authenticated-but-unprovisioned users
 * (role "unassigned"). An org admin assigns them from the pending queue in
 * User Management; the server blocks every data endpoint until then.
 */
export function PendingApproval({ displayName }: { displayName?: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <img src="/logo.svg" alt="Sona" className="mx-auto h-8 w-auto" />
        <h1 className="mt-6 text-xl font-semibold text-gray-900">Access pending approval</h1>
        <p className="mt-3 text-sm text-gray-600">
          {displayName ? `Hi ${displayName}, you're` : "You're"} signed in, but an administrator at
          your practice still needs to grant you access. You'll be able to use Sona as soon as
          they do.
        </p>
      </div>
    </div>
  )
}
