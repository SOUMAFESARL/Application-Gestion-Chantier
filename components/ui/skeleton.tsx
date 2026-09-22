import { cn } from "@/lib/utils"

/**
 * Primitive `skeleton` de shadcn, posée par `npx shadcn@latest add skeleton`.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
