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
      functionName: "getProperty",
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
    contracts: ((propertyIds as bigint[]) || []).map((id, index) => {
      // Retrouver le depositId correspondant à cette propriété
      const depositId = depositIdsData && depositIdsData[index]?.status === "success" 
        ? depositIdsData[index].result
        : BigInt(0);
      
      return {
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI as any,
        functionName: "getDepositFiles",
        args: [depositId && Number(depositId) > 0 ? depositId : BigInt(0)],
      };
    }),
  })

  // Fetch deposit details for each property with a deposit
  const [depositDetails, setDepositDetails] = useState<Record<number, any>>({})

  // Définir les contrats pour les détails des dépôts
  const depositDetailsContracts = depositIdsData?.filter(
    (result) => result.status === "success" && result.result && Number(result.result) > 0
  ).map((result) => ({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI as any,
    functionName: "getDeposit",
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
          const deposit = result.result;
          details[Number(deposit.propertyId)] = {
            id: Number(deposit.id),
            propertyId: Number(deposit.propertyId),
            tenant: deposit.tenant,
            amount: formatEther(deposit.amount),
            finalAmount: formatEther(deposit.finalAmount),
            retainedAmount: formatEther(deposit.amount - deposit.finalAmount),
            creationDate: Number(deposit.creationDate),
            paymentDate: Number(deposit.paymentDate),
            refundDate: Number(deposit.refundDate),
            status: Number(deposit.status),
            statusText: getDepositStatusText(Number(deposit.status)),
            depositCode: deposit.depositCode
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
            const property = result.result;

            // Compter les fichiers pour cette propriété
            let filesCount = 0;
            if (propertiesFilesData[index]?.status === "success" && propertiesFilesData[index]?.result) {
              filesCount = (propertiesFilesData[index]?.result as any[]).length;
            }

            return {
              id: Number(property.id),
              landlord: property.landlord,
              name: property.name,
              location: property.location,
              status: getPropertyStatusText(property.status),
              statusCode: Number(property.status),
              filesCount
            };
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
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Remboursée</Badge>
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
                {landlordProperties
                  .sort((a, b) => {
                    // Tri simple par ID décroissant (supposant que les IDs plus élevés sont plus récents)
                    return b.id - a.id;
                  })
                  .map((property) => {
                    const deposit = depositDetails[property.id];
                    return (
                      <div key={property.id} className="flex mb-4">
                        {/* Card de la propriété */}
                        <div className={`border rounded-lg p-4 flex-grow ${deposit?.status === DepositStatus.DISPUTED ? 'bg-red-50' : ''}`}>
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Colonne gauche - Infos du bien */}
                            <div>
                              <h3 className="font-semibold text-lg">{property.name}</h3>
                              <p className="text-sm text-gray-500 mb-3">{property.location}</p>
                              
                              <p className="flex items-center text-sm font-medium mb-1 text-gray-700">
                                <Home className="h-4 w-4 mr-1 text-gray-600" />
                                Détails du bien
                              </p>
                              <div className="mt-1 ml-5 flex items-center text-sm">
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
                              </div>
                              <p className="flex items-center text-sm font-medium mb-1 text-gray-700 mt-3">
                                <FileText className="h-4 w-4 mr-1 text-gray-600" />
                                Documents
                              </p>
                              <div className="ml-5">
                                {property.filesCount > 0 ? (
                                  <Link href={`/properties/${property.id}`} className="flex items-center text-sm hover:underline">
                                    <File className="h-3.5 w-3.5 mr-1 text-blue-500" />
                                    <span className="text-blue-700">{property.filesCount} document{property.filesCount > 1 ? 's' : ''}</span>
                                  </Link>
                                ) : (
                                  <div className="flex items-center text-sm">
                                    <File className="h-3.5 w-3.5 mr-1 text-gray-400" />
                                    <span className="text-gray-500">Aucun document</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Colonne droite - Infos caution */}
                            <div>
                              <p className="flex items-center text-sm font-medium mb-1 text-gray-700">
                                <Wallet className="h-4 w-4 mr-1 text-gray-600" />
                                Caution associée
                              </p>
                              <div className="ml-5 mb-4">
                                {deposit ? (
                                  <div>
                                    <div className="flex items-center">
                                      {getDepositStatusBadge(deposit.status)}
                                    </div>
                                    <div className="flex items-center mt-1 text-sm">
                                      <Coins className="h-3.5 w-3.5 mr-1 text-gray-500" />
                                      <span>Montant: {deposit.amount} ETH</span>
                                    </div>
                                    {(deposit.status === DepositStatus.PARTIALLY_REFUNDED ||
                                      deposit.status === DepositStatus.RETAINED) && (
                                        <div className="flex items-center mt-1 text-sm">
                                          <Coins className="h-3.5 w-3.5 mr-1 text-gray-500" />
                                          <span>Montant conservé: {deposit.retainedAmount} ETH</span>
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <Ban className="h-4 w-4 mr-1 text-gray-400" />
                                    <span className="text-gray-500">Aucune</span>
                                  </div>
                                )}
                              </div>

                              {deposit && (
                                <div>
                                  <p className="flex items-center text-sm font-medium mb-1 text-gray-700">
                                    <Calendar className="h-4 w-4 mr-1 text-gray-600" />
                                    Dates des transactions
                                  </p>
                                  <div className="flex items-start ml-5 text-sm">
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
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bouton Actions en dehors de la carte */}
                        <div className="ml-4 flex-shrink-0">
                          <Link href={`/properties/${property.id}`}>
                            <Button variant="outline" size="sm">
                              Actions
                            </Button>
                          </Link>
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

