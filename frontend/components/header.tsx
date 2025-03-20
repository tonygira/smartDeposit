"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CustomConnectButton } from "@/components/ui/connect-button"
import { cn } from "@/lib/utils"

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold text-xl">Smart Deposit</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === "/" ? "text-primary" : "text-muted-foreground",
              )}
            >
              Accueil
            </Link>
            <Link
              href="/dashboard"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === "/dashboard" ? "text-primary" : "text-muted-foreground",
              )}
            >
              Propriétaire
            </Link>
            <Link
              href="/deposits"
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === "/deposits" ? "text-primary" : "text-muted-foreground",
              )}
            >
              Locataire
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <CustomConnectButton />
        </div>
      </div>
    </header>
  )
}

