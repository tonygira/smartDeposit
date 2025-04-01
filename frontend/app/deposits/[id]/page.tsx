"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther, parseEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText, PropertyStatus, getDepositStatusText, DepositStatus } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { MapPin, DollarSign, Loader2, CheckCircle, AlertCircle, ArrowLeft, User } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export default function DepositDetails() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [isAuthorizedTenant, setIsAuthorizedTenant] = useState(false)

  // Transaction status
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "pending" | "confirming" | "success" | "error">("idle")
  const [txType, setTxType] = useState<"deposit" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const propertyId = Number(params.id)
  
  // Récupération de l'id de la caution courante
  const { data: currentDepositId } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositIdFromProperty",
    args: [BigInt(propertyId)],
  });

  // Récupérer les détails du dépôt si l'ID existe
  const { data: depositData, refetch: refetchDepositData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDeposit",
    args: [currentDepositId ? currentDepositId : BigInt(0)],
  });

  const [depositDetails, setDepositDetails] = useState<{
    status: number;
    statusText: string;
    depositCode?: string;
    creationDate?: number;
    paymentDate?: number;
    refundDate?: number;
    amount?: string;
    finalAmount?: string;
    retainedAmount?: string;
    tenant?: string;
  } | null>(null);

  // Mettre à jour les détails du dépôt quand les données sont reçues
  useEffect(() => {
    if (depositData) {
      const deposit = depositData as any;

      setDepositDetails({
        status: Number(deposit.status),
        statusText: getDepositStatusText(Number(deposit.status)),
        depositCode: deposit.depositCode,
        creationDate: Number(deposit.creationDate),
        paymentDate: Number(deposit.paymentDate),
        refundDate: Number(deposit.refundDate),
        amount: formatEther(deposit.amount),
        finalAmount: formatEther(deposit.finalAmount),
        retainedAmount: formatEther(deposit.amount - deposit.finalAmount),
        tenant: deposit.tenant
      });
    }
  }, [depositData]);

  // Fetch property details
  const { data: propertyData, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getProperty",
    args: [BigInt(propertyId)]
  })

  // Process property data
  useEffect(() => {
    if (propertyData) {
      const propertyWithFormattedStatus = {
        ...propertyData,
        status: getPropertyStatusText(propertyData.status),
        statusCode: Number(propertyData.status)
      };
      
      setProperty(propertyWithFormattedStatus);

      // Vérifier si l'adresse est un locataire autorisé (a validé le code via deposit/code)
      const authorizedCode = localStorage.getItem(`property_${propertyId}_validated_code`);
      setIsAuthorizedTenant(!!authorizedCode);

      // Si l'utilisateur n'est pas un locataire ayant validé le code, rediriger
      if (!authorizedCode) {
        router.push(`/deposits`);
      }
    }
  }, [propertyData, router, propertyId])

  // Vérifier si l'utilisateur est le locataire qui a versé la caution
  const isAuthorizedTenantAddress = depositDetails?.tenant?.toLowerCase() === address?.toLowerCase();

  // Pay deposit (for tenant)
  const { data: depositHash, isPending: isDepositPending, writeContract: writeDepositContract } = useWriteContract()

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed, error: depositConfirmError } = useWaitForTransactionReceipt({
    hash: depositHash,
  })

  // Update transaction status based on contract states
  useEffect(() => {
    if (txType === "deposit") {
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

      if (depositConfirmError) {
        setTransactionStatus("error");
        setError("La transaction de paiement de caution a échoué. Veuillez réessayer.");
      }
    }
  }, [txType, isDepositPending, isDepositConfirming, isDepositConfirmed, depositHash, depositConfirmError]);

  // Reset transaction tracking
  const resetTransaction = () => {
    setTransactionStatus("idle");
    setTxType(null);
    setError(null);
    setTxHash(null);
    
    // Rafraîchir toutes les données importantes
    refetch();
    if (refetchDepositData) {
      refetchDepositData();
    }
  };

  // Function to handle redirect after deposit success
  const handleDepositSuccess = () => {
    router.push("/deposits");
  };

  const handlePayDeposit = async () => {
    if (!property || !currentDepositId || !depositDetails?.amount) return

    try {
      setTransactionStatus("pending");
      setTxType("deposit");
      setError(null);

      // Récupérer le code validé
      const depositCode = localStorage.getItem(`property_${propertyId}_validated_code`);
      if (!depositCode) {
        setTransactionStatus("error");
        setError("Code d'accès non trouvé. Veuillez valider le code d'accès fourni par le propriétaire.");
        return;
      }

      writeDepositContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "payDeposit",
        args: [BigInt(Number(currentDepositId)), depositCode],
        value: parseEther(depositDetails.amount),
      });
    } catch (error) {
      console.error("Erreur lors du versement de la caution:", error)
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de caution.");
    }
  }

  // Utilisation d'une condition de garde au début du rendu
  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Veuillez vous connecter</h1>
            <p className="text-gray-500 mb-6">Connectez-vous pour voir les détails de la caution</p>
            <Button onClick={() => router.push("/deposits")}>
              Retour aux cautions
            </Button>
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
            <h1 className="text-2xl font-bold mb-4">Chargement des détails...</h1>
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
            <h1 className="text-2xl font-bold mb-4">Caution non trouvée</h1>
            <Button onClick={() => router.push("/deposits")}>
              Retour aux cautions
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Si l'utilisateur n'est pas le locataire qui a versé la caution, rediriger
  if (depositDetails?.tenant && depositDetails.status === DepositStatus.PAID && !isAuthorizedTenantAddress) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Accès non autorisé</h1>
            <p className="text-gray-500 mb-6">Vous n'êtes pas le locataire qui a versé la caution pour ce bien.</p>
            <Button onClick={() => router.push("/deposits")}>
              Retour aux cautions
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
          onClick={() => router.push("/deposits")}
          className="mb-6"
        >
          Retour aux cautions
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
                    Caution versée avec succès!
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
                <Button onClick={handleDepositSuccess} variant="default">
                  Voir mes cautions
                </Button>
              )}
              {transactionStatus === "error" && (
                <Button onClick={resetTransaction} variant="outline">
                  Réessayer
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="rounded-lg overflow-hidden mb-6 border border-gray-200 shadow-sm">
              <img
                src={"/maison.png"}
                alt={property.name}
                className="w-full h-auto object-contain bg-white p-4 max-h-[180px]"
              />
            </div>
          </div>

          <Card className="md:col-span-3">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{property.name}</CardTitle>
                  <CardDescription className="flex items-center text-base">
                    <MapPin className="h-4 w-4 mr-1" /> {property.location}
                  </CardDescription>
                </div>
                <div>
                  <p className="flex items-center text-sm font-medium mb-2 text-gray-700">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Caution associée
                  </p>
                  <div className="text-right">
                    {currentDepositId && depositDetails && Number(currentDepositId) > 0 ? (
                      <>
                        <div className="flex items-center justify-end mb-1">
                          <span className={`font-medium ${
                            depositDetails.status === DepositStatus.DISPUTED ? "text-red-500" :
                            depositDetails.status === DepositStatus.PAID ? "text-green-500" :
                            depositDetails.status === DepositStatus.PENDING ? "text-yellow-500" :
                            "text-blue-500"
                          }`}>
                            {depositDetails.statusText}
                          </span>
                        </div>
                        {depositDetails.amount && (
                          <>
                            {depositDetails.status === DepositStatus.PARTIALLY_REFUNDED ? (
                              <div className="flex flex-col items-end text-sm">
                                <div className="flex items-center">
                                  <span>Remboursé: {depositDetails.finalAmount} ETH</span>
                                  <DollarSign className="h-4 w-4 ml-1 text-gray-400" />
                                </div>
                                <div className="flex items-center">
                                  <span>Retenu: {depositDetails.retainedAmount} ETH</span>
                                  <DollarSign className="h-4 w-4 ml-1 text-red-400" />
                                </div>
                              </div>
                            ) : depositDetails.status === DepositStatus.RETAINED ? (
                              <div className="flex items-center justify-end text-sm">
                                <span>Retenu: {depositDetails.amount} ETH</span>
                                <DollarSign className="h-4 w-4 ml-1 text-red-400" />
                              </div>
                            ) : depositDetails.status === DepositStatus.REFUNDED ? (
                              <div className="flex items-center justify-end text-sm">
                                <span>Remboursé: {depositDetails.amount} ETH</span>
                                <DollarSign className="h-4 w-4 ml-1 text-green-400" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-end text-sm">
                                <span>Montant: {depositDetails.amount} ETH</span>
                                <DollarSign className="h-4 w-4 ml-1 text-gray-400" />
                              </div>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-end">
                        <span className="text-gray-500">Aucune</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  <span className="text-sm">
                    Propriétaire: {property.landlord.slice(0, 6)}...{property.landlord.slice(-4)}
                  </span>
                </div>

                {property.status === "En litige" && (
                  <Alert className="bg-red-100 border-red-300 text-red-800">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <AlertTitle>Bien en litige</AlertTitle>
                    <AlertDescription>
                      Ce bien fait actuellement l'objet d'un litige concernant la caution.
                    </AlertDescription>
                  </Alert>
                )}

                {currentDepositId && depositDetails && Number(currentDepositId) > 0 && depositDetails.status === DepositStatus.PENDING && (
                  <>
                    {depositDetails.amount && parseFloat(depositDetails.amount) > 0 ? (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                        <AlertTitle>Caution en attente de paiement</AlertTitle>
                        <AlertDescription>
                          Une demande de caution a été créée pour ce bien. Vous pouvez maintenant
                          effectuer votre paiement.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <AlertTitle>Caution en cours de configuration</AlertTitle>
                        <AlertDescription>
                          Le propriétaire est en train de configurer la caution. Veuillez patienter.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                {currentDepositId && depositDetails && Number(currentDepositId) > 0 &&
                  [DepositStatus.REFUNDED, DepositStatus.PARTIALLY_REFUNDED, DepositStatus.RETAINED].includes(depositDetails.status) && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <AlertTitle>Caution clôturée</AlertTitle>
                      <AlertDescription>
                        La caution pour ce bien a été clôturée.
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section de versement de caution */}
        {isAuthorizedTenant && (transactionStatus === "idle" || transactionStatus === "error") && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Versement de caution</CardTitle>
              <CardDescription>Veuillez verser la caution pour ce bien</CardDescription>
            </CardHeader>
            <CardContent>
              {!depositDetails || depositDetails.status !== DepositStatus.PENDING ? (
                <div>
                  {depositDetails && depositDetails.status === DepositStatus.PAID ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-green-700 flex items-center">
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Vous avez déjà versé la caution pour ce bien
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        Montant versé: {depositDetails.amount} ETH
                      </p>
                      {depositDetails.paymentDate && (
                        <p className="text-sm text-gray-600 mt-1">
                          Date de versement: {new Date(Number(depositDetails.paymentDate) * 1000).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-yellow-600">Le propriétaire n'a pas encore activé la demande de caution pour ce bien.</p>
                      <p className="text-sm text-gray-500 mt-2">Statut actuel: {depositDetails ? depositDetails.statusText : 'Non défini'}</p>
                      {depositDetails && depositDetails.creationDate ? (
                        <p className="text-sm text-gray-500 mt-1">
                          Date de création: {new Date(Number(depositDetails.creationDate) * 1000).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : (
                <Button
                  onClick={handlePayDeposit}
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
                    `Verser la caution (${depositDetails?.amount || "0"} ETH)`
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
} 