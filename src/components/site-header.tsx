"use client"

import Image from "next/image"
import Link from "next/link"
import { SignInButton, UserButton, Show } from "@clerk/nextjs"
import { Github } from "@lobehub/icons"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const links = [
  { href: "https://skills.sh", label: "Skills" },
  { href: "https://agentskills.io/specification", label: "Docs" },
]

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="TrySkills.sh home">
      <Image src="/logo.svg" alt="" width={22} height={22} />
      <span className="text-sm font-semibold text-foreground">TrySkills.sh</span>
    </Link>
  )
}

function ExternalLinks({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={compact
            ? "rounded-[6px] px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            : "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {link.label}
        </a>
      ))}
      <a
        href="https://github.com/ReScienceLab/TrySkills"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository"
        className={compact
          ? "inline-flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          : "inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        }
      >
        <Github size={16} />
        <span>GitHub</span>
      </a>
    </>
  )
}

function AccountLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button size={mobile ? "default" : "sm"} className={mobile ? "w-full" : ""}>
            Sign in
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Button asChild variant="ghost" size={mobile ? "default" : "sm"} className={mobile ? "justify-start" : ""}>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button asChild variant="ghost" size={mobile ? "default" : "sm"} className={mobile ? "justify-start" : ""}>
          <Link href="/settings">Settings</Link>
        </Button>
        {!mobile && (
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-7 w-7",
              },
            }}
          />
        )}
      </Show>
    </>
  )
}

export function SiteHeader({ breadcrumb }: { breadcrumb?: string }) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 shadow-[var(--shadow-border)] supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <BrandMark />
          {breadcrumb && (
            <span className="hidden max-w-[360px] truncate font-mono text-xs font-medium text-muted-foreground md:block">
              {breadcrumb}
            </span>
          )}
        </div>

        <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex">
          <ExternalLinks />
          <div className="h-5 w-px bg-border" />
          <AccountLinks />
        </nav>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[min(320px,calc(100vw-32px))] border-none shadow-[var(--shadow-card)]">
              <SheetHeader>
                <SheetTitle>
                  <BrandMark />
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                <ExternalLinks compact />
              </div>
              <div className="mx-4 h-px bg-border" />
              <div className="flex flex-col gap-2 px-4">
                <AccountLinks mobile />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
