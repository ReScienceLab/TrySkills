import type * as React from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function PageShell({
  className,
  children,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      className={cn("min-h-screen bg-background text-foreground", className)}
      {...props}
    >
      {children}
    </main>
  )
}

export function PageContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} {...props}>
      {children}
    </div>
  )
}

export function Surface({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg bg-card shadow-[var(--shadow-card)]", className)}
      {...props}
    >
      {children}
    </div>
  )
}

const statusStyles = {
  neutral: "bg-[#111111] text-[#a3a3a3] shadow-[var(--shadow-border)]",
  blue: "bg-[rgba(0,112,243,0.16)] text-[#58a6ff]",
  develop: "bg-[rgba(10,114,239,0.16)] text-[#58a6ff]",
  preview: "bg-[rgba(222,29,141,0.16)] text-[#ff7ac8]",
  ship: "bg-[rgba(255,91,79,0.16)] text-[#ffb4ac]",
  danger: "bg-[rgba(255,91,79,0.14)] text-[#ffb4ac]",
} as const

export function StatusBadge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<typeof Badge> & {
  tone?: keyof typeof statusStyles
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(statusStyles[tone], className)}
      {...props}
    />
  )
}

export function Eyebrow({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-mono text-xs font-medium uppercase leading-none text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}
