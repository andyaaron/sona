import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/user-management/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/user-management/"!</div>
}
