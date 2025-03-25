"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther, parseEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText, PropertyStatus } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { MapPin, DollarSign, User, Loader2, CheckCircle, AlertCircle, ArrowLeft, Upload } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function PropertyDetails() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [isLandlord, setIsLandlord] = useState(false)

  // Transaction status
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "pending" | "confirming" | "success" | "error">("idle")
  const [txType, setTxType] = useState<"delete" | "deposit" | "refund" | "dispute" | "resolve" | "request" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Demande de caution
  const [showDepositRequestForm, setShowDepositRequestForm] = useState(false)
  const [depositAmount, setDepositAmount] = useState("")

  const propertyId = Number(params.id)

  // Fetch property details
  const { data: propertyData, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getPropertyDetails",
    args: [BigInt(propertyId)]
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
        status: getPropertyStatusText(status),
        statusCode: status
      }

      setProperty(propertyObj)
      setIsLandlord(address?.toLowerCase() === landlord.toLowerCase())
      // Initialiser le montant de la caution avec la valeur actuelle
      setDepositAmount(formatEther(depositAmount))
    }
  }, [propertyData, address])

  // Make deposit
  const { data: depositHash, isPending: isDepositPending, writeContract: writeDepositContract } = useWriteContract()

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed, error: depositError } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  // Handle delete property
  const { data: deleteHash, isPending: isDeletePending, writeContract: writeDeleteContract } = useWriteContract()

  const { isLoading: isDeleteConfirming, isSuccess: isDeleteConfirmed, error: deleteError } = useWaitForTransactionReceipt({
    hash: deleteHash,
  })

  // Request deposit (for landlord)
  const { data: requestHash, isPending: isRequestPending, writeContract: writeRequestContract } = useWriteContract()

  const { isLoading: isRequestConfirming, isSuccess: isRequestConfirmed, error: requestError } = useWaitForTransactionReceipt({
    hash: requestHash,
  })

  // Refund deposit (for landlord)
  const { data: refundHash, isPending: isRefundPending, writeContract: writeRefundContract } = useWriteContract()

  const { isLoading: isRefundConfirming, isSuccess: isRefundConfirmed, error: refundError } = useWaitForTransactionReceipt({
    hash: refundHash,
  })

  // Initiate dispute (for landlord)
  const { data: disputeHash, isPending: isDisputePending, writeContract: writeDisputeContract } = useWriteContract()

  const { isLoading: isDisputeConfirming, isSuccess: isDisputeConfirmed, error: disputeError } = useWaitForTransactionReceipt({
    hash: disputeHash,
  })

  // Resolve dispute (for landlord)
  const { data: resolveHash, isPending: isResolvePending, writeContract: writeResolveContract } = useWriteContract()

  const { isLoading: isResolveConfirming, isSuccess: isResolveConfirmed, error: resolveError } = useWaitForTransactionReceipt({
    hash: resolveHash,
  })

  // Update transaction status based on contract states
  useEffect(() => {
    if (txType === "delete") {
      if (isDeletePending) {
        setTransactionStatus("pending");
      } else if (isDeleteConfirming) {
        setTransactionStatus("confirming");
      } else if (isDeleteConfirmed) {
        setTransactionStatus("success");
      }

      if (deleteHash) {
        setTxHash(deleteHash);
      }

      if (deleteError) {
        setTransactionStatus("error");
        setError("La transaction de suppression a échoué. Veuillez réessayer.");
      }
    } else if (txType === "deposit") {
      if (isDepositPending) {
        setTransactionStatus("pending");
      } else if (isDepositConfirming) {
        setTransactionStatus("confirming");
      } else if (isDepositConfirmed) {
        setTransactionStatus("success");
      }

      if (depositHash) {
        setTxHash(depositHash);
      }

      if (depositError) {
        setTransactionStatus("error");
        setError("La transaction de dépôt a échoué. Veuillez réessayer.");
      }
    } else if (txType === "refund") {
      if (isRefundPending) {
        setTransactionStatus("pending");
      } else if (isRefundConfirming) {
        setTransactionStatus("confirming");
      } else if (isRefundConfirmed) {
        setTransactionStatus("success");
      }

      if (refundHash) {
        setTxHash(refundHash);
      }

      if (refundError) {
        setTransactionStatus("error");
        setError("La transaction de remboursement a échoué. Veuillez réessayer.");
      }
    } else if (txType === "dispute") {
      if (isDisputePending) {
        setTransactionStatus("pending");
      } else if (isDisputeConfirming) {
        setTransactionStatus("confirming");
      } else if (isDisputeConfirmed) {
        setTransactionStatus("success");
      }

      if (disputeHash) {
        setTxHash(disputeHash);
      }

      if (disputeError) {
        setTransactionStatus("error");
        setError("La transaction d'ouverture de litige a échoué. Veuillez réessayer.");
      }
    } else if (txType === "resolve") {
      if (isResolvePending) {
        setTransactionStatus("pending");
      } else if (isResolveConfirming) {
        setTransactionStatus("confirming");
      } else if (isResolveConfirmed) {
        setTransactionStatus("success");
      }

      if (resolveHash) {
        setTxHash(resolveHash);
      }

      if (resolveError) {
        setTransactionStatus("error");
        setError("La transaction de résolution de litige a échoué. Veuillez réessayer.");
      }
    } else if (txType === "request") {
      if (isRequestPending) {
        setTransactionStatus("pending");
      } else if (isRequestConfirming) {
        setTransactionStatus("confirming");
      } else if (isRequestConfirmed) {
        setTransactionStatus("success");
      }

      if (requestHash) {
        setTxHash(requestHash);
      }

      if (requestError) {
        setTransactionStatus("error");
        setError("La transaction de demande de caution a échoué. Veuillez réessayer.");
      }
    }
  }, [
    txType,
    isDeletePending, isDeleteConfirming, isDeleteConfirmed, deleteHash, deleteError,
    isDepositPending, isDepositConfirming, isDepositConfirmed, depositHash, depositError,
    isRefundPending, isRefundConfirming, isRefundConfirmed, refundHash, refundError,
    isDisputePending, isDisputeConfirming, isDisputeConfirmed, disputeHash, disputeError,
    isResolvePending, isResolveConfirming, isResolveConfirmed, resolveHash, resolveError,
    isRequestPending, isRequestConfirming, isRequestConfirmed, requestHash, requestError,
  ]);

  // Reset transaction tracking
  const resetTransaction = () => {
    setTransactionStatus("idle");
    setTxType(null);
    setError(null);
    setTxHash(null);
    refetch(); // Refresh property data
  };

  const handleMakeDeposit = async () => {
    if (!property) return

    try {
      setTransactionStatus("pending");
      setTxType("deposit");
      setError(null);

      writeDepositContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "makeDeposit",
        args: [BigInt(propertyId)],
        value: parseEther(property.depositAmount),
      })
    } catch (error) {
      console.error("Erreur lors de la création de la caution:", error)
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de caution.");
    }
  }

  const handleDeleteProperty = async () => {
    if (!property) return

    try {
      setTransactionStatus("pending");
      setTxType("delete");
      setError(null);

      writeDeleteContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "deleteProperty",
        args: [BigInt(propertyId)],
      })
    } catch (error) {
      console.error("Erreur lors de la suppression du bien:", error)
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de suppression.");
    }
  }

  const handleRequestDeposit = async () => {
    setShowDepositRequestForm(true);
  }

  const handleCancelDepositRequest = () => {
    setShowDepositRequestForm(false);
  }

  const handleSubmitDepositRequest = () => {
    // Rediriger vers la page de QR code
    router.push(`/properties/${propertyId}/qr-code`);
  }

  const handleUploadLease = () => {
    toast({
      title: "Information",
      description: "La fonctionnalité de dépôt de bail sera bientôt disponible.",
    });
  }

  const handleUploadPhotos = () => {
    toast({
      title: "Information",
      description: "La fonctionnalité de dépôt de photos sera bientôt disponible.",
    });
  }

  // Récupération de l'id de deposit
  const { data: depositData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositDetails",
    args: [BigInt(propertyId)],
  });

  const handleRefundDeposit = async () => {
    if (!property || !depositData) return;

    try {
      setTransactionStatus("pending");
      setTxType("refund");
      setError(null);

      writeRefundContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "refundDeposit",
        args: [BigInt(propertyId)],
      });
    } catch (error) {
      console.error("Erreur lors du remboursement de la caution:", error);
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de remboursement.");
    }
  };

  const handleInitiateDispute = async () => {
    if (!property) return

    try {
      setTransactionStatus("pending");
      setTxType("dispute");
      setError(null);

      writeDisputeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "initiateDispute",
        args: [BigInt(propertyId)],
      })
    } catch (error) {
      console.error("Erreur lors de l'ouverture du litige:", error)
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction d'ouverture de litige.");
    }
  }

  const handleResolveDispute = async () => {
    if (!property) return

    try {
      setTransactionStatus("pending");
      setTxType("resolve");
      setError(null);

      writeResolveContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "resolveDispute",
        args: [BigInt(propertyId), true], // true = en faveur du locataire (à adapter selon besoin)
      })
    } catch (error) {
      console.error("Erreur lors de la résolution du litige:", error)
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de résolution de litige.");
    }
  }

  // Afficher les messages en fonction du type de transaction réussie
  const getSuccessMessage = () => {
    switch (txType) {
      case "delete":
        return "Bien supprimé avec succès!";
      case "deposit":
        return "Caution versée avec succès!";
      case "refund":
        return "Caution remboursée avec succès!";
      case "dispute":
        return "Litige ouvert avec succès!";
      case "resolve":
        return "Litige résolu avec succès!";
      case "request":
        return "Demande de caution envoyée avec succès!";
      default:
        return "Transaction effectuée avec succès!";
    }
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Veuillez vous connecter</h1>
            <p className="text-gray-500 mb-6">Connectez-vous pour voir les détails du bien</p>
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
            <h1 className="text-2xl font-bold mb-4">Chargement des détails du bien...</h1>
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
            <h1 className="text-2xl font-bold mb-4">Bien non trouvé</h1>
            <Button onClick={() => router.push(isLandlord ? "/dashboard" : "/deposits")}>
              {isLandlord ? "Retour au tableau de bord" : "Retour aux cautions"}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const isFormDisabled = transactionStatus === "pending" || transactionStatus === "confirming";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <Button
          variant="outline"
          onClick={() => router.push(isLandlord ? "/dashboard" : "/deposits")}
          className="mb-6"
        >
          {isLandlord ? "Retour au tableau de bord" : "Retour aux cautions"}
        </Button>

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
                    {getSuccessMessage()}
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
                  <Button onClick={() => router.push(
                    txType === "deposit"
                      ? "/deposits"
                      : isLandlord
                        ? "/dashboard"
                        : "/deposits"
                  )} variant="default">
                    {txType === "deposit"
                      ? "Voir mes cautions"
                      : isLandlord
                        ? "Retour au tableau de bord"
                        : "Voir mes cautions"}
                  </Button>
                  <Button onClick={resetTransaction} variant="outline">
                    Continuer
                  </Button>
                </>
              )}
              {transactionStatus === "error" && (
                <Button onClick={resetTransaction} variant="outline">
                  Réessayer
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {/* Formulaire de demande de caution */}
        {showDepositRequestForm && (
          <div className="grid grid-cols-1 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Demande de caution</CardTitle>
                <CardDescription>Complétez les informations pour demander une caution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Section "Votre bien" */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Votre bien</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-500">Nom du bien</Label>
                      <p className="font-medium">{property.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Emplacement</Label>
                      <p className="font-medium">{property.location}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Statut</Label>
                      <p className="font-medium">{property.status}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Montant actuel de la caution</Label>
                      <p className="font-medium">{property.depositAmount} ETH</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Section "Dépose de caution" */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Dépose de caution</h3>
                  <p className="text-gray-600 mb-4">Veuillez renseigner les informations suivantes :</p>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <Button
                        variant="outline"
                        className="flex items-center"
                        onClick={handleUploadLease}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Déposer le bail
                      </Button>

                      <Button
                        variant="outline"
                        className="flex items-center"
                        onClick={handleUploadPhotos}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Déposer photos
                      </Button>
                    </div>

                    <div className="mb-2">
                      <Label htmlFor="depositAmount">Montant de la caution (€)</Label>
                      <Input
                        id="depositAmount"
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handleCancelDepositRequest}
                  className="flex items-center"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button onClick={handleSubmitDepositRequest}>Valider la caution</Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {(transactionStatus === "idle" || transactionStatus === "error") && !showDepositRequestForm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <div className="rounded-lg overflow-hidden mb-6">
                <img
                  src={"/maison.png"}
                  alt={property.name}
                  className="w-full h-[200px] object-cover"
                />
              </div>
            </div>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="text-2xl">{property.name} - {property.status}</CardTitle>
                <CardDescription className="flex items-center text-base">
                  <MapPin className="h-4 w-4 mr-1" /> {property.location}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  <span className="text-lg">Montant de la caution: {property.depositAmount} ETH</span>
                </div>

                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  <span>
                    Propriétaire: {property.landlord.slice(0, 6)}...{property.landlord.slice(-4)}
                  </span>
                </div>
                {isLandlord && (
                  <div className="mt-4">
                    {property.status === "Non loué" && (
                      <div className="flex space-x-3">
                        <Button
                          onClick={handleDeleteProperty}
                          variant="destructive"
                          size="sm"
                          disabled={isFormDisabled}
                        >
                          {isFormDisabled && txType === "delete" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              En cours...
                            </>
                          ) : (
                            "Supprimer"
                          )}
                        </Button>
                        <Button
                          onClick={handleRequestDeposit}
                          size="sm"
                          disabled={isFormDisabled}
                          style={{ backgroundColor: "#7759F9" }}
                        >
                          {isFormDisabled && txType === "request" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              En cours...
                            </>
                          ) : (
                            "Demande de caution"
                          )}
                        </Button>
                      </div>
                    )}

                    {property.status === "Loué" && (
                      <div className="flex space-x-3">
                        <Button
                          onClick={handleRefundDeposit}
                          size="sm"
                          disabled={isFormDisabled}
                          style={{ backgroundColor: "#7759F9" }}
                        >
                          {isFormDisabled && txType === "refund" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              En cours...
                            </>
                          ) : (
                            "Restituer la caution"
                          )}
                        </Button>
                        <Button
                          onClick={handleInitiateDispute}
                          variant="outline"
                          size="sm"
                          disabled={isFormDisabled}
                        >
                          {isFormDisabled && txType === "dispute" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              En cours...
                            </>
                          ) : (
                            "Ouvrir un litige"
                          )}
                        </Button>
                      </div>
                    )}

                    {property.status === "En litige" && (
                      <Button
                        onClick={handleResolveDispute}
                        size="sm"
                        disabled={isFormDisabled}
                      >
                        {isFormDisabled && txType === "resolve" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            En cours...
                          </>
                        ) : (
                          "Régler le litige"
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {!isLandlord && (
                  <Button
                    onClick={handleMakeDeposit}
                    className="mt-6"
                    size="sm"
                    disabled={isFormDisabled}
                  >
                    {isFormDisabled && txType === "deposit" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        En cours...
                      </>
                    ) : (
                      `Verser la caution (${property.depositAmount} ETH)`
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

