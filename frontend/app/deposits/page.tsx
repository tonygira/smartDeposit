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
import { QrCode } from "lucide-react"

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
    enabled: isConnected && !!address,
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
      abi: SMART_DEPOSIT_ABI,
      functionName: "getDepositDetails",
      args: [id],
    })),
    enabled: isConnected && !!depositIds && depositIds.length > 0,
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
      const uniquePropertyIds = [...new Set(fetchedDeposits.map((d) => d.propertyId))]
      setPropertyIds(uniquePropertyIds)
    }
  }, [depositsData])

  // Fetch property details (separate from deposit processing)
  const { data: propertiesData } = useReadContracts({
    contracts: propertyIds.map((propertyId) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI,
      functionName: "getPropertyDetails",
      args: [BigInt(propertyId)],
    })),
    enabled: isConnected && propertyIds.length > 0,
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

  const getStatusColor = (statusCode: number) => {
    switch (statusCode) {
      case DepositStatus.PENDING:
        return "bg-yellow-100 text-yellow-800"
      case DepositStatus.ACTIVE:
        return "bg-blue-100 text-blue-800"
      case DepositStatus.DISPUTED:
        return "bg-red-100 text-red-800"
      case DepositStatus.REFUNDED:
        return "bg-green-100 text-green-800"
      case DepositStatus.PARTIALLY_REFUNDED:
        return "bg-purple-100 text-purple-800"
      case DepositStatus.RETAINED:
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
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
                <Card key={deposit.id} className="w-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>Caution #{deposit.id}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(deposit.statusCode)}>
                        {deposit.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      {property ? (
                        <>
                          <p className="mt-1 font-medium text-primary">{property.name}</p>
                          <p className="mt-1">{property.location}</p>
                        </>
                      ) : (
                        <>Identifiant du bien : {deposit.propertyId}</>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {deposit.statusCode === DepositStatus.ACTIVE ? (
                        <p>
                          <strong>Montant versé:</strong> {deposit.amount} ETH
                          {deposit.paymentDate > 0 && (
                            <span className="ml-2 text-sm text-gray-600">
                              (le {formatDate(deposit.paymentDate)})
                            </span>
                          )}
                        </p>
                      ) : (
                        <p>
                          <strong>Montant:</strong> {deposit.amount} ETH
                        </p>
                      )}
                      {(deposit.statusCode === DepositStatus.REFUNDED || 
                        deposit.statusCode === DepositStatus.PARTIALLY_REFUNDED || 
                        deposit.statusCode === DepositStatus.RETAINED) && (
                        <>
                          <p>
                            <strong>Montant remboursé:</strong> {deposit.finalAmount} ETH 
                            {deposit.statusCode !== DepositStatus.RETAINED && (
                              <span className="ml-2 text-sm">
                                ({(Number(deposit.finalAmount) / Number(deposit.amount) * 100).toFixed(1)}% de la caution)
                              </span>
                            )}
                            {deposit.statusCode === DepositStatus.RETAINED && (
                              <span className="ml-2 text-sm">(0% de la caution)</span>
                            )}
                          </p>
                          {deposit.refundDate > 0 && (
                            <p>
                              <strong>Date de remboursement:</strong> {formatDate(deposit.refundDate)}
                            </p>
                          )}
                        </>
                      )}
                      <p>
                        <strong>Date de création:</strong> {formatDate(deposit.creationDate)}
                      </p>
                      {deposit.statusCode !== DepositStatus.PENDING && deposit.paymentDate > 0 && (
                        <p>
                          <strong>Date de versement:</strong> {formatDate(deposit.paymentDate)}
                        </p>
                      )}
                      {property && (
                        <p>
                          <strong>Propriétaire:</strong> {property.landlord.slice(0, 6)}...{property.landlord.slice(-4)}
                        </p>
                      )}
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

