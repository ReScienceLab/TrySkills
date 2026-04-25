import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-white/[0.045] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)] before:absolute before:inset-y-0 before:left-0 before:w-1/2 before:bg-gradient-to-r before:from-transparent before:via-white/[0.10] before:to-transparent before:content-[''] before:animate-[shimmer_1.8s_ease-in-out_infinite]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
