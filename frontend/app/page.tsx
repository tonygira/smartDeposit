import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown } from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="w-full py-8 md:py-12 lg:py-16">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tighter sm:text-3xl md:text-4xl lg:text-5xl/none" style={{ color: "#7759F9" }}>
                  Gérez vos cautions locatives
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-500 md:text-lg dark:text-gray-400">
                  Sécurisez vos dépôts de location avec une restitution de fonds automatisée et transparente.
                </p>
              </div>
              <div className="space-x-4">
                <Link href="/deposits">
                  <Button style={{ backgroundColor: "#7759F9", borderColor: "#7759F9" }}>Je suis locataire</Button>
                </Link>
                <Link href="/dashboard">
                  <Button style={{ backgroundColor: "#7759F9", borderColor: "#7759F9" }}>Je suis propriétaire</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        
        <section className="w-full py-8 md:py-12 bg-gray-50 dark:bg-gray-800">
          <div className="container px-4 md:px-6 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">Les avantages</h2>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {/* Card 1 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden flex flex-col items-center">
                <div className="w-full flex items-center justify-center p-3" style={{ minHeight: "170px" }}>
                  <Image 
                    src="/1.png" 
                    alt="Sécurité" 
                    width={205}
                    height={287}
                    className="w-[205px] h-[287px] object-cover" 
                  />
                </div>
                <div className="p-3 text-center">
                  <h3 className="font-semibold text-base mb-1">Sécurité maximale</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">La caution est sécurisée par un smart contract.</p>
                </div>
              </div>
              
              {/* Card 2 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden flex flex-col items-center">
                <div className="w-full flex items-center justify-center p-3" style={{ minHeight: "170px" }}>
                  <Image 
                    src="/2.png" 
                    alt="Automatisation" 
                    width={120} 
                    height={100}
                    className="w-full h-auto object-contain" 
                  />
                </div>
                <div className="p-3 text-center">
                  <h3 className="font-semibold text-base mb-1">Automatisation totale</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Que vous soyez locataire ou propriétaire, vous n'avez rien à gérer. Le smart contract reçoit et restitue automatiquement la caution.
                  </p>
                </div>
              </div>
              
              {/* Card 3 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden flex flex-col items-center">
                <div className="w-full flex items-center justify-center p-3" style={{ minHeight: "170px" }}>
                  <Image 
                    src="/3.png" 
                    alt="Rendement" 
                    width={120} 
                    height={100}
                    className="w-full h-auto object-contain" 
                  />
                </div>
                <div className="p-3 text-center">
                  <h3 className="font-semibold text-base mb-1">Un rendement garanti</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    La caution est automatiquement placée dans un protocole sécurisé et décentralisé pendant toute la durée de vie du bail.
                  </p>
                </div>
              </div>
              
              {/* Card 4 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md overflow-hidden flex flex-col items-center">
                <div className="w-full flex items-center justify-center p-3" style={{ minHeight: "170px" }}>
                  <Image 
                    src="/4.png" 
                    alt="Service juste" 
                    width={120} 
                    height={100}
                    className="w-full h-auto object-contain" 
                  />
                </div>
                <div className="p-3 text-center">
                  <h3 className="font-semibold text-base mb-1">Un service juste</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    A la fois pour les propriétaires et pour les locataires.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-8 md:py-12 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">Comment ça marche ?</h2>
            
            <div className="space-y-2 flex flex-col items-center">
              {/* Étape 1 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 w-full">
                <div className="flex items-center">
                  <div className="bg-purple-100 rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0" style={{ backgroundColor: 'rgba(119, 89, 249, 0.15)' }}>
                    <span className="font-semibold text-sm" style={{ color: "#7759F9" }}>1</span>
                  </div>
                  <p className="text-base">Le propriétaire crée son bien.</p>
                </div>
              </div>
              
              <ChevronDown className="h-5 w-5 text-gray-400 my-1" />
              
              {/* Étape 2 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 w-full">
                <div className="flex items-center">
                  <div className="bg-purple-100 rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0" style={{ backgroundColor: 'rgba(119, 89, 249, 0.15)' }}>
                    <span className="font-semibold text-sm" style={{ color: "#7759F9" }}>2</span>
                  </div>
                  <p className="text-base">Il ajoute les documents nécessaires et crée une caution. Il obtient un QR code qu'il transmet au locataire.</p>
                </div>
              </div>
              
              <ChevronDown className="h-5 w-5 text-gray-400 my-1" />
              
              {/* Étape 3 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 w-full">
                <div className="flex items-center">
                  <div className="bg-purple-100 rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0" style={{ backgroundColor: 'rgba(119, 89, 249, 0.15)' }}>
                    <span className="font-semibold text-sm" style={{ color: "#7759F9" }}>3</span>
                  </div>
                  <p className="text-base">Le locataire utilise ce QR code pour retrouver le bien, vérifie les documents et procède au versement.</p>
                </div>
              </div>
              
              <ChevronDown className="h-5 w-5 text-gray-400 my-1" />
              
              {/* Étape 4 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 w-full">
                <div className="flex items-center">
                  <div className="bg-purple-100 rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0" style={{ backgroundColor: 'rgba(119, 89, 249, 0.15)' }}>
                    <span className="font-semibold text-sm" style={{ color: "#7759F9" }}>4</span>
                  </div>
                  <p className="text-base">La caution est verrouillée instantanément dans le contrat intelligent.</p>
                </div>
              </div>
              
              <ChevronDown className="h-5 w-5 text-gray-400 my-1" />
              
              {/* Étape 5 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 w-full">
                <div className="flex items-center">
                  <div className="bg-purple-100 rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0" style={{ backgroundColor: 'rgba(119, 89, 249, 0.15)' }}>
                    <span className="font-semibold text-sm" style={{ color: "#7759F9" }}>5</span>
                  </div>
                  <p className="text-base">Lors de la fin de bail, la restitution est déclenchée.</p>
                </div>
              </div>
              
              <ChevronDown className="h-5 w-5 text-gray-400 my-1" />
              
              {/* Étape 6 */}
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 w-full">
                <div className="flex items-center">
                  <div className="bg-purple-100 rounded-full h-8 w-8 flex items-center justify-center mr-3 flex-shrink-0" style={{ backgroundColor: 'rgba(119, 89, 249, 0.15)' }}>
                    <span className="font-semibold text-sm" style={{ color: "#7759F9" }}>6</span>
                  </div>
                  <p className="text-base">Le locataire reçoit instantanément sa caution dans son portefeuille.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <section className="w-full py-8 md:py-12 bg-white dark:bg-gray-900">
          <div className="container px-4 md:px-6 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-6">Témoignages</h2>
            
            <div className="grid gap-6 md:grid-cols-3">
              {/* Témoignage 1 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-bold mb-3">"Fini les disputes pour récupérer ma caution !"</h3>
                <div className="flex items-center">
                  <div className="mr-3 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 h-10 w-10">
                    <Image 
                      src="/avatar1.png" 
                      alt="Avatar Thomas" 
                      width={40} 
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Thomas Martin</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">Un service qui m'a permis de récupérer ma caution en quelques secondes, sans conflit.</p>
                  </div>
                </div>
              </div>
              
              {/* Témoignage 2 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-bold mb-3">"Enfin un système transparent et efficace !"</h3>
                <div className="flex items-center">
                  <div className="mr-3 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 h-10 w-10">
                    <Image 
                      src="/avatar2.png" 
                      alt="Avatar Sophie" 
                      width={40} 
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Sophie Dubois</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">En tant que propriétaire, je n'ai plus à gérer les cautions. Smart Deposit s'occupe de tout.</p>
                  </div>
                </div>
              </div>
              
              {/* Témoignage 3 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-5">
                <h3 className="text-lg font-bold mb-3">"La sécurité avant tout !"</h3>
                <div className="flex items-center">
                  <div className="mr-3 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 h-10 w-10">
                    <Image 
                      src="/avatar3.png" 
                      alt="Avatar Alexandre" 
                      width={40} 
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Alexandre Petit</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">Je dormais mal en sachant que ma caution était entre les mains du propriétaire. Maintenant, tout est sécurisé.</p>
                  </div>
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

