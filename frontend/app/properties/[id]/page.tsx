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
import { MapPin, DollarSign, User, Loader2, CheckCircle, AlertCircle, ArrowLeft, Upload, AlertTriangle } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadToPinata } from '@/lib/ipfs-service'
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

// Ajout des types pour les fichiers
type FileInfo = {
  cid: string;
  fileType: number;
  uploadTimestamp: bigint;
  uploader: string;
  fileName: string;
};

export default function PropertyDetails() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [isLandlord, setIsLandlord] = useState(false)
  const [isAuthorizedTenant, setIsAuthorizedTenant] = useState(false)

  // État pour afficher le message Kleros
  const [showKlerosMessage, setShowKlerosMessage] = useState(false)

  // Transaction status
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "pending" | "confirming" | "success" | "error">("idle")
  const [txType, setTxType] = useState<"delete" | "deposit" | "refund" | "dispute" | "resolve" | "request" | "upload" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Demande de caution
  const [showDepositRequestForm, setShowDepositRequestForm] = useState(false)
  const [depositAmount, setDepositAmount] = useState("0.1")
  const [depositAmountError, setDepositAmountError] = useState<string | null>(null)

  // Formulaire de remboursement
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")

  const propertyId = Number(params.id)

  // Récupération de l'id de la caution courante
  const { data: currentDepositId } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositIdFromProperty",
    args: [BigInt(propertyId)],
  });

  // Récupérer les détails du dépôt si l'ID existe
  const { data: depositData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositDetails",
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
  } | null>(null);

  // États d'erreur pour les uploads
  const [uploadLeaseError, setUploadLeaseError] = useState<string | null>(null);
  const [uploadPhotosError, setUploadPhotosError] = useState<string | null>(null);
  const [uploadEntryInventoryError, setUploadEntryInventoryError] = useState<string | null>(null);
  const [uploadExitInventoryError, setUploadExitInventoryError] = useState<string | null>(null);
  const [refundErrorMessage, setRefundErrorMessage] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Mettre à jour les détails du dépôt quand les données sont reçues
  useEffect(() => {
    if (depositData) {
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

      // L'index 3 contient le montant du dépôt
      const amount = formatEther(depositDataArray[3]);

      setDepositDetails({
        status: depositDataArray[8],
        statusText: getDepositStatusText(depositDataArray[8]),
        depositCode: depositDataArray[9],
        creationDate: Number(depositDataArray[5]),
        paymentDate: Number(depositDataArray[6]),
        refundDate: Number(depositDataArray[7]),
        amount
      });

      // Mettre à jour le montant du dépôt
      setDepositAmount(amount);

      // Stocker le code de dépôt dans le localStorage pour une utilisation ultérieure
      if (depositDataArray[9]) {
        localStorage.setItem(`property_${propertyId}_deposit_code`, depositDataArray[9]);
      }
    }
  }, [depositData, propertyId]);

  // Log de débogage pour vérifier currentDepositId
  useEffect(() => {
    console.log("currentDepositId:", currentDepositId);
    console.log("depositDetails:", depositDetails);
  }, [currentDepositId, depositDetails]);

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
      const [id, landlord, name, location, status] = propertyData as [
        bigint,
        string,
        string,
        string,
        number
      ]

      const propertyObj = {
        id: Number(id),
        landlord,
        name,
        location,
        status: getPropertyStatusText(status),
        statusCode: status
      }

      setProperty(propertyObj)

      // Vérifier si l'utilisateur est le propriétaire
      const userIsLandlord = address?.toLowerCase() === landlord.toLowerCase();
      setIsLandlord(userIsLandlord);

      // Vérifier si l'adresse est un locataire autorisé (a validé le code via deposit/code)
      const authorizedCode = localStorage.getItem(`property_${propertyId}_validated_code`);
      setIsAuthorizedTenant(!!authorizedCode);

      // Si l'utilisateur n'est ni le propriétaire ni un locataire ayant validé le code, rediriger
      if (!userIsLandlord && !authorizedCode) {
        router.push(`/deposits`);
      }
    }
  }, [propertyData, address, propertyId, router])

  // Rafraîchir les données lorsque l'adresse change
  useEffect(() => {
    if (address) {
      // Rafraîchir toutes les données importantes
      refetch();
      if (currentDepositId !== undefined) {
        // Réinitialiser les états si nécessaire
        setTransactionStatus("idle");
        setTxType(null);
        setError(null);
        setTxHash(null);
      }

      // Vérifier à nouveau si l'utilisateur est autorisé après changement d'adresse
      const authorizedCode = localStorage.getItem(`property_${propertyId}_validated_code`);
      setIsAuthorizedTenant(!!authorizedCode);

      // Si les données de propriété sont déjà chargées et que l'utilisateur n'est pas autorisé, rediriger
      if (property && !authorizedCode && address?.toLowerCase() !== property.landlord.toLowerCase()) {
        router.push(`/deposits`);
      }
    }
  }, [address, refetch, propertyId, router, property, currentDepositId]);

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
  const { data: refundHash, isPending: isRefundPending, writeContract: writeRefundContract, error: writeRefundError } = useWriteContract()

  // Log l'erreur de writeRefundContract si elle existe
  useEffect(() => {
    if (writeRefundError) {
      console.error("Erreur writeRefundContract:", writeRefundError);
    }
  }, [writeRefundError]);

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

  // File upload
  const { data: uploadHash, isPending: isUploadPending, writeContract } = useWriteContract()

  const { isLoading: isUploadConfirming, isSuccess: isUploadConfirmed, error: uploadError } = useWaitForTransactionReceipt({
    hash: uploadHash,
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
        setError("La transaction de versement de caution a échoué. Veuillez réessayer.");
      }
    } else if (txType === "refund") {
      console.log("État de la transaction de remboursement:", {
        isRefundPending,
        isRefundConfirming,
        isRefundConfirmed,
        refundHash,
        error: refundError || writeRefundError
      });

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

      if (refundError || writeRefundError) {
        console.error("Erreur détaillée de remboursement:", refundError || writeRefundError);
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
    } else if (txType === "upload") {
      if (isUploadPending) {
        setTransactionStatus("pending");
      } else if (isUploadConfirming) {
        setTransactionStatus("confirming");
      } else if (isUploadConfirmed) {
        setTransactionStatus("success");
      }

      if (uploadHash) {
        setTxHash(uploadHash);
      }

      if (uploadError) {
        setTransactionStatus("error");
        setError("La transaction d'upload a échoué. Veuillez réessayer.");
      }
    }
  }, [
    txType,
    isDeletePending, isDeleteConfirming, isDeleteConfirmed, deleteHash, deleteError,
    isDepositPending, isDepositConfirming, isDepositConfirmed, depositHash, depositError,
    isRefundPending, isRefundConfirming, isRefundConfirmed, refundHash, refundError, writeRefundError,
    isDisputePending, isDisputeConfirming, isDisputeConfirmed, disputeHash, disputeError,
    isResolvePending, isResolveConfirming, isResolveConfirmed, resolveHash, resolveError,
    isRequestPending, isRequestConfirming, isRequestConfirmed, requestHash, requestError,
    isUploadPending, isUploadConfirming, isUploadConfirmed, uploadHash, uploadError,
  ]);

  // Reset transaction tracking
  const resetTransaction = () => {
    setTransactionStatus("idle");
    setTxType(null);
    setError(null);
    setTxHash(null);
    refetch(); // Refresh property data
  };

  // Function to handle redirect after deposit success
  const handleDepositSuccess = () => {
    // Redirect to deposits list
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
    // Vérifier que le montant est valide
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositAmountError("Le montant de la caution doit être supérieur à 0");
      return;
    }

    // Réinitialiser l'erreur
    setDepositAmountError(null);

    // Rediriger vers la page de QR code avec le montant de la caution en paramètre
    router.push(`/properties/${propertyId}/qr-code?amount=${depositAmount}`);
  }

  const handleUploadLease = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        // Réinitialiser les erreurs/messages précédents
        setUploadLeaseError(null);
        setUploadSuccess(null);

        const cid = await uploadToPinata(file, {
          propertyId: propertyId.toString(),
          fileType: 'LEASE'
        });
        handleUploadSuccess(cid, 'LEASE', file.name);
      } catch (error) {
        console.error("Erreur lors de l'upload du bail:", error);
        setUploadLeaseError("Une erreur s'est produite lors de l'upload du bail.");
      }
    }
  };

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        // Réinitialiser les erreurs/messages précédents
        setUploadPhotosError(null);
        setUploadSuccess(null);

        const cid = await uploadToPinata(file, {
          propertyId: propertyId.toString(),
          fileType: 'PHOTOS'
        });
        handleUploadSuccess(cid, 'PHOTOS', file.name);
      } catch (error) {
        console.error("Erreur lors de l'upload des photos:", error);
        setUploadPhotosError("Une erreur s'est produite lors de l'upload des photos.");
      }
    }
  };

  const handleUploadEntryInventory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        // Réinitialiser les erreurs/messages précédents
        setUploadEntryInventoryError(null);
        setUploadSuccess(null);

        const cid = await uploadToPinata(file, {
          propertyId: propertyId.toString(),
          fileType: 'ENTRY_INVENTORY'
        });
        handleUploadSuccess(cid, 'ENTRY_INVENTORY', file.name);
      } catch (error) {
        console.error("Erreur lors de l'upload de l'état des lieux d'entrée:", error);
        setUploadEntryInventoryError("Une erreur s'est produite lors de l'upload de l'état des lieux d'entrée.");
      }
    }
  };

  const handleUploadExitInventory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        // Réinitialiser les erreurs/messages précédents
        setUploadExitInventoryError(null);
        setUploadSuccess(null);

        const cid = await uploadToPinata(file, {
          propertyId: propertyId.toString(),
          fileType: 'EXIT_INVENTORY'
        });
        handleUploadSuccess(cid, 'EXIT_INVENTORY', file.name);
      } catch (error) {
        console.error("Erreur lors de l'upload de l'état des lieux de sortie:", error);
        setUploadExitInventoryError("Une erreur s'est produite lors de l'upload de l'état des lieux de sortie.");
      }
    }
  };

  const handleUploadSuccess = async (cid: string, fileType: 'LEASE' | 'PHOTOS' | 'ENTRY_INVENTORY' | 'EXIT_INVENTORY', fileName: string) => {
    console.log(`CID reçu: ${cid}, Type: ${fileType}, Nom: ${fileName}`);

    if (!property) return;

    try {
      setTransactionStatus("pending");
      setTxType("upload");
      setError(null);

      let fileTypeEnum;
      switch (fileType) {
        case 'LEASE':
          fileTypeEnum = 0;
          break;
        case 'PHOTOS':
          fileTypeEnum = 1;
          break;
        case 'ENTRY_INVENTORY':
          fileTypeEnum = 2;
          break;
        case 'EXIT_INVENTORY':
          fileTypeEnum = 3;
          break;
        default:
          fileTypeEnum = 0;
      }

      console.log("Envoi de la transaction d'ajout de fichier:", {
        address: CONTRACT_ADDRESS,
        functionName: "addFile",
        args: [BigInt(propertyId), cid, fileTypeEnum, fileName]
      });

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "addFile",
        args: [BigInt(propertyId), fileTypeEnum, cid, fileName],
      });

      setUploadSuccess("Veuillez confirmer la transaction dans votre wallet");
    } catch (error) {
      console.error(`Erreur lors de l'ajout du fichier au contrat:`, error);
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'enregistrement du fichier.");
    }
  };

  // Fonction utilitaire pour afficher les erreurs de contrat de manière plus lisible
  const formatContractError = (error: any) => {
    if (!error) return "Erreur inconnue";

    // Essayer de parser le message d'erreur
    const errorString = String(error);

    // Rechercher les messages d'erreur spécifiques
    if (errorString.includes("execution reverted")) {
      if (errorString.includes("Caller is not authorized")) {
        return "Vous n'êtes pas autorisé à effectuer cette action (vous n'êtes pas le propriétaire).";
      }
      if (errorString.includes("Deposit not found")) {
        return "La caution n'a pas été trouvée. Vérifiez l'ID du dépôt.";
      }
      if (errorString.includes("Deposit is not in the PAID state")) {
        return "La caution n'est pas dans l'état PAYÉE. Seules les cautions payées peuvent être remboursées.";
      }
      // Erreur générique de revert
      return "L'exécution de la transaction a été annulée par le contrat: " + errorString;
    }

    return errorString;
  };

  const handleRefundDeposit = async () => {
    if (!property || !currentDepositId || Number(currentDepositId) === 0) {
      console.error("Impossible de restituer la caution", {
        propertyExists: !!property,
        currentDepositId: currentDepositId ? Number(currentDepositId) : 0
      });
      setRefundErrorMessage("Impossible de restituer la caution. Aucun ID de dépôt valide trouvé.");
      return;
    }

    try {
      console.log("Initialisation de la restitution de caution pour le dépôt:", Number(currentDepositId));
      console.log("Détails de la transaction:", {
        address: CONTRACT_ADDRESS,
        functionName: "refundDeposit",
        args: [BigInt(Number(currentDepositId))],
        currentDepositIdType: typeof currentDepositId,
        parsedDepositId: BigInt(Number(currentDepositId)).toString()
      });

      setTransactionStatus("pending");
      setTxType("refund");
      setError(null);
      setRefundErrorMessage(null);

      // Assurons-nous que l'ID est correctement formaté
      const depositIdBigInt = BigInt(Number(currentDepositId));

      // Exécution de la transaction
      writeRefundContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "refundDeposit",
        args: [depositIdBigInt],
      });
    } catch (error) {
      console.error("Erreur lors du remboursement de la caution:", error);
      const errorMessage = formatContractError(error);
      setTransactionStatus("error");
      setError(`La transaction de remboursement a échoué: ${errorMessage}`);
      setRefundErrorMessage(errorMessage);
    }
  };

  const handleInitiateDispute = async () => {
    try {
      setTransactionStatus("pending");
      setTxType("dispute");
      setError(null);

      writeDisputeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "initiateDispute",
        args: [BigInt(Number(currentDepositId))],
      })
    } catch (error) {
      console.error("Erreur lors de l'initiation du litige:", error);
      setTransactionStatus("error");
      setTxType("dispute");
      setError("Une erreur s'est produite lors de l'envoi de la transaction.");
    }
  };

  const handleShowRefundForm = () => {
    if (depositDetails?.amount) {
      setRefundAmount(depositDetails.amount);
    } else {
      setRefundAmount("0");
    }
    setShowRefundForm(true);
  };

  const handleResolveDispute = async () => {
    if (!property || !currentDepositId || Number(currentDepositId) === 0 || !refundAmount || !depositDetails?.amount) return;

    try {
      setTransactionStatus("pending");
      setTxType("resolve");
      setError(null);

      writeResolveContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "resolveDispute",
        args: [BigInt(Number(currentDepositId)), parseEther(refundAmount)],
      });
    } catch (error) {
      console.error("Erreur lors de la résolution du litige:", error);
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de résolution de litige.");
    }
  };

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
      case "upload":
        return "Fichier enregistré avec succès!";
      default:
        return "Transaction effectuée avec succès!";
    }
  };

  const [files, setFiles] = useState<FileInfo[]>([]);

  // Récupération des fichiers
  const { data: propertyFiles, refetch: refetchFiles } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getPropertyFiles",
    args: [BigInt(propertyId)],
  });

  // Mise à jour des fichiers quand les données sont reçues
  useEffect(() => {
    if (propertyFiles) {
      console.log("Fichiers reçus:", propertyFiles);
      setFiles(propertyFiles as FileInfo[]);
    }
  }, [propertyFiles]);

  // Rafraîchir les fichiers après un upload réussi
  useEffect(() => {
    if (transactionStatus === "success" && txType === "upload") {
      refetchFiles();
    }
  }, [transactionStatus, txType, refetchFiles]);

  // Effet pour masquer automatiquement le message Kleros après 5 secondes
  useEffect(() => {
    if (showKlerosMessage) {
      const timer = setTimeout(() => {
        setShowKlerosMessage(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showKlerosMessage]);

  // Fonction pour obtenir le type de fichier en texte
  const getFileTypeText = (fileType: number) => {
    switch (fileType) {
      case 0:
        return "Bail";
      case 1:
        return "Photos";
      case 2:
        return "État des lieux d'entrée";
      case 3:
        return "État des lieux de sortie";
      default:
        return "Fichier";
    }
  };

  // Fonction pour télécharger un fichier
  const handleDownloadFile = async (cid: string, fileName: string) => {
    try {
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erreur lors du téléchargement:", error);
      setError("Impossible de télécharger le fichier.");
    }
  };

  // Utilisation d'une condition de garde au début du rendu
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
                  {txType === "deposit" ? (
                    <Button onClick={handleDepositSuccess} variant="default">
                      Voir mes cautions
                    </Button>
                  ) : (
                    <>

                      <Button onClick={resetTransaction} variant="outline">
                        Continuer
                      </Button>
                    </>
                  )}
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

        {showKlerosMessage && (
          <Alert className="bg-red-50 border-red-200 mb-6">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <AlertTitle>Fonctionnalité non disponible</AlertTitle>
            <AlertDescription>
              Cette fonctionnalité n'est pas encore disponible.
              <Button
                variant="link"
                className="p-0 h-auto text-red-500 underline ml-2"
                onClick={() => setShowKlerosMessage(false)}
              >
                Fermer
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Formulaire global pour le locataire et le propriétaire */}
        {showDepositRequestForm && (
          <div className="grid grid-cols-1 gap-8 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Votre bien</CardTitle>
                <CardDescription>Informations sur le bien concerné par la caution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Section "Votre bien" */}
                <div>
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
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section Demande de caution pour propriétaire uniquement */}
            {isLandlord && (
              <Card>
                <CardHeader>
                  <CardTitle>Demande de caution</CardTitle>
                  <CardDescription>Veuillez renseigner les informations suivantes :</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div>
                        <input
                          type="file"
                          onChange={handleUploadLease}
                          style={{ display: 'none' }}
                          id="upload-lease"
                        />
                        <label htmlFor="upload-lease">
                          <Button
                            variant="outline"
                            className="flex items-center"
                            type="button"
                            onClick={() => document.getElementById('upload-lease')?.click()}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Déposer le bail
                          </Button>
                        </label>
                      </div>

                      <div>
                        <input
                          type="file"
                          onChange={handleUploadPhotos}
                          style={{ display: 'none' }}
                          id="upload-photos"
                        />
                        <label htmlFor="upload-photos">
                          <Button
                            variant="outline"
                            className="flex items-center"
                            type="button"
                            onClick={() => document.getElementById('upload-photos')?.click()}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Déposer photos
                          </Button>
                        </label>
                      </div>

                      <div>
                        <input
                          type="file"
                          onChange={handleUploadEntryInventory}
                          style={{ display: 'none' }}
                          id="upload-entry-inventory"
                        />
                        <label htmlFor="upload-entry-inventory">
                          <Button
                            variant="outline"
                            className="flex items-center"
                            type="button"
                            onClick={() => document.getElementById('upload-entry-inventory')?.click()}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Déposer l'état des lieux d'entrée
                          </Button>
                        </label>
                      </div>

                      <div>
                        <input
                          type="file"
                          onChange={handleUploadExitInventory}
                          style={{ display: 'none' }}
                          id="upload-exit-inventory"
                        />
                        <label htmlFor="upload-exit-inventory">
                          <Button
                            variant="outline"
                            className="flex items-center"
                            type="button"
                            onClick={() => document.getElementById('upload-exit-inventory')?.click()}
                            disabled={!(currentDepositId && depositDetails && depositDetails.status >= DepositStatus.PAID)}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Déposer l'état des lieux de sortie
                          </Button>
                        </label>
                      </div>
                    </div>

                    {/* Afficher les erreurs d'upload si nécessaire */}
                    {uploadLeaseError && (
                      <Alert className="bg-red-50 border-red-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <AlertTitle>Erreur d'upload du bail</AlertTitle>
                        <AlertDescription>{uploadLeaseError}</AlertDescription>
                      </Alert>
                    )}

                    {uploadPhotosError && (
                      <Alert className="bg-red-50 border-red-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <AlertTitle>Erreur d'upload des photos</AlertTitle>
                        <AlertDescription>{uploadPhotosError}</AlertDescription>
                      </Alert>
                    )}

                    {uploadEntryInventoryError && (
                      <Alert className="bg-red-50 border-red-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <AlertTitle>Erreur d'upload de l'état des lieux d'entrée</AlertTitle>
                        <AlertDescription>{uploadEntryInventoryError}</AlertDescription>
                      </Alert>
                    )}

                    {uploadExitInventoryError && (
                      <Alert className="bg-red-50 border-red-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <AlertTitle>Erreur d'upload de l'état des lieux de sortie</AlertTitle>
                        <AlertDescription>{uploadExitInventoryError}</AlertDescription>
                      </Alert>
                    )}

                    {uploadSuccess && (
                      <Alert className="bg-blue-50 border-blue-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                        <AlertTitle>Transaction envoyée</AlertTitle>
                        <AlertDescription>{uploadSuccess}</AlertDescription>
                      </Alert>
                    )}

                    {/* Affichage des erreurs de remboursement */}
                    {refundErrorMessage && (
                      <Alert className="bg-red-50 border-red-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <AlertTitle>Erreur de remboursement</AlertTitle>
                        <AlertDescription>{refundErrorMessage}</AlertDescription>
                      </Alert>
                    )}

                    <div className="mb-2">
                      <div className="flex items-center gap-4">
                        <Label htmlFor="depositAmount" className="whitespace-nowrap">Montant de la caution (ETH)</Label>
                        <Input
                          id="depositAmount"
                          type="number"
                          value={depositAmount}
                          onChange={(e) => {
                            setDepositAmount(e.target.value);
                            setDepositAmountError(null); // Effacer l'erreur lors de la modification
                          }}
                          className="w-40"
                        />
                      </div>
                    </div>

                    {depositAmountError && (
                      <Alert className="bg-red-50 border-red-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <AlertTitle>Erreur</AlertTitle>
                        <AlertDescription>{depositAmountError}</AlertDescription>
                      </Alert>
                    )}
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
            )}
          </div>
        )}

        {/* Section d'actions initiales sur le bien */}
        {!showDepositRequestForm && (transactionStatus === "idle" || transactionStatus === "error") ? (
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

            <Card className={`md:col-span-3 ${property.status === "En litige" ? 'bg-red-50' : ''}`}>
              <CardHeader>
                <CardTitle className="text-2xl">{property.name} - {property.status}</CardTitle>
                <CardDescription className="flex items-center text-base">
                  <MapPin className="h-4 w-4 mr-1" /> {property.location}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  <span>
                    Propriétaire: {property.landlord.slice(0, 6)}...{property.landlord.slice(-4)}
                  </span>
                </div>

                {property.status === "En litige" && (
                  <Alert className="bg-red-100 border-red-300 text-red-800">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <AlertTitle>Bien en litige</AlertTitle>
                    <AlertDescription>
                      Ce bien fait actuellement l'objet d'un litige concernant la caution.
                    </AlertDescription>
                  </Alert>
                )}

                {typeof currentDepositId !== 'undefined' && depositDetails && Number(currentDepositId) > 0 && depositDetails.status === DepositStatus.PENDING && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-5 w-5 text-blue-500" />
                    <AlertTitle>Caution en attente de paiement</AlertTitle>
                    <AlertDescription>
                      Une demande de caution a été créée pour ce bien. Le locataire doit maintenant
                      utiliser le code QR ou le code unique pour effectuer son paiement.
                    </AlertDescription>
                  </Alert>
                )}

                {typeof currentDepositId !== 'undefined' && depositDetails && Number(currentDepositId) > 0 &&
                  [DepositStatus.REFUNDED, DepositStatus.PARTIALLY_REFUNDED, DepositStatus.RETAINED].includes(depositDetails.status) && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <AlertTitle>Caution clôturée</AlertTitle>
                      <AlertDescription>
                        La caution pour ce bien a été clôturée. Vous pouvez maintenant créer une nouvelle demande de caution.
                      </AlertDescription>
                    </Alert>
                  )}

                {isLandlord && (
                  <div className="mt-4">
                    <div className="flex space-x-3">
                      {!currentDepositId && files.length === 0 && (
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
                      )}
                      {currentDepositId && depositDetails && Number(currentDepositId) > 0 &&
                        depositDetails.status === DepositStatus.PENDING ? (
                        <Button
                          onClick={() => {
                            // Utiliser le code de dépôt provenant directement du contrat
                            if (depositDetails?.depositCode) {
                              router.push(`/properties/${propertyId}/qr-code?useExistingCode=true`);
                            } else {
                              // Fallback au localStorage si pour une raison le code n'est pas disponible dans depositDetails
                              const savedCode = localStorage.getItem(`property_${propertyId}_deposit_code`);
                              if (savedCode) {
                                router.push(`/properties/${propertyId}/qr-code?useExistingCode=true`);
                              } else {
                                router.push(`/properties/${propertyId}/qr-code`);
                              }
                            }
                          }}
                          size="sm"
                          style={{ backgroundColor: "#7759F9" }}
                        >
                          Voir le code QR
                        </Button>
                      ) : (!currentDepositId || (depositDetails &&
                        [DepositStatus.REFUNDED, DepositStatus.PARTIALLY_REFUNDED, DepositStatus.RETAINED].includes(depositDetails.status))) && (
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
                      )}
                    </div>

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
                      <div className="space-y-4">
                        {!showRefundForm ? (
                          <div className="flex space-x-3">
                            <Button
                              onClick={handleShowRefundForm}
                              size="sm"
                              disabled={isFormDisabled}
                            >
                              Régler le litige
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="refundAmount">Montant à rembourser (ETH)</Label>
                              <Input
                                id="refundAmount"
                                type="number"
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(e.target.value)}
                                step="0.000000000000000001"
                                min="0"
                                max={depositDetails?.amount}
                                className="w-full"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={handleResolveDispute}
                                size="sm"
                                disabled={isFormDisabled || !refundAmount}
                              >
                                {isFormDisabled && txType === "resolve" ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    En cours...
                                  </>
                                ) : (
                                  "Confirmer le remboursement"
                                )}
                              </Button>
                              <Button
                                onClick={() => setShowKlerosMessage(true)}
                                size="sm"
                                style={{ backgroundColor: "#7759F9", color: "white" }}
                              >
                                Confier le dossier à Kleros
                              </Button>
                              <Button
                                onClick={() => setShowRefundForm(false)}
                                variant="outline"
                                size="sm"
                                disabled={isFormDisabled}
                              >
                                Annuler
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Section du locataire */}
        {!isLandlord && isAuthorizedTenant && (transactionStatus === "idle" || transactionStatus === "error") && !showDepositRequestForm ? (
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
        ) : null}

        {/* Section des fichiers uploadés - visible par tous */}
        <Card className={`mt-8 ${property.status === "En litige" ? 'bg-red-50' : ''}`}>
          <CardHeader>
            <CardTitle>Documents associés</CardTitle>
            <CardDescription>Liste des documents uploadés pour ce bien</CardDescription>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <p className="text-gray-500">Aucun document n'a encore été uploadé.</p>
            ) : (
              <div className="grid gap-4">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-gray-100 rounded-full">
                        <Upload className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium">{getFileTypeText(Number(file.fileType))}</p>
                        <p className="text-sm text-gray-500">
                          {file.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          Uploadé le {file.uploadTimestamp ? new Date(Number(file.uploadTimestamp) * 1000).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Date inconnue'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadFile(file.cid, file.fileName)}
                    >
                      Télécharger
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

