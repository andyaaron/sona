import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/user-management/')({
  component: RouteComponent,
})

// @TODO: Lock behind user access level
function RouteComponent() {
  return <div>Hello "/user-management/"!</div>
}
