import { createFileRoute } from '@tanstack/react-router'
import Spinner from "@/components/spinner.tsx";
import AnimatedLogo from "@/components/animated-logo.tsx";

export const Route = createFileRoute('/spinner/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
    <div className="flex items-center gap-4">
      <Spinner size={"md"}/>
      <AnimatedLogo />
    </div>
    </div>
  )
}
