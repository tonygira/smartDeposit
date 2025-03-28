"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { formatEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText } from "@/lib/contract"
import Link from "next/link"
import { Home, Key, AlertTriangle, CheckCircle } from "lucide-react"

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const [landlordProperties, setLandlordProperties] = useState<any[]>([])

  // Get property IDs
  const { data: propertyIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getLandlordProperties",
    args: [address],
    enabled: isConnected && !!address,
  })


  // Fetch property details
  const { data: propertiesData } = useReadContracts({
    contracts: ((propertyIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI,
      functionName: "getPropertyDetails",
      args: [id],
    })),
    enabled: isConnected && !!propertyIds && propertyIds.length > 0,
  })

  // Log des données des propriétés
  useEffect(() => {
    console.log("Données brutes des propriétés:", propertiesData);
  }, [propertiesData]);

  // Process property data
  useEffect(() => {
    if (propertiesData) {
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
            return {
              id: Number(id),
              landlord,
              name,
              location,
              depositAmount: formatEther(depositAmount),
              status: getPropertyStatusText(status)
            }
          }
          return null
        })
        .filter(Boolean)

      setLandlordProperties(properties)
    }
  }, [propertiesData])

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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <h1 className="text-3xl font-bold mb-8">Votre tableau de bord</h1>

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
              <div className="text-2xl font-bold">{landlordProperties.filter((p) => p.status === "Non loué").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Propriétés louées</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{landlordProperties.filter((p) => p.status === "Loué").length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Propriétés en litige</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{landlordProperties.filter((p) => p.status === "En litige").length}</div>
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
            {landlordProperties.length > 0 && (
              <div className="space-y-4">
                {landlordProperties.map((property) => (
                  <div key={property.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-lg">{property.name}</h3>
                      <Link href={`/properties/${property.id}`}>
                        <Button variant="outline" size="sm">
                          Actions
                        </Button>
                      </Link>
                    </div>
                    <p className="text-sm text-gray-500">{property.location}</p>
                    <p className="mt-2">Caution: {property.depositAmount} ETH</p>
                    <p className="mt-1">
                      Statut:{" "}
                      <span
                        className={`font-medium ${
                          property.status === "En litige"
                            ? "text-yellow-500"
                            : property.status === "Loué"
                            ? "text-green-500"
                            : "text-blue-500"
                        }`}
                      >
                        {property.status}
                      </span>
                    </p>
                  </div>
                ))}
              </div>)}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

