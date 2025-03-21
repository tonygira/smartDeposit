import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Smart Deposit
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                  Une application décentralisée pour gérer les dépôts de garantie immobiliers sur la blockchain.
                </p>
              </div>
              <div className="space-x-4">
                <Link href="/deposits">
                  <Button style={{ backgroundColor: "#7759F9", borderColor: "#7759F9" }}>Je suis locataire</Button>
                </Link>
                <Link href="/dashboard">
                  <Button style={{ backgroundColor: "#7759F9", borderColor: "#7759F9" }}>Je suis propriétaire</Button>
                </Link>
                <Link href="/about">
                  <Button variant="outline">En savoir plus</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Pour les propriétaires</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Créez des biens, gérez les dépôts et résolvez les litiges en toute simplicité.
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Pour les locataires</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Effectuez des dépôts sécurisés, suivez vos fonds et demandez des remboursements en toute transparence.
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Sécurisé par la blockchain</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Utilisation de la technologie blockchain pour des transactions sécurisées, transparentes et sans confiance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">© 2023 Smart Deposit. Tous droits réservés.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Conditions d'utilisation
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Confidentialité
          </Link>
        </nav>
      </footer>
    </div>
  )
}

