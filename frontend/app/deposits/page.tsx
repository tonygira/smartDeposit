"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { formatEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getDepositStatusText, DepositStatus, getPropertyStatusText } from "@/lib/contract"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { QrCode, Wallet, Calendar, Home, MapPin, User, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Coins, CheckCircle, XCircle, Clock } from "lucide-react"

export default function Deposits() {
  const { address, isConnected } = useAccount()
  const [deposits, setDeposits] = useState<any[]>([])
  const [properties, setProperties] = useState<Record<number, any>>({})
  const [propertyIds, setPropertyIds] = useState<number[]>([])
  const router = useRouter()

  // Get deposit IDs
  const { data: depositIds, refetch: refetchDepositIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getTenantDeposits",
    args: [address],
  })

  // Rafraîchir les données lorsque l'adresse change
  useEffect(() => {
    if (address) {
      // Rafraîchir la liste des dépôts
      refetchDepositIds();
      // Réinitialiser les états
      setDeposits([]);
      setProperties({});
      setPropertyIds([]);
    }
  }, [address, refetchDepositIds]);

  // Fetch deposit details
  const { data: depositsData } = useReadContracts({
    contracts: ((depositIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getDepositDetails",
      args: [id],
    })),
  })

  // Process deposit data and extract property IDs
  useEffect(() => {
    if (depositsData) {
      const fetchedDeposits = depositsData
        .map((result, index) => {
          if (result.status === "success" && result.result) {
            const resultArray = result.result as any[];

            try {
              const [id, propertyId, tenant, amount, finalAmount, creationDate, paymentDate, refundDate, status, depositCode] = resultArray as [
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

              return {
                id: Number(id),
                propertyId: Number(propertyId),
                tenant,
                amount: formatEther(amount),
                finalAmount: formatEther(finalAmount),
                retainedAmount: formatEther(amount - finalAmount),
                creationDate: Number(creationDate),
                paymentDate: Number(paymentDate),
                refundDate: Number(refundDate),
                status: getDepositStatusText(Number(status)),
                statusCode: Number(status),
                depositCode
              }
            } catch (error) {
              console.error(`Erreur lors du traitement de la caution #${index}:`, error);
              console.error("Structure des données reçues:", resultArray);
              return null;
            }
          }
          return null
        })
        .filter(Boolean)

      setDeposits(fetchedDeposits)

      // Get unique property IDs to fetch property details
      const uniquePropertyIds = [...new Set(fetchedDeposits.filter(d => d !== null).map((d) => d.propertyId))]
      setPropertyIds(uniquePropertyIds)
    }
  }, [depositsData])

  // Fetch property details (separate from deposit processing)
  const { data: propertiesData } = useReadContracts({
    contracts: propertyIds.map((propertyId) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getPropertyDetails",
      args: [BigInt(propertyId)],
    })),
  });

  // Process property data
  useEffect(() => {
    if (propertiesData) {
      const processedProperties = propertiesData
        .map((result, index) => {
          if (result.status === "success" && result.result) {
            const [id, landlord, name, location, depositAmount, status] = result.result as [
              bigint,
              string,
              string,
              string,
              bigint,
              number,
            ];

            return {
              propertyId: propertyIds[index],
              data: {
                id: Number(id),
                landlord,
                name,
                location,
                depositAmount: formatEther(depositAmount),
                status: getPropertyStatusText(status),
              },
            };
          }
          return null;
        })
        .filter(Boolean)
        .reduce((acc, item) => {
          if (item) {
            acc[item.propertyId] = item.data;
          }
          return acc;
        }, {} as Record<number, any>);

      setProperties(processedProperties);
    }
  }, [propertiesData, propertyIds]);

  const getDepositStatusBadge = (statusCode: number) => {
    switch (statusCode) {
      case DepositStatus.PENDING:
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center">
            <Clock className="h-3.5 w-3.5 mr-1" />
            En attente
          </Badge>
        )
      case DepositStatus.PAID:
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center">
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Payée
          </Badge>
        )
      case DepositStatus.DISPUTED:
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            En litige
          </Badge>
        )
      case DepositStatus.REFUNDED:
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center">
            <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
            Remboursée
          </Badge>
        )
      case DepositStatus.PARTIALLY_REFUNDED:
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center">
            <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
            Partiellement remboursée
          </Badge>
        )
      case DepositStatus.RETAINED:
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center">
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Conservée
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            Inconnue
          </Badge>
        )
    }
  }

  const handleCodeButtonClick = () => {
    router.push('/deposits/code');
  }

  // Fonction pour formater une date
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Date inconnue";
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Veuillez vous connecter</h1>
            <p className="text-gray-500 mb-6">Connectez-vous pour voir vos cautions</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-3xl font-bold">Vos cautions</h1>
          <Button
            onClick={handleCodeButtonClick}
            variant="outline"
            className="flex items-center mt-4 md:mt-0"
            style={{ backgroundColor: "#7759F9", color: "white" }}
          >
            <QrCode className="mr-2 h-5 w-5" />
            J'ai un code caution
          </Button>
        </div>

        {deposits.length > 0 ? (
          <div className="flex flex-col gap-6">
            {deposits.map((deposit) => {
              const property = properties[deposit.propertyId];

              return (
                <Card
                  key={deposit.id}
                  className={`w-full shadow-sm hover:shadow-md transition-shadow duration-200 ${deposit.statusCode === DepositStatus.DISPUTED ? 'bg-red-50' : ''}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="flex items-center">
                        <Wallet className="h-5 w-5 mr-2 text-primary" />
                        Caution #{deposit.id}
                      </CardTitle>
                      {getDepositStatusBadge(deposit.statusCode)}
                    </div>
                    <CardDescription>
                      {property ? (
                        <div className="mt-2 grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center text-primary">
                              <Home className="h-4 w-4 mr-1.5" />
                              <span className="font-medium">{property.name}</span>
                            </div>
                            <div className="flex items-center mt-1 text-gray-500">
                              <MapPin className="h-4 w-4 mr-1.5" />
                              <span>{property.location}</span>
                            </div>
                            <div className="flex items-center mt-1 text-gray-500">
                              <User className="h-4 w-4 mr-1.5" />
                              <span className="text-xs">{property.landlord.slice(0, 6)}...{property.landlord.slice(-4)}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1.5 text-gray-500" />
                              <div>
                                <span className="text-xs text-gray-500">Création: {formatDate(deposit.creationDate)}</span>
                                {deposit.statusCode !== DepositStatus.PENDING && deposit.paymentDate > 0 && (
                                  <span className="text-xs text-gray-500 block">Versement: {formatDate(deposit.paymentDate)}</span>
                                )}
                                {deposit.refundDate > 0 && (
                                  <span className="text-xs text-gray-500 block">Remboursement: {formatDate(deposit.refundDate)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center mt-2">
                          <Home className="h-4 w-4 mr-1.5 text-gray-400" />
                          <span>Identifiant du bien : {deposit.propertyId}</span>
                        </div>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <ArrowDownCircle className={`h-4 w-4 mr-2 ${deposit.statusCode === DepositStatus.PAID ? 'text-green-500' : 'text-blue-500'}`} />
                          <div>
                            <p className="font-medium">Montant versé</p>
                            <p className="text-lg font-semibold">{deposit.amount} ETH</p>
                            {deposit.paymentDate > 0 && (
                              <div className="flex items-center text-xs text-gray-500 mt-0.5">
                                <Calendar className="h-3 w-3 mr-1" />
                                <span>Le {formatDate(deposit.paymentDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        {(deposit.statusCode === DepositStatus.REFUNDED ||
                          deposit.statusCode === DepositStatus.PARTIALLY_REFUNDED ||
                          deposit.statusCode === DepositStatus.RETAINED) && (
                            <div className="flex items-center">
                              <ArrowUpCircle className={`h-4 w-4 mr-2 ${deposit.statusCode === DepositStatus.REFUNDED ? 'text-green-500' : deposit.statusCode === DepositStatus.PARTIALLY_REFUNDED ? 'text-orange-500' : 'text-red-500'}`} />
                              <div>
                                <p className="font-medium">Montant remboursé</p>
                                <p className="text-lg font-semibold">{deposit.finalAmount} ETH</p>
                                <p className="text-xs text-gray-500">
                                  {(Number(deposit.finalAmount) / Number(deposit.amount) * 100).toFixed(1)}% de la caution
                                </p>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-100">
            <h2 className="text-xl font-semibold mb-2">Aucune caution trouvée</h2>
            <p className="text-gray-500 mb-4">Vous n'avez pas encore déposé de caution</p>
          </div>
        )}
      </main>
    </div>
  )
}

