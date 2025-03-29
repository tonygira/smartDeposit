"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useReadContracts, useBalance } from "wagmi"
import { formatEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText, getDepositStatusText, DepositStatus } from "@/lib/contract"
import Link from "next/link"
import { Home, Key, AlertTriangle, CheckCircle, FileText, File, Calendar, Wallet, Ban, Coins } from "lucide-react"
import { useRouter } from "next/navigation"

const formatDate = (timestamp: number) => {
  if (!timestamp) return "Date inconnue";
  return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const [landlordProperties, setLandlordProperties] = useState<any[]>([])
  const router = useRouter()

  // Récupérer la balance du compte connecté
  const { data: balanceData } = useBalance({
    address: address,
  })

  // Get property IDs
  const { data: propertyIds, refetch: refetchPropertyIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getLandlordProperties",
    args: [address],
  })

  // Rafraîchir les données lorsque l'adresse change
  useEffect(() => {
    if (address) {
      // Rafraîchir la liste des propriétés
      refetchPropertyIds();
    }
  }, [address, refetchPropertyIds]);

  // Fetch property details
  const { data: propertiesData } = useReadContracts({
    contracts: ((propertyIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getPropertyDetails",
      args: [id],
    })),
  })

  // Fetch deposit IDs for each property
  const { data: depositIdsData } = useReadContracts({
    contracts: ((propertyIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getDepositIdFromProperty",
      args: [id],
    })),
  })

  // Fetch file counts for each property
  const { data: propertiesFilesData } = useReadContracts({
    contracts: ((propertyIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getPropertyFiles",
      args: [id],
    })),
  })

  // Fetch deposit details for each property with a deposit
  const [depositDetails, setDepositDetails] = useState<Record<number, any>>({})

  // Définir les contrats pour les détails des dépôts
  const depositDetailsContracts = depositIdsData?.filter(
    (result) => result.status === "success" && result.result && Number(result.result) > 0
  ).map((result) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI as any,
    functionName: "getDepositDetails",
    args: [result.result],
  })) || []

  // Hook pour récupérer les détails des dépôts
  const { data: depositDetailsData, refetch: refetchDepositDetails } = useReadContracts({
    contracts: depositDetailsContracts
  })

  // Traitement des détails des dépôts
  useEffect(() => {
    if (depositDetailsData && depositDetailsData.length > 0) {
      const details: Record<number, any> = {}
      depositDetailsData.forEach((result) => {
        if (result.status === "success" && result.result) {
          const [id, propertyId, tenant, amount, finalAmount, creationDate, paymentDate, refundDate, status, depositCode] = result.result as [
            bigint,
            bigint,
            string,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            number,
            string
          ]
          details[Number(propertyId)] = {
            id: Number(id),
            propertyId: Number(propertyId),
            tenant,
            amount: formatEther(amount),
            finalAmount: formatEther(finalAmount),
            retainedAmount: formatEther(amount - finalAmount),
            creationDate: Number(creationDate),
            paymentDate: Number(paymentDate),
            refundDate: Number(refundDate),
            status: Number(status),
            statusText: getDepositStatusText(Number(status)),
            depositCode
          }
        }
      })
      setDepositDetails(details)
    }
  }, [depositDetailsData])

  // Rafraîchir les détails des dépôts lorsque les IDs changent
  useEffect(() => {
    if (depositIdsData) {
      refetchDepositDetails()
    }
  }, [depositIdsData, refetchDepositDetails])

  // Process property data
  useEffect(() => {
    if (propertiesData && propertiesFilesData) {
      const properties = propertiesData
        .map((result, index) => {
          if (result.status === "success" && result.result) {
            const [id, landlord, name, location, depositAmount, status] = result.result as [
              bigint,
              string,
              string,
              string,
              bigint,
              number
            ]

            // Compter les fichiers pour cette propriété si disponibles
            let filesCount = 0
            if (propertiesFilesData[index]?.status === "success" && propertiesFilesData[index]?.result) {
              filesCount = (propertiesFilesData[index]?.result as any[]).length
            }

            return {
              id: Number(id),
              landlord,
              name,
              location,
              depositAmount: formatEther(depositAmount),
              status: getPropertyStatusText(status),
              statusCode: Number(status),
              filesCount
            }
          }
          return null
        })
        .filter(Boolean)

      setLandlordProperties(properties)
    }
    else {
      setLandlordProperties([])
    }
  }, [propertiesData, propertiesFilesData])

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Veuillez connecter votre wallet</h1>
            <p className="text-gray-500 mb-6">Connectez votre wallet pour accéder au tableau de bord</p>
          </div>
        </main>
      </div>
    )
  }

  const getDepositStatusBadge = (status: number) => {
    switch (status) {
      case DepositStatus.PENDING:
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">En attente</Badge>
      case DepositStatus.PAID:
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Payée</Badge>
      case DepositStatus.DISPUTED:
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">En litige</Badge>
      case DepositStatus.REFUNDED:
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Remboursée</Badge>
      case DepositStatus.PARTIALLY_REFUNDED:
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Partiellement remboursée</Badge>
      case DepositStatus.RETAINED:
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Conservée</Badge>
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Inconnue</Badge>
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Votre tableau de bord</h1>
          <div className="flex items-center text-sm text-gray-600">
            <Coins className="h-4 w-4 mr-2 text-gray-500" />
            Balance du compte : {balanceData ? `${parseFloat(balanceData.formatted).toFixed(4)} ${balanceData.symbol}` : '0 ETH'}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total des propriétés</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{landlordProperties.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Propriétés disponibles</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{landlordProperties.filter((p) => p.statusCode === 0).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Propriétés louées</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{landlordProperties.filter((p) => p.statusCode === 1).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Propriétés en litige</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{landlordProperties.filter((p) => p.statusCode === 2).length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between w-full items-center">
              <CardTitle>Vos biens</CardTitle>
              <Link href="/properties/create">
                <Button style={{ backgroundColor: "#7759F9", borderColor: "#7759F9" }}>Ajouter un bien</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {landlordProperties.length > 0 ? (
              <div className="space-y-4">
                {landlordProperties.map((property) => {
                  const deposit = depositDetails[property.id];
                  return (
                    <div
                      key={property.id}
                      className={`border rounded-lg p-4 ${deposit?.status === DepositStatus.DISPUTED ? 'bg-red-50' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-lg">{property.name}</h3>
                        <Link href={`/properties/${property.id}`}>
                          <Button variant="outline" size="sm">
                            Actions
                          </Button>
                        </Link>
                      </div>
                      <p className="text-sm text-gray-500">{property.location}</p>

                      <div className="grid md:grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="flex items-center text-sm font-medium mb-1 text-gray-700">
                            <Home className="h-4 w-4 mr-1 text-gray-600" />
                            Détails du bien
                          </p>
                          <p className="mt-1 ml-5 text-sm">
                            Caution: {property.depositAmount} ETH
                          </p>
                          <p className="mt-1 ml-5 flex items-center text-sm">
                            Statut:{" "}
                            <span
                              className={`ml-1 font-medium ${property.statusCode === 2
                                ? "text-yellow-500"
                                : property.statusCode === 1
                                  ? "text-green-500"
                                  : "text-blue-500"
                                }`}
                            >
                              {property.status}
                            </span>
                          </p>
                          <p className="mt-1 ml-5 flex items-center text-sm">
                            {property.filesCount > 0 ? (
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-1 text-green-500" />
                                <span className="text-green-700">{property.filesCount} document{property.filesCount > 1 ? 's' : ''} ajouté{property.filesCount > 1 ? 's' : ''}</span>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <File className="h-4 w-4 mr-1 text-gray-400" />
                                <span className="text-gray-500">Aucun document</span>
                              </div>
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="flex items-center text-sm font-medium mb-1 text-gray-700">
                            <Wallet className="h-4 w-4 mr-1 text-gray-600" />
                            État de la caution
                          </p>
                          {deposit ? (
                            <div className="ml-5">
                              <div className="flex items-center mt-1 text-sm">
                                {getDepositStatusBadge(deposit.status)}
                              </div>
                              {(deposit.status === DepositStatus.PARTIALLY_REFUNDED ||
                                deposit.status === DepositStatus.RETAINED) && (
                                  <div className="flex items-center mt-1.5 text-sm">
                                    <Coins className="h-3.5 w-3.5 mr-1 text-red-500" />
                                    <span>Montant conservé: {deposit.retainedAmount} ETH</span>
                                  </div>
                                )}
                              <div className="flex items-start mt-1.5 text-sm">
                                <Calendar className="h-3.5 w-3.5 mr-1 text-gray-500 mt-0.5" />
                                <div className="flex flex-col">
                                  <span className="text-xs text-gray-600">Création: {formatDate(deposit.creationDate)}</span>
                                  {deposit.status >= DepositStatus.PAID && deposit.paymentDate > 0 && (
                                    <span className="text-xs text-gray-600">Paiement: {formatDate(deposit.paymentDate)}</span>
                                  )}
                                  {(deposit.status === DepositStatus.REFUNDED ||
                                    deposit.status === DepositStatus.PARTIALLY_REFUNDED ||
                                    deposit.status === DepositStatus.RETAINED) &&
                                    deposit.refundDate > 0 && (
                                      <span className="text-xs text-gray-600">Remboursement: {formatDate(deposit.refundDate)}</span>
                                    )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center ml-5 mt-1 text-sm">
                              <Ban className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="text-gray-500">Caution non créée</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">Vous n'avez pas encore créé de bien.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

