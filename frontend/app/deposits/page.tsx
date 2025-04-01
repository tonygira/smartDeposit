"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useReadContracts } from "wagmi"
import { formatEther } from "viem"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, getDepositStatusText, DepositStatus, getPropertyStatusText } from "@/lib/contract"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { QrCode, Wallet, Calendar, Home, MapPin, User, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Coins, CheckCircle, XCircle, Clock, Loader2, FileText, ClipboardSignature, DoorOpen, DoorClosed, Image } from "lucide-react"

// Composant pour afficher les détails d'une propriété même si elle n'est pas dans l'état properties
const PropertyDetails = ({ propertyId, existingProperty }: { propertyId: number, existingProperty: any }) => {
  // Si on a déjà les données dans l'état properties, on les utilise
  if (existingProperty) {
    return (
      <div className="mt-2 grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center text-primary">
            <Home className="h-4 w-4 mr-1.5" />
            <span className="font-medium">{existingProperty.name}</span>
          </div>
          <div className="flex items-center mt-1 text-gray-500">
            <MapPin className="h-4 w-4 mr-1.5" />
            <span>{existingProperty.location}</span>
          </div>
          <div className="flex items-center mt-1 text-gray-500">
            <User className="h-4 w-4 mr-1.5" />
            <span className="text-xs">{existingProperty.landlord.slice(0, 6)}...{existingProperty.landlord.slice(-4)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Sinon, on récupère les données directement depuis le contrat
  const { data: propertyData, isLoading: isPropertyLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getProperty",
    args: [BigInt(propertyId)]
  });

  if (isPropertyLoading) {
    return (
      <div className="mt-2 flex items-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-500">Chargement des détails du bien...</span>
      </div>
    );
  }

  if (!propertyData) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-center">
          <Home className="h-4 w-4 mr-1.5 text-gray-400" />
          <span className="text-sm text-gray-600">Bien #{propertyId}</span>
        </div>
        <div className="flex items-center">
          <MapPin className="h-4 w-4 mr-1.5 text-gray-400" />
          <span className="text-sm text-gray-500">Adresse non disponible</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 grid md:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center text-primary">
          <Home className="h-4 w-4 mr-1.5" />
          <span className="font-medium">{propertyData.name}</span>
        </div>
        <div className="flex items-center mt-1 text-gray-500">
          <MapPin className="h-4 w-4 mr-1.5" />
          <span>{propertyData.location}</span>
        </div>
        <div className="flex items-center mt-1 text-gray-500">
          <User className="h-4 w-4 mr-1.5" />
          <span className="text-xs">{propertyData.landlord.slice(0, 6)}...{propertyData.landlord.slice(-4)}</span>
        </div>
      </div>
    </div>
  );
};

export default function Deposits() {
  const { address, isConnected } = useAccount()
  const [deposits, setDeposits] = useState<any[]>([])
  const [properties, setProperties] = useState<Record<number, any>>({})
  const [propertyIds, setPropertyIds] = useState<number[]>([])
  const [depositFiles, setDepositFiles] = useState<Record<number, any[]>>({})
  const router = useRouter()

  // Get deposit IDs
  const { data: depositIds, refetch: refetchDepositIds } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "getTenantDeposits",
    args: [address],
  })

  // Rafraîchir les données lorsque l'adresse change
  useEffect(() => {
    if (address) {
      // Rafraîchir la liste des dépôts
      refetchDepositIds();
      // Réinitialiser les états
      setDeposits([]);
      setProperties({});
      setPropertyIds([]);
    }
  }, [address, refetchDepositIds]);

  // Fetch deposit details
  const { data: depositsData } = useReadContracts({
    contracts: ((depositIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getDeposit",
      args: [id],
    })),
  })

  // Fetch property IDs for each deposit
  const { data: propertyIdsData } = useReadContracts({
    contracts: ((depositIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getPropertyIdFromDeposit",
      args: [id],
    })),
  })

  // Process deposit data
  useEffect(() => {
    if (depositsData) {
      const fetchedDeposits = depositsData
        .map((result, index) => {
          if (result.status === "success" && result.result) {
            try {
              const deposit = result.result as any;

              return {
                id: Number(deposit.id),
                propertyId: Number(deposit.propertyId),
                tenant: deposit.tenant,
                amount: formatEther(deposit.amount),
                finalAmount: formatEther(deposit.finalAmount),
                retainedAmount: formatEther(deposit.amount - deposit.finalAmount),
                creationDate: Number(deposit.creationDate),
                paymentDate: Number(deposit.paymentDate),
                refundDate: Number(deposit.refundDate),
                status: getDepositStatusText(Number(deposit.status)),
                statusCode: Number(deposit.status),
                depositCode: deposit.depositCode
              }
            } catch (error) {
              console.error(`Erreur lors du traitement de la caution #${index}:`, error);
              console.error("Structure des données reçues:", result.result);
              return null;
            }
          }
          return null
        })
        .filter(Boolean)
        // Tri des cautions par ordre d'ID décroissant (les plus récents en premier)
        .sort((a, b) => b.id - a.id)

      setDeposits(fetchedDeposits)
    }
  }, [depositsData])

  // Get unique property IDs from property IDs data
  useEffect(() => {
    if (propertyIdsData) {
      const uniquePropertyIds = propertyIdsData
        .filter(result => result.status === "success" && result.result)
        .map(result => Number(result.result))
        .filter((value, index, self) => self.indexOf(value) === index); // Unique values only
      
      setPropertyIds(uniquePropertyIds);
    }
  }, [propertyIdsData]);

  // Fetch property details
  const { data: propertiesData } = useReadContracts({
    contracts: propertyIds.map((propertyId) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getProperty",
      args: [BigInt(propertyId)],
    })),
  });

  // Process property data
  useEffect(() => {
    if (propertiesData) {
      const processedProperties = propertiesData
        .map((result, index) => {
          if (result.status === "success" && result.result) {
            const property = result.result;
            
            return {
              propertyId: propertyIds[index],
              data: {
                id: Number(property.id),
                landlord: property.landlord,
                name: property.name,
                location: property.location,
                status: getPropertyStatusText(property.status),
              },
            };
          }
          return null;
        })
        .filter(Boolean)
        .reduce((acc, item) => {
          if (item) {
            acc[item.propertyId] = item.data;
          }
          return acc;
        }, {} as Record<number, any>);

      setProperties(processedProperties);
    }
  }, [propertiesData, propertyIds]);

  // Fetch deposit files
  const { data: depositFilesData } = useReadContracts({
    contracts: ((depositIds as bigint[]) || []).map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: SMART_DEPOSIT_ABI as any,
      functionName: "getDepositFiles",
      args: [id],
    })),
  });

  // Process deposit files data
  useEffect(() => {
    if (depositFilesData && depositIds) {
      const filesMap: Record<number, any[]> = {};
      depositFilesData.forEach((result, index) => {
        if (result.status === "success" && result.result && depositIds) {
          const depositId = Number(depositIds[index]);
          filesMap[depositId] = result.result as any[];
        }
      });
      setDepositFiles(filesMap);
    }
  }, [depositFilesData, depositIds]);

  const getDepositStatusBadge = (statusCode: number) => {
    switch (statusCode) {
      case DepositStatus.PENDING:
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center">
            <Clock className="h-3.5 w-3.5 mr-1" />
            En attente
          </Badge>
        )
      case DepositStatus.PAID:
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center">
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Payée
          </Badge>
        )
      case DepositStatus.DISPUTED:
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            En litige
          </Badge>
        )
      case DepositStatus.REFUNDED:
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center">
            <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
            Remboursée
          </Badge>
        )
      case DepositStatus.PARTIALLY_REFUNDED:
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center">
            <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />
            Partiellement remboursée
          </Badge>
        )
      case DepositStatus.RETAINED:
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center">
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Conservée
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            Inconnue
          </Badge>
        )
    }
  }

  const handleCodeButtonClick = () => {
    router.push('/deposits/code');
  }

  // Fonction pour formater une date
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Date inconnue";
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fonction pour obtenir l'icône du type de fichier
  const getFileTypeIcon = (fileType: number) => {
    switch (fileType) {
      case 0: // Bail
        return <ClipboardSignature className="h-4 w-4 mr-1 text-indigo-600" />;
      case 1: // Photos
        return <Image className="h-4 w-4 mr-1 text-yellow-600" />;
      case 2: // État des lieux d'entrée
        return <DoorOpen className="h-4 w-4 mr-1 text-green-600" />;
      case 3: // État des lieux de sortie
        return <DoorClosed className="h-4 w-4 mr-1 text-orange-600" />;
      default:
        return <FileText className="h-4 w-4 mr-1 text-gray-600" />;
    }
  };

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
        return "Document";
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
    }
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h1 className="text-2xl font-bold mb-4">Veuillez vous connecter</h1>
            <p className="text-gray-500 mb-6">Connectez-vous pour voir vos cautions</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-3xl font-bold">Vos cautions</h1>
          <Button
            onClick={handleCodeButtonClick}
            variant="outline"
            className="flex items-center mt-4 md:mt-0"
            style={{ backgroundColor: "#7759F9", color: "white" }}
          >
            <QrCode className="mr-2 h-5 w-5" />
            J'ai un code caution
          </Button>
        </div>

        {deposits.length > 0 ? (
          <div className="flex flex-col gap-6">
            {deposits.map((deposit) => {
              const property = properties[deposit.propertyId];
              const files = depositFiles[deposit.id] || [];

              return (
                <Card
                  key={deposit.id}
                  className={`w-full shadow-sm hover:shadow-md transition-shadow duration-200 ${deposit.statusCode === DepositStatus.DISPUTED ? 'bg-red-50' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center">
                        <Wallet className="h-5 w-5 mr-2 text-primary" />
                        Caution #{deposit.id}
                      </CardTitle>
                      <div className="flex items-center space-x-4">
                        {getDepositStatusBadge(deposit.statusCode)}
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      <PropertyDetails propertyId={deposit.propertyId} existingProperty={property} />
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Première colonne - Documents */}
                      <div>
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                          <p className="flex items-center font-medium mb-3">
                            <FileText className="h-4 w-4 mr-2 text-primary" />
                            Documents
                          </p>
                          {files && files.length > 0 ? (
                            <div className="space-y-2 ml-1">
                              {files.map((file: any, index: number) => (
                                <div key={index} className="flex items-center py-1">
                                  <button
                                    onClick={() => handleDownloadFile(file.cid, file.fileName)}
                                    className="text-blue-600 hover:underline flex items-center text-sm"
                                  >
                                    {getFileTypeIcon(Number(file.fileType))}
                                    <span title={getFileTypeText(Number(file.fileType))} className="mr-1">{file.fileName}</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 ml-1 text-sm">Aucun document disponible</p>
                          )}
                        </div>
                      </div>

                      {/* Deuxième colonne - Montants et dates */}
                      <div className="space-y-4">
                        {/* Montant versé */}
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                          <div className="flex items-start">
                            <ArrowDownCircle className={`h-4 w-4 mr-2 mt-1 ${deposit.statusCode >= DepositStatus.PAID ? 'text-green-500' : 'text-blue-500'}`} />
                            <div>
                              <p className="font-medium">Montant versé</p>
                              <p className="text-lg font-semibold">{deposit.amount} ETH</p>
                              {deposit.paymentDate > 0 && (
                                <div className="flex items-center text-xs text-gray-500 mt-1">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  <span>Le {formatDate(deposit.paymentDate)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Montant remboursé/retenu */}
                        {(deposit.statusCode === DepositStatus.REFUNDED ||
                          deposit.statusCode === DepositStatus.PARTIALLY_REFUNDED ||
                          deposit.statusCode === DepositStatus.RETAINED) && (
                            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                              <div className="flex items-start">
                                <ArrowUpCircle className={`h-4 w-4 mr-2 mt-1 ${deposit.statusCode === DepositStatus.REFUNDED ? 'text-green-500' : deposit.statusCode === DepositStatus.PARTIALLY_REFUNDED ? 'text-orange-500' : 'text-red-500'}`} />
                                <div>
                                  <p className="font-medium">
                                    {deposit.statusCode === DepositStatus.RETAINED ? "Montant retenu" : "Montant remboursé"}
                                  </p>
                                  <p className="text-lg font-semibold">
                                    {deposit.statusCode === DepositStatus.RETAINED ? deposit.amount : deposit.finalAmount} ETH
                                  </p>
                                  
                                  {deposit.statusCode === DepositStatus.PARTIALLY_REFUNDED && (
                                    <div className="flex items-center mt-1.5 text-red-500 text-sm">
                                      <XCircle className="h-3.5 w-3.5 mr-1" />
                                      <span>{deposit.retainedAmount} ETH retenus</span>
                                    </div>
                                  )}
                                  
                                  {deposit.statusCode !== DepositStatus.RETAINED && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {(Number(deposit.finalAmount) / Number(deposit.amount) * 100).toFixed(1)}% de la caution
                                    </p>
                                  )}
                                  
                                  {deposit.refundDate > 0 && (
                                    <div className="flex items-center text-xs text-gray-500 mt-1">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      <span>Le {formatDate(deposit.refundDate)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-100">
            <h2 className="text-xl font-semibold mb-2">Aucune caution trouvée</h2>
            <p className="text-gray-500 mb-4">Vous n'avez pas encore déposé de caution</p>
          </div>
        )}
      </main>
    </div>
  )
}

