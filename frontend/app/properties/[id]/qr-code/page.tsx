"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useAccount, useReadContract } from "wagmi"
import { QRCodeSVG } from "qrcode.react"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { Copy, ArrowLeft, QrCode, Loader2, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function PropertyQRCode() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [isLandlord, setIsLandlord] = useState(false)
  const [uniqueCode, setUniqueCode] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [copySuccess, setCopySuccess] = useState(false)
  const [depositAmount, setDepositAmount] = useState("0")
  const searchParams = useSearchParams()
  const presetAmount = searchParams.get('amount')

  const propertyId = Number(params.id)

  // Vérifier si une caution existe déjà pour cette propriété
  const { data: currentDepositId } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositIdFromProperty",
    args: [BigInt(propertyId)]
  })

  // Log pour déboguer
  useEffect(() => {
    console.log("[QR-Code] currentDepositId:", currentDepositId);
  }, [currentDepositId]);

  // Récupérer les détails de la caution si l'ID existe
  const { data: depositData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDeposit",
    args: [currentDepositId ? currentDepositId : BigInt(0)]
  });

  // Générer l'URL de base pour le QR code
  useEffect(() => {
    // fonctionne uniquement pour un déploiement de l'app web publique
    setBaseUrl("https://smart-deposit.vercel.app")
  }, [])

  // Récupérer le code de caution depuis le contrat
  useEffect(() => {
    if (propertyId && currentDepositId && Number(currentDepositId) > 0 && depositData) {
      const deposit = depositData as any;
      const depositCode = deposit.depositCode;
      
      if (depositCode) {
        setUniqueCode(depositCode);
        
        // Récupérer le montant de la caution depuis le contrat
        if (deposit.amount) {
          const amountInEth = Number(deposit.amount) / 1e18;
          setDepositAmount(amountInEth.toString());
        }
        return;
      }
    }

    // Si on ne trouve pas le code dans le contrat, essayer de le récupérer du localStorage
    const savedCode = localStorage.getItem(`property_${propertyId}_deposit_code`);
    if (savedCode) {
      setUniqueCode(savedCode);
    }
  }, [propertyId, currentDepositId, depositData]);

  // Fetch property details
  const { data: propertyData, isLoading: isPropertyLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getProperty",
    args: [BigInt(propertyId)]
  })

  // Process property data
  useEffect(() => {
    if (propertyData) {
      setProperty(propertyData)
      const userIsLandlord = address?.toLowerCase() === propertyData.landlord.toLowerCase();
      setIsLandlord(userIsLandlord);
      
      // Vérification de sécurité : seul le propriétaire peut accéder à cette page
      if (!userIsLandlord) {
        // Rediriger vers la page principale des cautions si l'utilisateur n'est pas le propriétaire
        router.push('/deposits');
      }
    }
  }, [propertyData, address, router])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(uniqueCode)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 3000) // Masquer le message après 3 secondes
  }

  const handleGoBack = () => {
    // Rediriger vers la page du bien
    router.push(`/properties/${propertyId}`)
  }

  // URL pour le QR code qui mène directement à la page de caution
  const qrCodeUrl = `${baseUrl}/deposits/code?code=${uniqueCode}&propertyId=${propertyId}`

  if (isPropertyLoading) {
    return (
      <div className="container py-10">
        <Header />
        <div className="flex justify-center items-center flex-col min-h-[60vh]">
          <p className="text-xl font-semibold mb-4">Chargement en cours</p>
          <div className="flex items-center">
            <Loader2 className="h-6 w-6 mr-2 animate-spin text-purple-600" />
            <p>Vérification des informations du bien...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="container py-10">
        <Header />
        <div className="flex justify-center items-center flex-col min-h-[60vh]">
          <p className="text-xl font-semibold mb-4">Accès non autorisé</p>
          <p className="mb-6">Seul le propriétaire peut accéder à la génération du QR code pour la caution.</p>
          <Button 
            variant="outline" 
            onClick={() => router.push('/deposits')}
            className="flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux cautions
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <Header />
      <div className="mb-8 mt-6">
        <Button variant="outline" onClick={handleGoBack} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <QrCode className="mr-2 h-6 w-6 text-purple-600" />
              QR Code pour {property.name}
            </CardTitle>
            <CardDescription>
              Voici le code de caution à transmettre au locataire
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="bg-white p-6 rounded-lg mb-6">
              <QRCodeSVG
                value={qrCodeUrl}
                size={250}
                bgColor={"#ffffff"}
                fgColor={"#7759F9"}
                level={"H"}
                includeMargin={true}
              />
            </div>

            <div className="w-full max-w-md bg-muted p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Code unique</h3>
                  <p className="text-xl font-bold tracking-wider">{uniqueCode}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={handleCopyCode}>
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
              {copySuccess && (
                <Alert className="mt-2 bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-sm">
                    Code copié dans le presse-papier !
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="w-full max-w-md mb-4">
              <h3 className="font-medium mb-2">Informations sur le bien</h3>
              <ul className="space-y-2">
                <li><strong>Nom:</strong> {property.name}</li>
                <li><strong>Emplacement:</strong> {property.location}</li>
                <li className="flex items-center justify-between">
                  <div>
                    <strong>Montant de la caution:</strong> {depositAmount} ETH
                  </div>
                </li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <div className="w-full text-center text-sm text-muted-foreground">
              <p>Le QR code dirige vers la page de validation du code. Il expirera après utilisation.</p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 