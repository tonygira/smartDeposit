"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther, parseEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { MapPin, DollarSign, User } from "lucide-react"

export default function PropertyDetails() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [isLandlord, setIsLandlord] = useState(false)

  const propertyId = Number(params.id)

  // Fetch property details
  const { data: propertyData, isLoading } = useReadContract({
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

  // Make deposit
  const { data: depositHash, isPending: isDepositPending, writeContract: writeDepositContract } = useWriteContract()

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  const handleMakeDeposit = async () => {
    if (!property) return

    try {
      writeDepositContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "makeDeposit",
        args: [BigInt(propertyId)],
        value: parseEther(property.depositAmount),
      })
    } catch (error) {
      console.error("Error making deposit:", error)
      toast({
        title: "Error",
        description: "Failed to make deposit. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle deposit confirmation
  useEffect(() => {
    if (isDepositConfirmed) {
      toast({
        title: "Success",
        description: "Deposit made successfully!",
      })
      router.push("/deposits")
    }
  }, [isDepositConfirmed, router, toast])

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Please connect your wallet</h1>
            <p className="text-gray-500 mb-6">Connect your wallet to view property details</p>
          </div>
        </main>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Loading property details...</h1>
          </div>
        </main>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Property not found</h1>
            <Button onClick={() => router.push("/properties")}>Back to Properties</Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <Button variant="outline" onClick={() => router.push("/properties")} className="mb-6">
          Back to Properties
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="rounded-lg overflow-hidden mb-6">
              <img
                src={`/placeholder.svg?height=400&width=600&text=Property+${property.id}`}
                alt={property.name}
                className="w-full h-[300px] object-cover"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{property.name}</CardTitle>
              <CardDescription className="flex items-center text-base">
                <MapPin className="h-4 w-4 mr-1" /> {property.location}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                <span className="text-lg">Deposit Amount: {property.depositAmount} ETH</span>
              </div>

              <div className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                <span>
                  Landlord: {property.landlord.slice(0, 6)}...{property.landlord.slice(-4)}
                </span>
              </div>

              {!isLandlord && (
                <Button
                  onClick={handleMakeDeposit}
                  className="w-full mt-6"
                  disabled={isDepositPending || isDepositConfirming}
                >
                  {isDepositPending || isDepositConfirming
                    ? "Processing..."
                    : `Make Deposit (${property.depositAmount} ETH)`}
                </Button>
              )}

              {isLandlord && (
                <div className="bg-muted p-4 rounded-lg mt-4">
                  <p className="text-sm">You are the landlord of this property.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

