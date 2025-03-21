"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAccount, useReadContract } from "wagmi"
import { formatEther } from "viem"
import { QRCodeSVG } from "qrcode.react"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Copy, ArrowLeft, QrCode } from "lucide-react"
import { generateRandomCode } from "@/lib/utils"

export default function PropertyQRCode() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [isLandlord, setIsLandlord] = useState(false)
  const [uniqueCode, setUniqueCode] = useState("")
  const [baseUrl, setBaseUrl] = useState("")

  const propertyId = Number(params.id)

  // Générer l'URL de base pour le QR code
  useEffect(() => {
    // fonctionne uniquement pour un déploiement de l'app web publique
    setBaseUrl("https://smart-deposit.vercel.app")
  }, [])

  // Générer un code unique associé au bien
  useEffect(() => {
    if (propertyId) {
      // Générer un code aléatoire basé sur l'ID de la propriété
      const code = generateRandomCode(propertyId.toString())
      setUniqueCode(code)
    }
  }, [propertyId])

  // Fetch property details
  const { data: propertyData, isLoading: isPropertyLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getPropertyDetails",
    args: [BigInt(propertyId)],
    enabled: isConnected && !!propertyId,
  })

  // Process property data
  useEffect(() => {
    if (propertyData) {
      const [id, landlord, name, location, depositAmount, status] = propertyData as [
        bigint,
        string,
        string,
        string,
        bigint,
        number
      ]

      const propertyObj = {
        id: Number(id),
        landlord,
        name,
        location,
        depositAmount: formatEther(depositAmount),
        status: getPropertyStatusText(status)
      }

      setProperty(propertyObj)
      setIsLandlord(address?.toLowerCase() === landlord.toLowerCase())
    }
  }, [propertyData, address])

  const handleCopyCode = () => {
    navigator.clipboard.writeText(uniqueCode)
    toast({
      title: "Code copié !",
      description: "Le code unique a été copié dans le presse-papier.",
    })
  }

  const handleGoBack = () => {
    router.back()
  }

  // URL pour le QR code qui mène directement à la page de dépôt
  const qrCodeUrl = `${baseUrl}/deposits/${propertyId}?code=${uniqueCode}`

  if (isPropertyLoading) {
    return (
      <div className="container py-10">
        <Header />
        <div className="flex justify-center items-center min-h-[60vh]">
          <p>Chargement des informations du bien...</p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="container py-10">
        <Header />
        <div className="flex justify-center items-center min-h-[60vh]">
          <p>Bien non trouvé ou accès non autorisé.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <Header />
      <div className="mb-8">
        <Button variant="outline" onClick={handleGoBack} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au bien
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
              Transmettez ce QR code au locataire pour faciliter le dépôt de caution
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
            </div>
            
            <div className="w-full max-w-md mb-4">
              <h3 className="font-medium mb-2">Informations sur le bien</h3>
              <ul className="space-y-2">
                <li><strong>Nom:</strong> {property.name}</li>
                <li><strong>Emplacement:</strong> {property.location}</li>
                <li><strong>Montant de la caution:</strong> {property.depositAmount} ETH</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <div className="w-full text-center text-sm text-muted-foreground">
              <p>Le QR code dirige vers la page de dépôt de caution pour ce bien. Il expire après utilisation.</p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 