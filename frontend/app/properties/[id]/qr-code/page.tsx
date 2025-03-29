"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { formatEther } from "viem"
import { QRCodeSVG } from "qrcode.react"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Copy, ArrowLeft, QrCode, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { generateRandomCode } from "@/lib/utils"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export default function PropertyQRCode() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [isLandlord, setIsLandlord] = useState(false)
  const [uniqueCode, setUniqueCode] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "pending" | "confirming" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [isExistingCode, setIsExistingCode] = useState(false)

  const searchParams = useSearchParams()
  const useExistingCode = searchParams.get('useExistingCode') === 'true'

  const propertyId = Number(params.id)

  // Vérifier si un dépôt existe déjà pour cette propriété
  const { data: currentDepositId } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositIdFromProperty",
    args: [BigInt(propertyId)]
  })

  // Log pour déboguer
  useEffect(() => {
    console.log("[QR-Code] currentDepositId:", currentDepositId);
  }, [currentDepositId]);

  // Récupérer les détails du dépôt si l'ID existe
  const { data: depositData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositDetails",
    args: [currentDepositId ? currentDepositId : BigInt(0)]
  });

  // Récupérer l'historique des cautions pour cette propriété
  const { data: depositHistory } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getPropertyDeposits",
    args: [BigInt(propertyId)]
  });

  // Générer l'URL de base pour le QR code
  useEffect(() => {
    // fonctionne uniquement pour un déploiement de l'app web publique
    setBaseUrl("https://smart-deposit.vercel.app")
  }, [])

  // Récupérer le code de dépôt depuis le contrat ou en générer un nouveau
  useEffect(() => {
    if (propertyId) {
      // Si un dépôt existe et que nous avons les détails du dépôt
      if (currentDepositId && Number(currentDepositId) > 0 && depositData) {
        const depositDataArray = depositData as unknown as [
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
        ];

        // Si le statut est remboursé, partiellement remboursé ou retenu, il s'agit d'une caution
        // clôturée, donc nous devons générer un nouveau code
        if (depositDataArray[8] === 3 || depositDataArray[8] === 4 || depositDataArray[8] === 5) { // REFUNDED, PARTIALLY_REFUNDED ou RETAINED
          const code = generateRandomCode(propertyId.toString());
          setUniqueCode(code);
          setIsExistingCode(false);
          return;
        }

        const depositCode = depositDataArray[9];
        if (depositCode) {
          setUniqueCode(depositCode);
          setIsExistingCode(true);
          // Sauvegarder le code au cas où
          localStorage.setItem(`property_${propertyId}_deposit_code`, depositCode);
          return;
        }
      }

      // Si on doit utiliser un code existant mais qu'on ne l'a pas récupéré du contrat
      if (useExistingCode) {
        const savedCode = localStorage.getItem(`property_${propertyId}_deposit_code`);
        if (savedCode) {
          setUniqueCode(savedCode);
          setIsExistingCode(true);
          return;
        }
      }

      // Sinon, générer un nouveau code
      const code = generateRandomCode(propertyId.toString());
      setUniqueCode(code);
    }
  }, [propertyId, useExistingCode, currentDepositId, depositData]);

  // Fetch property details
  const { data: propertyData, isLoading: isPropertyLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getPropertyDetails",
    args: [BigInt(propertyId)]
  })

  // Fonction pour créer un dépôt avec le code
  const { data: createDepositHash, isPending: isCreateDepositPending, writeContract: writeDepositContract, error: writeError } = useWriteContract()

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed, error: depositError } = useWaitForTransactionReceipt({
    hash: createDepositHash,
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

  // Suivre l'état de la transaction
  useEffect(() => {
    if (isCreateDepositPending) {
      setTransactionStatus("pending");
    } else if (isDepositConfirming) {
      setTransactionStatus("confirming");
    } else if (isDepositConfirmed) {
      setTransactionStatus("success");
      // Stockage du code validé dans le localStorage
      if (uniqueCode) {
        localStorage.setItem(`property_${propertyId}_deposit_code`, uniqueCode);
      }
    }

    if (createDepositHash) {
      setTxHash(createDepositHash);
    }

    // Capture des erreurs provenant soit de writeContract soit de waitForTransactionReceipt
    if (depositError || writeError) {
      setTransactionStatus("error");
      // Vérifier si l'erreur contient le message spécifique "already exists"
      const errorString = (depositError?.message || writeError?.message || "").toLowerCase();
      if (errorString.includes("already exists") || errorString.includes("deposit already exists")) {
        setErrorMessage("Une caution existe déjà pour ce bien. Impossible d'en créer une nouvelle.");
      } else {
        setErrorMessage("La transaction a échoué. Veuillez réessayer.");
      }
    }
  }, [isCreateDepositPending, isDepositConfirming, isDepositConfirmed, createDepositHash, depositError, writeError, propertyId, uniqueCode]);

  const handleCreateDeposit = async () => {
    if (!property || !isLandlord || !uniqueCode) {
      console.error("Validation échouée:", { property, isLandlord, uniqueCode });
      return;
    }

    console.log("Tentative de création de dépôt:", {
      propertyId,
      uniqueCode,
      currentDepositId: currentDepositId ? Number(currentDepositId) : 0,
    });

    // Vérifier si un dépôt existe déjà
    if (currentDepositId && Number(currentDepositId) > 0 && depositData) {
      // Si une caution existe, vérifier si elle est clôturée (remboursée, partiellement remboursée ou retenue)
      const depositDataArray = depositData as unknown as [bigint, bigint, string, bigint, bigint, bigint, bigint, bigint, number, string];
      console.log("État de la caution:", depositDataArray[8]);

      if (depositDataArray[8] === 3 || depositDataArray[8] === 4 || depositDataArray[8] === 5) {
        // Caution clôturée, on peut en créer une nouvelle
        console.log("Caution clôturée, création d'une nouvelle caution autorisée");
      } else {
        // Une caution active existe déjà, impossible d'en créer une nouvelle
        console.log("Caution active existante, création impossible");
        setTransactionStatus("error");
        setErrorMessage("Une caution active existe déjà pour ce bien. Impossible d'en créer une nouvelle.");
        return;
      }
    }

    try {
      setTransactionStatus("pending");
      setErrorMessage(null);

      console.log("Envoi de la transaction createDeposit avec:", {
        propertyId: BigInt(propertyId),
        uniqueCode
      });

      writeDepositContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "createDeposit",
        args: [BigInt(propertyId), uniqueCode],
      });
    } catch (error) {
      console.error("Erreur lors de la création de la caution:", error);
      setTransactionStatus("error");
      setErrorMessage("Une erreur s'est produite lors de la création de la caution.");
    }
  };

  const resetTransaction = () => {
    setTransactionStatus("idle");
    setErrorMessage(null);
    setTxHash(null);
    refetch();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(uniqueCode)
    toast({
      title: "Code copié !",
      description: "Le code unique a été copié dans le presse-papier.",
    })
  }

  const handleGoBack = () => {
    router.back()
  }

  const handleContinueSuccess = () => {
    // Rediriger vers la page du bien plutôt que de réinitialiser la transaction
    router.push(`/properties/${propertyId}`);
  }

  // URL pour le QR code qui mène directement à la page de dépôt
  const qrCodeUrl = `${baseUrl}/deposits/code?code=${uniqueCode}&propertyId=${propertyId}`

  if (isPropertyLoading) {
    return (
      <div className="container py-10">
        <Header />
        <div className="flex justify-center items-center min-h-[60vh]">
          <p>Chargement des informations du bien...</p>
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="container py-10">
        <Header />
        <div className="flex justify-center items-center min-h-[60vh]">
          <p>Bien non trouvé ou accès non autorisé.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <Header />
      <div className="mb-8">
        <Button variant="outline" onClick={handleGoBack} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au bien
        </Button>
      </div>

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
                  Caution créée avec succès! Le code QR est maintenant actif.
                </AlertDescription>
              </Alert>
            )}

            {transactionStatus === "error" && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <AlertTitle>Échec de la transaction</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {txHash && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium">Hash de transaction:</p>
                <p className="text-xs text-gray-500 break-all mt-1">{txHash}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            {transactionStatus === "success" && (
              <Button onClick={handleContinueSuccess}>
                Retourner au bien
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

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <QrCode className="mr-2 h-6 w-6 text-purple-600" />
              QR Code pour {property.name}
            </CardTitle>
            <CardDescription>
              {isExistingCode ?
                "Voici le code de caution actif pour ce bien" :
                "Créez un code de caution pour ce bien et transmettez-le au locataire"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="bg-white p-6 rounded-lg mb-6">
              <QRCodeSVG
                value={qrCodeUrl}
                size={250}
                bgColor={"#ffffff"}
                fgColor={"#7759F9"}
                level={"H"}
                includeMargin={true}
              />
            </div>

            <div className="w-full max-w-md bg-muted p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Code unique</h3>
                  <p className="text-xl font-bold tracking-wider">{uniqueCode}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={handleCopyCode}>
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="w-full max-w-md mb-4">
              <h3 className="font-medium mb-2">Informations sur le bien</h3>
              <ul className="space-y-2">
                <li><strong>Nom:</strong> {property.name}</li>
                <li><strong>Emplacement:</strong> {property.location}</li>
                <li><strong>Montant de la caution:</strong> {property.depositAmount} ETH</li>
              </ul>
            </div>

            {currentDepositId && Number(currentDepositId) > 0 ? (
              <Alert className="bg-amber-50 border-amber-200 mb-4">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <AlertTitle>
                  {depositData && (depositData as any)[8] === 3 || (depositData as any)[8] === 4 || (depositData as any)[8] === 5
                    ? "Nouvelle caution disponible"
                    : "Caution déjà existante"}
                </AlertTitle>
                <AlertDescription>
                  {depositData && (depositData as any)[8] === 3 || (depositData as any)[8] === 4 || (depositData as any)[8] === 5
                    ? "La caution précédente a été clôturée. Vous pouvez créer une nouvelle caution pour ce bien."
                    : isExistingCode
                      ? "Une caution a déjà été créée avec ce code. Le locataire peut l'utiliser pour verser sa caution."
                      : "Une caution existe déjà pour ce bien. Il n'est pas possible d'en créer une nouvelle."
                  }
                </AlertDescription>
              </Alert>
            ) : null}

            {/* Bouton pour créer la caution */}
            {transactionStatus === "idle" && (!currentDepositId || Number(currentDepositId) === 0 || (depositData && ((depositData as any)[8] === 3 || (depositData as any)[8] === 4 || (depositData as any)[8] === 5))) ? (
              <Button
                onClick={handleCreateDeposit}
                className="w-full mt-4"
                style={{ backgroundColor: "#7759F9" }}
              >
                Créer la caution avec ce code
              </Button>
            ) : null}
          </CardContent>
          <CardFooter>
            <div className="w-full text-center text-sm text-muted-foreground">
              <p>Le QR code dirige vers la page de validation du code. Il expirera après utilisation.</p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
} 