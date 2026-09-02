import { createFileRoute } from '@tanstack/react-router'
import Spinner from "@/components/spinner.tsx";
import AnimatedLogo from "@/components/animated-logo.tsx";

export const Route = createFileRoute('/spinner/')({
  component: RouteComponent,
})

export function RouteComponent() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Spinner size={"md"}/>
        <AnimatedLogo className="h-7" />
        <img src="/logo.svg" alt="Sona" className="h-7 w-auto" />
      </div>
      <div className="flex items-center gap-4">
        <AnimatedLogo className="h-16" />
      </div>
    </div>
  )
}
