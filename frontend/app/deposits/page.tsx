"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { formatEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getDepositStatusText, DepositStatus } from "@/lib/contract"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { QrCode } from "lucide-react"

export default function Deposits() {
  const { address, isConnected } = useAccount()
  const [deposits, setDeposits] = useState<any[]>([])
  const [properties, setProperties] = useState<Record<number, any>>({})
  const router = useRouter()

  // Get deposit IDs
  const { data: depositIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getTenantDeposits",
    args: [address],
    enabled: isConnected && !!address,
  })

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

  // Process deposit data
  useEffect(() => {
    if (depositsData) {
      const fetchedDeposits = depositsData
        .map((result, index) => {
          if (result.status === "success" && result.result) {
            const [id, propertyId, tenant, amount, timestamp, status] = result.result as [
              bigint,
              bigint,
              string,
              bigint,
              bigint,
              number,
            ]
            return {
              id: Number(id),
              propertyId: Number(propertyId),
              tenant,
              amount: formatEther(amount),
              timestamp: new Date(Number(timestamp) * 1000).toLocaleDateString(),
              status: getDepositStatusText(status),
              statusCode: status,
            }
          }
          return null
        })
        .filter(Boolean)

      setDeposits(fetchedDeposits)

      // Get unique property IDs to fetch property details
      const propertyIds = [...new Set(fetchedDeposits.map((d) => d.propertyId))]

      // Fetch property details for each deposit
      propertyIds.forEach(async (propertyId) => {
        try {
          const propertyData = await fetch(`/api/properties/${propertyId}`).then((res) => res.json())
          setProperties((prev) => ({
            ...prev,
            [propertyId]: propertyData,
          }))
        } catch (error) {
          console.error(`Error fetching property ${propertyId}:`, error)
        }
      })
    }
  }, [depositsData])

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

  const handleCodeButtonClick = () => {
    router.push('/deposits/code');
  }

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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {deposits.map((deposit) => (
              <Card key={deposit.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>Caution #{deposit.id}</CardTitle>
                    <Badge variant="outline" className={getStatusColor(deposit.statusCode)}>
                      {deposit.status}
                    </Badge>
                  </div>
                  <CardDescription>Identifiant du bien : {deposit.propertyId}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p>
                      <strong>Montant:</strong> {deposit.amount} ETH
                    </p>
                    <p>
                      <strong>Date:</strong> {deposit.timestamp}
                    </p>

                    <div className="pt-4">
                      <Link href={`/deposits/${deposit.id}`}>
                        <Button className="w-full">Voir les détails</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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

