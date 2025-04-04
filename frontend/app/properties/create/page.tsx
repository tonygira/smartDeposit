"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"

export default function CreateProperty() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "pending" | "confirming" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const { data: hash, isPending, writeContract } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: confirmError } = useWaitForTransactionReceipt({
    hash,
  })

  // Update transaction status based on contract states
  useEffect(() => {
    if (isPending) {
      setTransactionStatus("pending")
    } else if (isConfirming) {
      setTransactionStatus("confirming")
    } else if (isConfirmed) {
      setTransactionStatus("success")
    }

    if (hash) {
      setTxHash(hash)
    }

    if (confirmError) {
      setTransactionStatus("error")
      setError("La transaction a échoué sur la blockchain. Veuillez réessayer.")
    }
  }, [isPending, isConfirming, isConfirmed, hash, confirmError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !location) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      setTransactionStatus("pending")
      setError(null)

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "createProperty",
        args: [name, location],
      })
    } catch (error) {
      console.error("Erreur lors de la création du bien:", error)
      setTransactionStatus("error")
      setError("Une erreur s'est produite lors de l'envoi de la transaction.")
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setName("")
    setLocation("")
    setTransactionStatus("idle")
    setError(null)
    setTxHash(null)
    setIsSubmitting(false)
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Veuillez connecter votre wallet</h1>
            <p className="text-gray-500 mb-6">Connectez votre wallet pour créer un bien</p>
          </div>
        </main>
      </div>
    )
  }

  const isFormDisabled = transactionStatus === "pending" || transactionStatus === "confirming"

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <h1 className="text-3xl font-bold mb-8">Enregistrer un bien</h1>

        <div className="max-w-md mx-auto space-y-4">
          {transactionStatus !== "idle" && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>État de la transaction</CardTitle>
                <CardDescription>
                  {transactionStatus === "pending" && "Envoi de la transaction..."}
                  {transactionStatus === "confirming" && "Transaction en cours de confirmation..."}
                  {transactionStatus === "success" && "Transaction confirmée!"}
                  {transactionStatus === "error" && "Erreur lors de la transaction"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactionStatus === "pending" && (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="ml-2">Veuillez confirmer la transaction dans votre wallet</p>
                  </div>
                )}

                {transactionStatus === "confirming" && (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    <p className="ml-2">En attente de confirmation sur la blockchain</p>
                  </div>
                )}

                {transactionStatus === "success" && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <AlertTitle>Succès!</AlertTitle>
                    <AlertDescription>
                      Votre bien a été créé avec succès. La transaction a été confirmée.
                    </AlertDescription>
                  </Alert>
                )}

                {transactionStatus === "error" && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <AlertTitle>Échec de la transaction</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {txHash && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium">Hash de transaction:</p>
                    <p className="text-xs text-gray-500 break-all mt-1">{txHash}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                {transactionStatus === "success" && (
                  <>
                    <Button onClick={() => router.push("/dashboard")} variant="outline">
                      Retour au tableau de bord
                    </Button>
                    <Button
                      onClick={resetForm}
                      style={{ backgroundColor: "#7759F9", borderColor: "#7759F9" }}
                    >
                      Créer un autre bien
                    </Button>
                  </>
                )}
                {transactionStatus === "error" && (
                  <Button onClick={resetForm} variant="outline">
                    Réessayer
                  </Button>
                )}
              </CardFooter>
            </Card>
          )}

          {transactionStatus !== "success" && (
            <Card>
              <CardHeader>
                <CardTitle>Détails du bien</CardTitle>
                <CardDescription>Entrez les détails de votre bien</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du bien</Label>
                    <Input
                      id="name"
                      placeholder="Entrez le nom du bien"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={isFormDisabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Emplacement</Label>
                    <Input
                      id="location"
                      placeholder="Entrez l'emplacement du bien"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                      disabled={isFormDisabled}
                    />
                  </div>

                  <div className="flex flex-col space-y-4">
                    <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/dashboard")} disabled={isFormDisabled}>
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isFormDisabled}
                      style={!isFormDisabled ? { backgroundColor: "#7759F9", borderColor: "#7759F9" } : {}}
                    >
                      {isFormDisabled ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Création en cours...
                        </>
                      ) : (
                        "Enregistrer le bien"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

