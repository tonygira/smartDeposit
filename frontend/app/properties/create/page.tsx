"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"

export default function CreateProperty() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const { data: hash, isPending, writeContract } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !location || !depositAmount) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "createProperty",
        args: [name, location, parseEther(depositAmount)],
      })

      setIsSuccess(true)
    } catch (error) {
      console.error("Error creating property:", error)
      toast({
        title: "Error",
        description: "Failed to create property. Please try again.",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (isSuccess) {
      router.push("/dashboard")
    }
  }, [isSuccess, router])

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Please connect your wallet</h1>
            <p className="text-gray-500 mb-6">Connect your wallet to create a property</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <h1 className="text-3xl font-bold mb-8">Create Property</h1>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
            <CardDescription>Enter the details of your property</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name</Label>
                <Input
                  id="name"
                  placeholder="Enter property name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Enter property location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="depositAmount">Deposit Amount (ETH)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.01"
                  placeholder="0.1"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isPending || isConfirming || isSubmitting}>
                {isPending || isConfirming ? "Creating..." : "Create Property"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

