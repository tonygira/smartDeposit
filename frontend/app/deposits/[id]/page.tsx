"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getDepositStatusText, DepositStatus, getPropertyStatusText } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react"

export default function DepositDetails() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [deposit, setDeposit] = useState<any>(null)
  const [property, setProperty] = useState<any>(null)
  const [isLandlord, setIsLandlord] = useState(false)
  const [isTenant, setIsTenant] = useState(false)

  const depositId = Number(params.id)

  // Fetch deposit details
  const { data: depositData, isLoading: isDepositLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositDetails",
    args: [BigInt(depositId)],
    enabled: isConnected && !!depositId,
  })

  const { data: propertyData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getPropertyDetails",
    args: [deposit?.propertyId ? BigInt(deposit.propertyId) : BigInt(0)],
    enabled: isConnected && !!deposit?.propertyId,
  })

  // Process deposit data
  useEffect(() => {
    if (depositData) {
      const [id, propertyId, tenant, amount, timestamp, status] = depositData as [
        bigint,
        bigint,
        string,
        bigint,
        bigint,
        number,
      ]

      const depositObj = {
        id: Number(id),
        propertyId: Number(propertyId),
        tenant,
        amount: formatEther(amount),
        timestamp: new Date(Number(timestamp) * 1000).toLocaleDateString(),
        timestampRaw: Number(timestamp),
        status: getDepositStatusText(status),
        statusCode: status,
      }

      setDeposit(depositObj)
      setIsTenant(address?.toLowerCase() === tenant.toLowerCase())

      // Fetch property details
      if (propertyId) {
        // fetchPropertyDetails(Number(propertyId))
      }
    }
  }, [depositData, address])

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

      const property = {
        id: Number(id),
        landlord,
        name,
        location,
        depositAmount: formatEther(depositAmount),
        status: getPropertyStatusText(status)
      }

      setProperty(property)
      setIsLandlord(address?.toLowerCase() === landlord.toLowerCase())
    }
  }, [propertyData, address])



  const getStatusColor = (statusCode: number) => {
    switch (statusCode) {
      case DepositStatus.PENDING:
        return "bg-yellow-100 text-yellow-800"
      case DepositStatus.ACTIVE:
        return "bg-blue-100 text-blue-800"
      case DepositStatus.DISPUTED:
        return "bg-red-100 text-red-800"
      case DepositStatus.RELEASED:
        return "bg-green-100 text-green-800"
      case DepositStatus.REFUNDED:
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Veuillez vous connecter</h1>
            <p className="text-gray-500 mb-6">Connectez-vous pour voir les détails de la caution</p>
          </div>
        </main>
      </div>
    )
  }

  if (isDepositLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Chargement des détails de la caution...</h1>
          </div>
        </main>
      </div>
    )
  }

  if (!deposit) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Caution introuvable</h1>
            <Button onClick={() => router.push("/deposits")}>Retour aux cautions</Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <Button variant="outline" onClick={() => router.push("/deposits")} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour aux cautions
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-2xl">Caution #{deposit.id}</CardTitle>
                <Badge variant="outline" className={getStatusColor(deposit.statusCode)}>
                  {deposit.status}
                </Badge>
              </div>
              <CardDescription className="text-base">
                Identifiant du bien: {deposit.propertyId}
                {property && ` - ${property.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Montant</p>
                  <p className="font-medium">{deposit.amount} ETH</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{deposit.timestamp}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Locataire</p>
                <p className="font-medium">
                  {deposit.tenant.slice(0, 6)}...{deposit.tenant.slice(-4)}
                </p>
              </div>

              {property && (
                <div>
                  <p className="text-sm text-gray-500">Propriétaire</p>
                  <p className="font-medium">
                    {property.landlord.slice(0, 6)}...{property.landlord.slice(-4)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Gérer votre caution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deposit.statusCode === DepositStatus.ACTIVE && isTenant && (
                <div>
                  <h3 className="font-medium mb-2">Actions du locataire</h3>
                  <Button
                    onClick={() => toast({
                      title: "Fonctionnalité non disponible",
                      description: "La demande de restitution n'est pas encore implémentée.",
                      variant: "destructive"
                    })}
                    variant="default"
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Demander la restitution
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">Fonctionnalité en cours de développement</p>
                </div>
              )}

              {(deposit.statusCode === DepositStatus.RELEASED || deposit.statusCode === DepositStatus.REFUNDED) && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-center">
                    Cette caution a été {deposit.status.toLowerCase()}. Aucune action supplémentaire n'est requise.
                  </p>
                </div>
              )}

              {!isTenant && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-center">Vous n'êtes pas autorisé à effectuer des actions sur cette caution.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

