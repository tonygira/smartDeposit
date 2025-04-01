"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { decodePropertyIdFromCode } from "@/lib/utils"
import { useAccount, useReadContract } from "wagmi"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI } from "@/lib/contract"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export default function DepositCode() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { address } = useAccount()
  const { toast } = useToast()
  const [code, setCode] = useState("")
  const [propertyId, setPropertyId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<{title: string, message: string} | null>(null)

  useEffect(() => {
    // Récupérer le code et l'ID de propriété des paramètres d'URL
    const codeParam = searchParams.get("code")
    const propertyIdParam = searchParams.get("propertyId")
    
    if (codeParam) {
      setCode(codeParam)
    }
    
    if (propertyIdParam) {
      setPropertyId(parseInt(propertyIdParam))
    }
  }, [searchParams]);

  // Effacer l'erreur quand l'utilisateur modifie le code
  useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [code]);

  // Vérifier si un dépôt existe pour cette propriété
  const { data: depositId, isLoading: isDepositLoading, refetch: refetchDepositId } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositIdFromProperty",
    args: propertyId ? [BigInt(propertyId)] : undefined,
    enabled: propertyId !== null,
  });

  const handleReturnHome = () => {
    router.push("/deposits")
  }

  const handleSubmitCode = async () => {
    // Réinitialiser l'état d'erreur
    setError(null);
    
    // Vérification basique
    if (!code.trim()) {
      const errorMsg = {title: "Erreur", message: "Veuillez entrer un code caution"};
      setError(errorMsg);
      toast({
        title: errorMsg.title,
        description: errorMsg.message,
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setIsValidating(true)

    // Format attendu: XXXX-XXXX
    const codeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/
    
    if (!codeRegex.test(code)) {
      const errorMsg = {title: "Format invalide", message: "Le code devrait être au format XXXX-XXXX"};
      setError(errorMsg);
      toast({
        title: errorMsg.title,
        description: errorMsg.message,
        variant: "destructive",
      })
      setIsSubmitting(false)
      setIsValidating(false)
      return
    }

    try {
      // Si on n'a pas d'ID de propriété, l'extraire du code
      if (!propertyId) {
        const extractedPropertyId = decodePropertyIdFromCode(code);
        
        if (extractedPropertyId === null) {
          const errorMsg = {title: "Code invalide", message: "Le code caution n'est pas reconnu"};
          setError(errorMsg);
          toast({
            title: errorMsg.title,
            description: errorMsg.message,
            variant: "destructive",
          })
          setIsSubmitting(false)
          setIsValidating(false)
          return
        }
        
        // Mettre à jour l'ID de propriété pour déclencher useReadContract
        setPropertyId(extractedPropertyId);
        
        // Attendre un court instant pour que le hook se déclenche
        setTimeout(async () => {
          try {
            // Force refresh pour obtenir les dernières données
            const result = await refetchDepositId();
            
            if (result.data === undefined || result.data === 0n) {
              const errorMsg = {title: "Caution inexistante", message: "Aucune caution n'a été créée pour ce bien"};
              setError(errorMsg);
              toast({
                title: errorMsg.title,
                description: errorMsg.message,
                variant: "destructive",
              });
              setIsSubmitting(false);
              setIsValidating(false);
            } else {
              proceedWithValidCode(extractedPropertyId);
            }
          } catch (error) {
            console.error("Erreur lors de la vérification du dépôt:", error);
            const errorMsg = {title: "Erreur de vérification", message: "Impossible de vérifier le code caution. Veuillez réessayer."};
            setError(errorMsg);
            toast({
              title: errorMsg.title,
              description: errorMsg.message,
              variant: "destructive",
            });
            setIsSubmitting(false);
            setIsValidating(false);
          }
        }, 1500);
        
        return;
      }
      
      // Si on a déjà l'ID de propriété (des paramètres URL), vérifier directement le dépôt
      if (depositId === undefined) {
        if (isDepositLoading) {
          // Attendre que les données soient chargées
          setTimeout(() => {
            if (isDepositLoading) {
              const errorMsg = {title: "Délai dépassé", message: "La vérification du code prend trop de temps. Veuillez réessayer."};
              setError(errorMsg);
              toast({
                title: errorMsg.title,
                description: errorMsg.message,
                variant: "destructive",
              });
              setIsSubmitting(false);
              setIsValidating(false);
              return;
            }
            handleSubmitCode();
          }, 3000);
          return;
        }
        
        const errorMsg = {title: "Erreur de vérification", message: "Impossible de vérifier la caution. Veuillez réessayer."};
        setError(errorMsg);
        toast({
          title: errorMsg.title,
          description: errorMsg.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        setIsValidating(false);
        return;
      }
      
      if (depositId === 0n) {
        const errorMsg = {title: "Caution inexistante", message: "Aucune caution n'a été créée pour ce bien"};
        setError(errorMsg);
        toast({
          title: errorMsg.title,
          description: errorMsg.message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        setIsValidating(false);
        return;
      }
      
      // Si on arrive ici, le dépôt existe, donc on peut procéder
      proceedWithValidCode(propertyId);
      
    } catch (error) {
      console.error("Erreur lors de la validation du code:", error);
      const errorMsg = {title: "Erreur", message: "Ce code caution n'est pas valide ou a expiré"};
      setError(errorMsg);
      toast({
        title: errorMsg.title,
        description: errorMsg.message,
        variant: "destructive",
      })
      setIsSubmitting(false)
      setIsValidating(false)
    }
  }
  
  // Fonction pour continuer après validation du code
  const proceedWithValidCode = (validPropertyId: number) => {
    // Enregistrer le code validé dans le localStorage
    localStorage.setItem(`property_${validPropertyId}_validated_code`, code);
    
    // Délai artificiel pour un meilleur retour utilisateur
    toast({
      title: "Code validé",
      description: "Redirection vers la page de versement de la caution...",
    });
    
    // Rediriger vers la page de versement de la caution avec l'ID validé
    setTimeout(() => {
      router.push(`/deposits/${validPropertyId}`);
      setIsSubmitting(false);
      setIsValidating(false);
    }, 800);
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
              {error && (
                <Alert variant="destructive" className="border-red-500 bg-red-50 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{error.title}</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="code">Code caution</Label>
                <Input 
                  id="code" 
                  placeholder="XXXX-XXXX" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className={`text-center tracking-wider text-lg ${error ? 'border-red-500 focus:border-red-500' : ''}`}
                  maxLength={9}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                onClick={handleSubmitCode} 
                className="w-full"
                disabled={isSubmitting}
              >
                {isValidating ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validation en cours...
                  </div>
                ) : (
                  "Valider le code caution"
                )}
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