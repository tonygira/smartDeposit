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

  // Fetch property details
  const fetchPropertyDetails = async (propertyId: number) => {
    try {
      // const { data } = await useReadContract({
      //   address: CONTRACT_ADDRESS as `0x${string}`,
      //   abi: SMART_DEPOSIT_ABI,
      //   functionName: 'getPropertyDetails',
      //   args: [BigInt(propertyId)],
      // })
      // if (data) {
      //   const [id, landlord, name, location, depositAmount, isActive] = data as [
      //     bigint,
      //     string,
      //     string,
      //     string,
      //     bigint,
      //     boolean
      //   ]
      //   const propertyObj = {
      //     id: Number(id),
      //     landlord,
      //     name,
      //     location,
      //     depositAmount: formatEther(depositAmount),
      //     isActive,
      //   }
      //   setProperty(propertyObj)
      //   setIsLandlord(address?.toLowerCase() === landlord.toLowerCase())
      // }
    } catch (error) {
      console.error("Error fetching property details:", error)
    }
  }

  // Dispute deposit
  const { data: disputeHash, isPending: isDisputePending, writeContract: writeDisputeContract } = useWriteContract()

  const { isLoading: isDisputeConfirming, isSuccess: isDisputeConfirmed } = useWaitForTransactionReceipt({
    hash: disputeHash,
  })

  const handleInitiateDispute = async () => {
    if (!deposit) return

    try {
      writeDisputeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "initiateDispute",
        args: [BigInt(depositId)],
      })
    } catch (error) {
      console.error("Error initiating dispute:", error)
      toast({
        title: "Error",
        description: "Failed to initiate dispute. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Resolve dispute
  const { data: resolveHash, isPending: isResolvePending, writeContract: writeResolveContract } = useWriteContract()

  const { isLoading: isResolveConfirming, isSuccess: isResolveConfirmed } = useWaitForTransactionReceipt({
    hash: resolveHash,
  })

  const handleResolveDispute = async (favorTenant: boolean) => {
    if (!deposit) return

    try {
      writeResolveContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "resolveDispute",
        args: [BigInt(depositId), favorTenant],
      })
    } catch (error) {
      console.error("Error resolving dispute:", error)
      toast({
        title: "Error",
        description: "Failed to resolve dispute. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Release deposit
  const { data: releaseHash, isPending: isReleasePending, writeContract: writeReleaseContract } = useWriteContract()

  const { isLoading: isReleaseConfirming, isSuccess: isReleaseConfirmed } = useWaitForTransactionReceipt({
    hash: releaseHash,
  })

  const handleReleaseDeposit = async () => {
    if (!deposit) return

    try {
      writeReleaseContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "releaseDeposit",
        args: [BigInt(depositId)],
      })
    } catch (error) {
      console.error("Error releasing deposit:", error)
      toast({
        title: "Error",
        description: "Failed to release deposit. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Refund deposit
  const { data: refundHash, isPending: isRefundPending, writeContract: writeRefundContract } = useWriteContract()

  const { isLoading: isRefundConfirming, isSuccess: isRefundConfirmed } = useWaitForTransactionReceipt({
    hash: refundHash,
  })

  const handleRefundDeposit = async () => {
    if (!deposit) return

    try {
      writeRefundContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "refundDeposit",
        args: [BigInt(depositId)],
      })
    } catch (error) {
      console.error("Error refunding deposit:", error)
      toast({
        title: "Error",
        description: "Failed to refund deposit. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle transaction confirmations
  useEffect(() => {
    if (isDisputeConfirmed || isResolveConfirmed || isReleaseConfirmed || isRefundConfirmed) {
      toast({
        title: "Success",
        description: "Transaction completed successfully!",
      })
      router.refresh()
    }
  }, [isDisputeConfirmed, isResolveConfirmed, isReleaseConfirmed, isRefundConfirmed, router, toast])

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
            <h1 className="text-2xl font-bold mb-4">Please connect your wallet</h1>
            <p className="text-gray-500 mb-6">Connect your wallet to view deposit details</p>
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
            <h1 className="text-2xl font-bold mb-4">Loading deposit details...</h1>
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
            <h1 className="text-2xl font-bold mb-4">Deposit not found</h1>
            <Button onClick={() => router.push("/deposits")}>Back to Deposits</Button>
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
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Deposits
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-2xl">Deposit #{deposit.id}</CardTitle>
                <Badge variant="outline" className={getStatusColor(deposit.statusCode)}>
                  {deposit.status}
                </Badge>
              </div>
              <CardDescription className="text-base">
                Property ID: {deposit.propertyId}
                {property && ` - ${property.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">{deposit.amount} ETH</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{deposit.timestamp}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Tenant</p>
                <p className="font-medium">
                  {deposit.tenant.slice(0, 6)}...{deposit.tenant.slice(-4)}
                </p>
              </div>

              {property && (
                <div>
                  <p className="text-sm text-gray-500">Landlord</p>
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
              <CardDescription>Manage your deposit</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deposit.statusCode === DepositStatus.ACTIVE && isTenant && (
                <div>
                  <h3 className="font-medium mb-2">Tenant Actions</h3>
                  <Button
                    onClick={handleInitiateDispute}
                    variant="destructive"
                    className="w-full"
                    disabled={isDisputePending || isDisputeConfirming}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {isDisputePending || isDisputeConfirming ? "Processing..." : "Initiate Dispute"}
                  </Button>
                </div>
              )}

              {deposit.statusCode === DepositStatus.ACTIVE && isLandlord && (
                <div className="space-y-4">
                  <h3 className="font-medium mb-2">Landlord Actions</h3>
                  <Button
                    onClick={handleReleaseDeposit}
                    variant="default"
                    className="w-full"
                    disabled={isReleasePending || isReleaseConfirming}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isReleasePending || isReleaseConfirming ? "Processing..." : "Release Deposit to Landlord"}
                  </Button>

                  <Button
                    onClick={handleRefundDeposit}
                    variant="outline"
                    className="w-full"
                    disabled={isRefundPending || isRefundConfirming}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isRefundPending || isRefundConfirming ? "Processing..." : "Refund Deposit to Tenant"}
                  </Button>
                </div>
              )}

              {deposit.statusCode === DepositStatus.DISPUTED && isLandlord && (
                <div className="space-y-4">
                  <h3 className="font-medium mb-2">Resolve Dispute</h3>
                  <Button
                    onClick={() => handleResolveDispute(false)}
                    variant="default"
                    className="w-full mb-2"
                    disabled={isResolvePending || isResolveConfirming}
                  >
                    {isResolvePending || isResolveConfirming ? "Processing..." : "Resolve in Favor of Landlord"}
                  </Button>

                  <Button
                    onClick={() => handleResolveDispute(true)}
                    variant="outline"
                    className="w-full"
                    disabled={isResolvePending || isResolveConfirming}
                  >
                    {isResolvePending || isResolveConfirming ? "Processing..." : "Resolve in Favor of Tenant"}
                  </Button>
                </div>
              )}

              {(deposit.statusCode === DepositStatus.RELEASED || deposit.statusCode === DepositStatus.REFUNDED) && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-center">
                    This deposit has been {deposit.status.toLowerCase()}. No further actions are required.
                  </p>
                </div>
              )}

              {!isTenant && !isLandlord && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-center">You are not authorized to perform actions on this deposit.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

