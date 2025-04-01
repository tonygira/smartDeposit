"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi"
import { formatEther, parseEther, createPublicClient, http, getContract, parseAbiItem } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getPropertyStatusText, PropertyStatus, getDepositStatusText, DepositStatus } from "@/lib/contract"
import { useToast } from "@/hooks/use-toast"
import { MapPin, DollarSign, User, Loader2, CheckCircle, AlertCircle, ArrowLeft, Upload, AlertTriangle, Home, Wallet, Ban } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadToPinata } from '@/lib/ipfs-service'
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { generateRandomCode } from "@/lib/utils"

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
  const [txType, setTxType] = useState<"delete" | "deposit" | "refund" | "dispute" | "resolve" | "upload" | "create" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Demande de caution
  const [showDepositRequestForm, setShowDepositRequestForm] = useState(false)
  const [depositAmount, setDepositAmount] = useState("0.1")
  const [depositAmountError, setDepositAmountError] = useState<string | null>(null)

  // Formulaire de remboursement
  const [showRefundForm, setShowRefundForm] = useState(false)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundAmountError, setRefundAmountError] = useState<string | null>(null)

  const propertyId = Number(params.id)
  
  // État pour stocker le depositId capturé depuis l'événement
  const [eventDepositId, setEventDepositId] = useState<bigint | null>(null);
  
  // Obtenir le client public pour les appels viem
  const publicClient = usePublicClient();
  
  // Récupération de l'id de la caution courante
  const { data: currentDepositId } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositIdFromProperty",
    args: [BigInt(propertyId)],
  });

  // Écouter l'événement DepositCreated avec viem
  useEffect(() => {
    if (!publicClient) return;
    
    const unwatch = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI,
      eventName: 'DepositCreated',
      onLogs: (logs) => {
        if (logs && logs.length > 0) {
          const event = logs[0];
          console.log("Événement DepositCreated capturé:", event);
          
          // Vérifier que l'événement concerne bien notre propriété
          const eventPropertyId = event.args.propertyId;
          if (eventPropertyId && Number(eventPropertyId) === propertyId) {
            console.log("Nouvel ID de dépôt détecté:", event.args.depositId);
            setEventDepositId(event.args.depositId);
          }
        }
      },
    });
    
    // Nettoyer le watcher quand le composant est démonté
    return () => {
      unwatch();
    };
  }, [publicClient, propertyId]);
  
  // Utiliser soit currentDepositId depuis la blockchain, soit eventDepositId depuis l'événement
  const effectiveDepositId = currentDepositId || eventDepositId;
  
  // Log pour déboguer
  useEffect(() => {
    console.log("effectiveDepositId:", effectiveDepositId);
  }, [effectiveDepositId]);

  // Récupérer les détails du dépôt si l'ID existe
  const { data: depositData, refetch: refetchDepositData } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDeposit",
    args: [effectiveDepositId ? effectiveDepositId : BigInt(0)],
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
  } | null>(null);

  // États d'erreur pour les uploads
  const [uploadLeaseError, setUploadLeaseError] = useState<string | null>(null);
  const [uploadPhotosError, setUploadPhotosError] = useState<string | null>(null);
  const [uploadEntryInventoryError, setUploadEntryInventoryError] = useState<string | null>(null);
  const [uploadExitInventoryError, setUploadExitInventoryError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  
  const [refundErrorMessage, setRefundErrorMessage] = useState<string | null>(null);
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
        retainedAmount: formatEther(deposit.amount - deposit.finalAmount)  // only after dispute
      });

      // Mettre à jour le montant du dépôt
      setDepositAmount(formatEther(deposit.amount));

      // Stocker le code de dépôt dans le localStorage pour une utilisation ultérieure
      if (deposit.depositCode) {
        localStorage.setItem(`property_${propertyId}_deposit_code`, deposit.depositCode);
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
      setIsLandlord(propertyData.landlord.toLowerCase() === address?.toLowerCase());

      // Si l'utilisateur n'est pas le propriétaire, rediriger vers le tableau de bord
      if (propertyData.landlord.toLowerCase() !== address?.toLowerCase()) {
        router.push(`/dashboard`);
      }
    }
  }, [propertyData, address, router, propertyId])

  // Rafraîchir les données lorsque l'adresse change
  useEffect(() => {
    if (address) {
      // Rafraîchir toutes les données importantes
      refetch();
      if (refetchDepositData) {
        refetchDepositData();
      }
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
      if (property && property.landlord.toLowerCase() !== address?.toLowerCase() && !authorizedCode) {
        router.push(`/dashboard`);
      }
    }
  }, [address, refetch, refetchDepositData, propertyId, router, property, currentDepositId]);

  // Create deposit
  const { data: createHash, isPending: isCreatePending, writeContract: writeCreateContract } = useWriteContract()

  const { isLoading: isCreateConfirming, isSuccess: isCreateConfirmed, error: createError } = useWaitForTransactionReceipt({
    hash: createHash,
  })

  // Handle delete property
  const { data: deleteHash, isPending: isDeletePending, writeContract: writeDeleteContract } = useWriteContract()

  const { isLoading: isDeleteConfirming, isSuccess: isDeleteConfirmed, error: deleteError } = useWaitForTransactionReceipt({
    hash: deleteHash,
  })

  // Validate deposit (for landlord)
  const { data: validateHash, isPending: isValidatePending, writeContract: writeValidateContract } = useWriteContract()

  const { isLoading: isValidateConfirming, isSuccess: isValidateConfirmed, error: validateError } = useWaitForTransactionReceipt({
    hash: validateHash,
  })

  // Pay deposit (for tenant)
  const { data: depositHash, isPending: isDepositPending, writeContract: writeDepositContract } = useWriteContract()

  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed, error: depositConfirmError } = useWaitForTransactionReceipt({
    hash: depositHash,
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
    } else if (txType === "validate") {
      if (isValidatePending) {
        setTransactionStatus("pending");
      } else if (isValidateConfirming) {
        setTransactionStatus("confirming");
      } else if (isValidateConfirmed) {
        setTransactionStatus("success");
        
        // Rediriger vers la page QR-code avec le code précedemment généré
        const depositCode = depositDetails?.depositCode || localStorage.getItem(`property_${propertyId}_deposit_code`);
        if (depositCode) {
          router.push(`/properties/${propertyId}/qr-code?useExistingCode=true`);
        }
      }

      if (validateHash) {
        setTxHash(validateHash);
      }

      if (validateError) {
        setTransactionStatus("error");
        setError("La transaction de validation de caution a échoué. Veuillez réessayer.");
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

      if (depositConfirmError) {
        setTransactionStatus("error");
        setError("La transaction de paiement de caution a échoué. Veuillez réessayer.");
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
    } else if (txType === "create") {
      if (isCreatePending) {
        setTransactionStatus("pending");
      } else if (isCreateConfirming) {
        setTransactionStatus("confirming");
      } else if (isCreateConfirmed) {
        setTransactionStatus("success");
        // Afficher le formulaire de demande de caution au lieu de rediriger vers la page QR
        setShowDepositRequestForm(true);
        
        // Forcer le rafraîchissement des données pour obtenir le nouveau depositId
        refetch();
        if (refetchDepositData) {
          refetchDepositData();
        }
      }

      if (createHash) {
        setTxHash(createHash);
      }

      if (createError) {
        setTransactionStatus("error");
        setError("La transaction de création de caution a échoué. Veuillez réessayer.");
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
    isRefundPending, isRefundConfirming, isRefundConfirmed, refundHash, refundError, writeRefundError,
    isDisputePending, isDisputeConfirming, isDisputeConfirmed, disputeHash, disputeError,
    isResolvePending, isResolveConfirming, isResolveConfirmed, resolveHash, resolveError,
    isUploadPending, isUploadConfirming, isUploadConfirmed, uploadHash, uploadError,
    isCreatePending, isCreateConfirming, isCreateConfirmed, createHash, createError,
    isValidatePending, isValidateConfirming, isValidateConfirmed, validateHash, validateError,
    isDepositPending, isDepositConfirming, isDepositConfirmed, depositHash, depositConfirmError,
    router, propertyId, depositDetails
  ]);

  // Reset transaction tracking
  const resetTransaction = () => {
    setTransactionStatus("idle");
    setTxType(null);
    setError(null);
    setTxHash(null);
    
    // Rafraîchir toutes les données importantes
    refetch(); // Refresh property data
    
    // Rafraîchir les données du dépôt - important après une résolution de litige
    if (refetchDepositData) {
      refetchDepositData();
    }
    
    // Si c'était une résolution de litige, on ferme le formulaire
    if (txType === "resolve") {
      setShowRefundForm(false);
    }
  };

  // Function to handle redirect after deposit success
  const handleDepositSuccess = () => {
    // Redirect to deposits list
    router.push("/deposits");
  };

  const handlePayDeposit = async () => {
    if (!property || !effectiveDepositId || !depositDetails?.amount) return

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
        args: [BigInt(Number(effectiveDepositId)), depositCode],
        value: parseEther(depositDetails.amount),
      });
    } catch (error) {
      console.error("Erreur lors du versement de la caution:", error)
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de caution.");
    }
  }

  const handleDeleteProperty = async () => {
    console.log("Suppression du bien:", propertyId);
    console.log("Property:", property);
    
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
      });
    } catch (error) {
      console.error("Erreur lors de la suppression du bien:", error);
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de suppression.");
    }
  }

  const handleCreateDeposit = async () => {
    try {
      // Générer un code aléatoire pour le dépôt en utilisant l'utilitaire dédié
      const randomCode = generateRandomCode(propertyId.toString());
      
      // Stocker le code dans le localStorage
      localStorage.setItem(`property_${propertyId}_deposit_code`, randomCode);
      
      // Préparer la transaction
      setTransactionStatus("pending");
      setTxType("create");
      setError(null);
      
      // Créer la caution directement
      writeCreateContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "createDeposit",
        args: [BigInt(propertyId), randomCode],
      });
      
      console.log("Création de la caution avec:", {
        propertyId,
        code: randomCode
      });
    } catch (error) {
      console.error("Erreur lors de la création de la caution:", error);
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de la création de la caution.");
    }
  };

  const handleCancelDepositRequest = () => {
    setShowDepositRequestForm(false);
  }

  const [files, setFiles] = useState<FileInfo[]>([]);
  
  // États pour suivre la présence des documents obligatoires
  const [hasLeaseDoc, setHasLeaseDoc] = useState(false);
  const [hasEntryInventoryDoc, setHasEntryInventoryDoc] = useState(false);
  const [hasExitInventoryDoc, setHasExitInventoryDoc] = useState(false);
  
  // Vérifier si tous les éléments obligatoires sont fournis
  const isFormValid = hasLeaseDoc && hasEntryInventoryDoc && !depositAmountError && parseFloat(depositAmount) > 0;
  
  // Vérifier si l'état des lieux de sortie est disponible pour le remboursement
  const isExitInventoryAvailable = hasExitInventoryDoc;
  
  // Récupération des fichiers
  const { data: depositFiles, refetch: refetchFiles } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getDepositFiles",
    args: [typeof effectiveDepositId !== 'undefined' && Number(effectiveDepositId) > 0 ? BigInt(effectiveDepositId) : BigInt(0)],
  });
  
  // Mise à jour des fichiers quand les données sont reçues
  useEffect(() => {
    if (depositFiles) {
      console.log("Fichiers reçus:", depositFiles);
      setFiles(depositFiles as FileInfo[]);
      
      // Vérifier la présence des documents obligatoires
      let foundLease = false;
      let foundEntryInventory = false;
      let foundExitInventory = false;
      
      (depositFiles as FileInfo[]).forEach(file => {
        if (Number(file.fileType) === 0) foundLease = true;
        if (Number(file.fileType) === 2) foundEntryInventory = true;
        if (Number(file.fileType) === 3) foundExitInventory = true;
      });
      
      setHasLeaseDoc(foundLease);
      setHasEntryInventoryDoc(foundEntryInventory);
      setHasExitInventoryDoc(foundExitInventory);
    }
  }, [depositFiles]);
  
  // Rafraîchir les fichiers après un upload réussi ou après qu'une caution soit créée
  useEffect(() => {
    if ((transactionStatus === "success" && txType === "upload") ||
        (transactionStatus === "success" && txType === "create")) {
      refetchFiles();
      // Réinitialiser le message de succès d'upload
      setUploadSuccess(null);
    }
  }, [transactionStatus, txType, refetchFiles]);

  // Réinitialiser également le message de succès d'upload si la transaction échoue
  useEffect(() => {
    if (transactionStatus === "error" && txType === "upload") {
      setUploadSuccess(null);
    }
  }, [transactionStatus, txType]);

  // Réinitialiser automatiquement le message de succès après 5 secondes
  useEffect(() => {
    if (uploadSuccess) {
      const timer = setTimeout(() => {
        setUploadSuccess(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess]);

  const handleValidateDeposit = () => {
    // Vérifier que le montant est valide
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositAmountError("Le montant de la caution doit être supérieur à 0");
      return;
    }
    
    // Vérifier que les documents obligatoires sont présents
    if (!hasLeaseDoc) {
      toast({
        title: "Document manquant",
        description: "Vous devez déposer le bail avant de valider la caution",
        variant: "destructive"
      });
      return;
    }
    
    if (!hasEntryInventoryDoc) {
      toast({
        title: "Document manquant",
        description: "Vous devez déposer l'état des lieux d'entrée avant de valider la caution",
        variant: "destructive"
      });
      return;
    }

    // Réinitialiser l'erreur
    setDepositAmountError(null);

    try {
      setTransactionStatus("pending");
      setTxType("validate");
      setError(null);
      
      // Mettre à jour le montant de la caution
      writeValidateContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "setDepositAmount",
        args: [BigInt(Number(effectiveDepositId)), parseEther(depositAmount)],
      });
      
      console.log("Mise à jour du montant de la caution:", {
        depositId: Number(effectiveDepositId),
        amount: depositAmount
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du montant de la caution:", error);
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de la mise à jour du montant de la caution.");
    }
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
    console.log("État actuel de currentDepositId:", currentDepositId, typeof currentDepositId);
    console.log("État actuel de eventDepositId:", eventDepositId, typeof eventDepositId);
    console.log("État actuel de effectiveDepositId:", effectiveDepositId, typeof effectiveDepositId);

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

      // Vérifier si un dépôt existe pour cette propriété
      if (effectiveDepositId && Number(effectiveDepositId) > 0) {
        writeContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: SMART_DEPOSIT_ABI,
          functionName: "addDepositFile",
          args: [BigInt(Number(effectiveDepositId)), fileTypeEnum, cid, fileName],
        });
      } else {
        setTransactionStatus("error");
        setError("Impossible d'ajouter un fichier : la caution n'existe pas encore.");
        return;
      }

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
    if (!property || !effectiveDepositId || Number(effectiveDepositId) === 0) {
      console.error("Impossible de restituer la caution", {
        propertyExists: !!property,
        currentDepositId: effectiveDepositId ? Number(effectiveDepositId) : 0
      });
      setRefundErrorMessage("Impossible de restituer la caution. Aucun ID de dépôt valide trouvé.");
      return;
    }

    try {
      console.log("Initialisation de la restitution de caution pour le dépôt:", Number(effectiveDepositId));
      console.log("Détails de la transaction:", {
        address: CONTRACT_ADDRESS,
        functionName: "refundDeposit",
        args: [BigInt(Number(effectiveDepositId))],
        currentDepositIdType: typeof effectiveDepositId,
        parsedDepositId: BigInt(Number(effectiveDepositId)).toString()
      });

      setTransactionStatus("pending");
      setTxType("refund");
      setError(null);
      setRefundErrorMessage(null);

      // Exécution de la transaction
      writeRefundContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "refundDeposit",
        args: [BigInt(Number(effectiveDepositId))],
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
        args: [BigInt(Number(effectiveDepositId))],
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
    if (!property || !effectiveDepositId || Number(effectiveDepositId) === 0 || !refundAmount || !depositDetails?.amount) return;

    try {
      setTransactionStatus("pending");
      setTxType("resolve");
      setError(null);

      writeResolveContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: SMART_DEPOSIT_ABI,
        functionName: "resolveDispute",
        args: [BigInt(Number(effectiveDepositId)), parseEther(refundAmount)],
      });
    } catch (error) {
      console.error("Erreur lors de la résolution du litige:", error);
      setTransactionStatus("error");
      setError("Une erreur s'est produite lors de l'envoi de la transaction de résolution de litige.");
    }
  };

  const handleRefundAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    setRefundAmount(newAmount);
    
    // Vérifier si le montant est valide
    if (newAmount === "") {
      setRefundAmountError(null);
      return;
    }

    const amount = parseFloat(newAmount);
    const depositAmount = depositDetails?.amount ? parseFloat(depositDetails.amount) : 0;

    if (isNaN(amount) || amount < 0) {
      setRefundAmountError("Le montant doit être un nombre positif");
      return;
    }

    if (amount > depositAmount) {
      setRefundAmountError(`Le montant ne peut pas dépasser la caution (${depositAmount} ETH)`);
      return;
    }

    setRefundAmountError(null);
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
      case "create":
        return "Caution créée avec succès !";
      case "validate":
        return "Caution validée avec succès !";
      case "upload":
        return "Fichier enregistré avec succès!";
      default:
        return "Transaction effectuée avec succès!";
    }
  };

  // Effet pour rafraîchir automatiquement les données après une transaction réussie
  useEffect(() => {
    if (transactionStatus === "success") {
      // Si c'était une résolution de litige, on rafraîchit les données du dépôt
      if (txType === "resolve" || txType === "refund" || txType === "dispute") {
        if (refetchDepositData) {
          refetchDepositData();
        }
      }
    }
  }, [transactionStatus, txType, refetchDepositData]);

  // Effet pour masquer automatiquement le message Kleros après 5 secondes
  useEffect(() => {
    if (showKlerosMessage) {
      const timer = setTimeout(() => {
        setShowKlerosMessage(false);
      }, 4000);

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

  // Ajouter le formulaire de dépôt d'état des lieux de sortie
  const [showExitInventoryForm, setShowExitInventoryForm] = useState(false);

  const handleShowExitInventoryForm = () => {
    setShowExitInventoryForm(true);
  };

  const handleCancelExitInventoryForm = () => {
    setShowExitInventoryForm(false);
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
            <Button onClick={() => router.push("/dashboard")}>
              Retour au tableau de bord
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
            <h1 className="text-base text-gray-500 mb-4">Chargement des détails du bien...</h1>
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
            <Button onClick={() => router.push("/dashboard")}>
              Retour au tableau de bord
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Si l'utilisateur n'est pas le propriétaire, rediriger vers le tableau de bord
  if (!isLandlord) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Accès non autorisé</h1>
            <p className="text-gray-500 mb-6">Vous n'êtes pas le propriétaire de ce bien.</p>
            <Button onClick={() => router.push("/dashboard")}>
              Retour au tableau de bord
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
                  ) : txType === "delete" ? (
                    <Button onClick={() => router.push("/dashboard")} variant="default">
                      Retour au tableau de bord
                    </Button>
                  ) : (
                    <Button onClick={resetTransaction} variant="outline">
                      Continuer
                    </Button>
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
                  <CardTitle>Caution</CardTitle>
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
                            Déposer le bail*
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
                            Déposer l'état des lieux d'entrée*
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

                      {/* Bouton masqué temporairement - sera géré plus tard */}
                      <div style={{ display: 'none' }}>
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
                            disabled={!(effectiveDepositId && depositDetails && depositDetails.status >= DepositStatus.PAID)}
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
                        <Label htmlFor="depositAmount" className="whitespace-nowrap">Montant de la caution (ETH)*</Label>
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

                    {!isFormValid && (
                      <Alert className="bg-yellow-50 border-yellow-200 mt-2">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <AlertTitle>Informations manquantes</AlertTitle>
                        <AlertDescription>
                          Veuillez fournir tous les éléments obligatoires (marqués par *) avant de valider la caution :
                          <ul className="list-disc pl-5 mt-2">
                            {!hasLeaseDoc && <li>Le bail</li>}
                            {!hasEntryInventoryDoc && <li>L'état des lieux d'entrée</li>}
                            {(isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) <= 0) && <li>Un montant de caution valide</li>}
                          </ul>
                        </AlertDescription>
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
                  <Button 
                    onClick={handleValidateDeposit} 
                    disabled={!isFormValid}
                  >
                    Valider la caution
                  </Button>
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
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{property.name} - {property.status}</CardTitle>
                    <CardDescription className="flex items-center text-base">
                      <MapPin className="h-4 w-4 mr-1" /> {property.location}
                    </CardDescription>
                  </div>
                  <div>
                    <p className="flex items-center text-sm font-medium mb-2 text-gray-700">
                      <Wallet className="h-4 w-4 mr-1" />
                      Caution associée
                    </p>
                    <div className="text-right">
                      {typeof effectiveDepositId !== 'undefined' && depositDetails && Number(effectiveDepositId) > 0 ? (
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
                          <Ban className="h-4 w-4 ml-1 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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

                {typeof effectiveDepositId !== 'undefined' && depositDetails && Number(effectiveDepositId) > 0 && depositDetails.status === DepositStatus.PENDING && (
                  <>
                    {/* Si la caution a un montant défini, elle est validée et en attente de paiement */}
                    {depositDetails.amount && parseFloat(depositDetails.amount) > 0 ? (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                        <AlertTitle>Caution en attente de paiement</AlertTitle>
                        <AlertDescription>
                          Une demande de caution a été créée pour ce bien. Le locataire doit maintenant
                          utiliser le code QR ou le code unique pour effectuer son paiement.
                        </AlertDescription>
                      </Alert>
                    ) : isLandlord ? (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        <AlertTitle>Caution créée mais non configurée</AlertTitle>
                        <AlertDescription>
                          Vous devez compléter la configuration de la caution en ajoutant les documents obligatoires 
                          et en définissant le montant avant de pouvoir la partager avec le locataire.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </>
                )}

                {typeof effectiveDepositId !== 'undefined' && depositDetails && Number(effectiveDepositId) > 0 &&
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
                      {!effectiveDepositId && files.length === 0 && (
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
                      {effectiveDepositId && depositDetails && Number(effectiveDepositId) > 0 &&
                        depositDetails.status === DepositStatus.PENDING ? (
                        <>
                          {/* Si la caution a un montant défini, afficher le bouton de QR code */}
                          {depositDetails.amount && parseFloat(depositDetails.amount) > 0 ? (
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
                            >
                              Voir le code QR
                            </Button>
                          ) : (
                            /* Si la caution n'a pas de montant défini, afficher le bouton pour compléter la configuration */
                            <Button
                              onClick={() => setShowDepositRequestForm(true)}
                              size="sm"
                            >
                              Configurer la caution
                            </Button>
                          )}
                        </>
                      ) : (!effectiveDepositId || (depositDetails &&
                        [DepositStatus.REFUNDED, DepositStatus.PARTIALLY_REFUNDED, DepositStatus.RETAINED].includes(depositDetails.status))) && (
                        <Button
                          onClick={handleCreateDeposit}
                          size="sm"
                          disabled={isFormDisabled}
                        >
                          {isFormDisabled && txType === "create" ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              En cours...
                            </>
                          ) : (
                            "Créer la caution"
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {(property.status === "Loué" || property.statusCode === PropertyStatus.RENTED) && depositDetails && depositDetails.status === DepositStatus.PAID && isLandlord && (
                  <div className="flex space-x-3 mt-3">
                    {!isExitInventoryAvailable ? (
                      <Button
                        onClick={handleShowExitInventoryForm}
                        size="sm"
                      >
                        Déposer l'état des lieux de sortie
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={handleRefundDeposit}
                          size="sm"
                          disabled={isFormDisabled}
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
                      </>
                    )}
                  </div>
                )}

                {(property.status === "En litige" || property.statusCode === PropertyStatus.DISPUTED) && isLandlord && depositDetails && depositDetails.status === DepositStatus.DISPUTED && (
                  <div className="flex space-x-3 mt-3">
                    <Button
                      onClick={handleShowRefundForm}
                      size="sm"
                    >
                      Règlement amiable
                    </Button>
                    <Button
                      onClick={() => setShowKlerosMessage(true)}
                      variant="outline"
                      size="sm"
                    >
                      Transfert à Kleros
                    </Button>
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

        {/* Formulaire de remboursement */}
        {showRefundForm && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Règlement amiable</CardTitle>
              <CardDescription>Veuillez définir le montant à rembourser au locataire</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="refundAmount" className="whitespace-nowrap">Montant à rembourser (ETH)</Label>
                  <Input
                    id="refundAmount"
                    type="number"
                    value={refundAmount}
                    onChange={handleRefundAmountChange}
                    className="w-40"
                  />
                </div>

                {refundAmountError && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>{refundAmountError}</AlertDescription>
                  </Alert>
                )}

                {depositDetails?.amount && (
                  <div className="text-sm text-gray-500">
                    Montant total de la caution: {depositDetails.amount} ETH
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setShowRefundForm(false)}
                className="flex items-center"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
              <Button
                onClick={handleResolveDispute}
                disabled={!refundAmount || !!refundAmountError || isFormDisabled}
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
            </CardFooter>
          </Card>
        )}

        {/* Section des fichiers uploadés - visible par tous */}
        <Card className="mt-8">
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

        {/* Formulaire de dépôt d'état des lieux de sortie */}
        {showExitInventoryForm && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>État des lieux de sortie</CardTitle>
              <CardDescription>Veuillez déposer l'état des lieux de sortie et les photos éventuelles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
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
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Déposer l'état des lieux de sortie*
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
                        Déposer des photos (optionnel)
                      </Button>
                    </label>
                  </div>
                </div>

                {uploadExitInventoryError && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <AlertTitle>Erreur d'upload</AlertTitle>
                    <AlertDescription>{uploadExitInventoryError}</AlertDescription>
                  </Alert>
                )}

                {uploadSuccess && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-5 w-5 text-blue-500" />
                    <AlertTitle>Transaction envoyée</AlertTitle>
                    <AlertDescription>{uploadSuccess}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleCancelExitInventoryForm}
                className="flex items-center"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  )
}

