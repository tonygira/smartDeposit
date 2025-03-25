import type React from "react"
import "@rainbow-me/rainbowkit/styles.css"
import { Providers } from "./providers"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Smart Deposit",
  description: "Une application décentralisée pour la gestion des cautions",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}



import './globals.css'