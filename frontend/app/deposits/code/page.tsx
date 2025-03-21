"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { decodePropertyIdFromCode } from "@/lib/utils"

export default function DepositCode() {
  const router = useRouter()
  const { toast } = useToast()
  const [code, setCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleReturnHome = () => {
    router.push("/deposits")
  }

  const handleSubmitCode = () => {
    // Vérification basique
    if (!code.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un code caution",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    // Format attendu: XXXX-XXXX
    const codeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
    
    if (!codeRegex.test(code)) {
      toast({
        title: "Format invalide",
        description: "Le code devrait être au format XXXX-XXXX",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Extraire l'ID de propriété du code
      const propertyId = decodePropertyIdFromCode(code)
      
      if (propertyId === null) {
        toast({
          title: "Code invalide",
          description: "Le code caution n'est pas reconnu",
          variant: "destructive",
        })
        setIsSubmitting(false)
        return
      }
      
      // Délai artificiel pour un meilleur retour utilisateur
      setTimeout(() => {
        toast({
          title: "Code validé",
          description: "Redirection vers la page de caution...",
        })
        
        // Rediriger vers la page de propriété avec l'ID extrait
        router.push(`/properties/${propertyId}`)
        setIsSubmitting(false)
      }, 800)
      
    } catch (error) {
      console.error("Erreur lors de la validation du code:", error)
      toast({
        title: "Erreur",
        description: "Ce code caution n'est pas valide ou a expiré",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <Button 
          variant="outline" 
          onClick={handleReturnHome} 
          className="mb-8 flex items-center"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retourner à l'accueil
        </Button>

        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Entrez votre code caution</CardTitle>
              <CardDescription>
                Le code caution doit vous être fourni par votre propriétaire
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code caution</Label>
                <Input 
                  id="code" 
                  placeholder="XXXX-XXXX" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center tracking-wider text-lg"
                  maxLength={9}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                onClick={handleSubmitCode} 
                className="w-full"
                style={{ backgroundColor: "#7759F9" }}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Validation en cours..." : "Valider le code caution"}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleReturnHome} 
                className="w-full"
              >
                Retourner à l'accueil
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  )
} 