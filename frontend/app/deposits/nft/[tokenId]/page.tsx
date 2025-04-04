'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CONTRACT_ADDRESS, SMART_DEPOSIT_ABI, DepositStatus } from '@/lib/contract';
import { Header } from '@/components/header';
import { ArrowLeft, ImageIcon, Copy, CheckCircle, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function NFTDetails() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAccount();
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState(false);
  const [showBurnDialog, setShowBurnDialog] = useState(false);
  const [canBurn, setCanBurn] = useState(false);
  
  const tokenId = params.tokenId as string;
  
  // Récupérer l'adresse du contrat DepositNFT
  const { data: depositNFTAddress } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: SMART_DEPOSIT_ABI,
    functionName: "depositNFT",
  });
  
  // Une fois l'adresse obtenue, récupérer l'URI du token
  const { data: tokenURI, isLoading: isTokenURILoading } = useReadContract({
    address: depositNFTAddress as `0x${string}`,
    abi: [{
      name: "tokenURI",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "_tokenId", type: "uint256" }],
      outputs: [{ name: "", type: "string" }]
    }],
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
    enabled: Boolean(depositNFTAddress)
  });
  
  // Récupérer le propriétaire du NFT
  const { data: ownerAddress, isLoading: isOwnerLoading } = useReadContract({
    address: depositNFTAddress as `0x${string}`,
    abi: [{
      name: "ownerOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "tokenId", type: "uint256" }],
      outputs: [{ name: "", type: "address" }]
    }],
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
    enabled: Boolean(depositNFTAddress)
  });
  
  // Pour brûler le NFT
  const { data: burnHash, isPending: isBurnPending, writeContract: writeBurnContract } = useWriteContract();
  
  const { isLoading: isBurnConfirming, isSuccess: isBurnConfirmed } = useWaitForTransactionReceipt({
    hash: burnHash,
  });
  
  // Décoder l'URI du token pour obtenir les métadonnées
  useEffect(() => {
    if (!isTokenURILoading && tokenURI) {
      try {
        if (typeof tokenURI === 'string' && tokenURI.startsWith("data:application/json;base64,")) {
          const base64Data = tokenURI.replace("data:application/json;base64,", "");
          const jsonString = atob(base64Data);
          const jsonData = JSON.parse(jsonString);
          
          setMetadata(jsonData);
          setLoading(false);
        } else if (typeof tokenURI === 'string') {
          // Pour les URI non-base64 (moins probable dans notre cas)
          fetch(tokenURI)
            .then(res => res.json())
            .then(data => {
              setMetadata(data);
              setLoading(false);
            })
            .catch(err => {
              setError(`Erreur lors du chargement des métadonnées: ${err.message}`);
              setLoading(false);
            });
        }
      } catch (err) {
        setError(`Erreur de décodage: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      }
    } else if (!isTokenURILoading && !tokenURI) {
      setError("URI du token non disponible");
      setLoading(false);
    }
  }, [tokenURI, isTokenURILoading]);
  
  // Vérifier si l'utilisateur peut brûler le NFT
  useEffect(() => {
    if (metadata && ownerAddress) {
      // Vérifier si l'utilisateur connecté est le propriétaire du NFT
      const isOwner = address && ownerAddress && (ownerAddress.toLowerCase() === address.toLowerCase());
      
      // Rechercher l'attribut de statut dans les métadonnées
      const statusAttr = metadata.attributes?.find((attr: any) => attr.trait_type === "Statut");
      const depositStatus = statusAttr?.value;
      
      // L'utilisateur peut brûler s'il est le propriétaire et si le statut de la caution est Remboursée, Partiellement remboursée ou Conservée
      setCanBurn(isOwner && (
        depositStatus === "Remboursée" || 
        depositStatus === "Partiellement remboursée" || 
        depositStatus === "Conservée"
      ));
    }
  }, [metadata, ownerAddress, address]);
  
  // Redirection après une action de brûlage réussie
  useEffect(() => {
    if (isBurnConfirmed) {
      router.push('/deposits');
    }
  }, [isBurnConfirmed, router]);
  
  const handleGoBack = () => {
    router.back();
  };
  
  const handleBurnNFT = () => {
    if (!depositNFTAddress || !tokenId) return;
    
    writeBurnContract({
      address: depositNFTAddress as `0x${string}`,
      abi: [{
        name: "burn",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: []
      }],
      functionName: "burn",
      args: [BigInt(tokenId)],
    });
    
    setShowBurnDialog(false);
  };
  
  // Fonctions pour copier dans le presse-papier
  const copyToClipboard = (text: string, type: 'address' | 'tokenId') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'address') {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedTokenId(true);
        setTimeout(() => setCopiedTokenId(false), 2000);
      }
    });
  };
  
  // Ajouter une fonction pour tronquer les adresses
  const shortenAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
  };
  
  // Ajouter une fonction utilitaire pour formater les dates Unix
  const formatDate = (timestamp: string) => {
    if (!timestamp || timestamp === '0') return 'Non définie';
    
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Ajouter une fonction pour convertir wei en ETH
  const formatAmount = (amount: string) => {
    if (!amount) return '0';
    
    try {
      // Tenter de convertir numériquement
      const amountInWei = BigInt(amount);
      if (amountInWei === BigInt(0)) return '0 ETH';
      
      // Convertir en ETH (18 décimales)
      const amountInEth = Number(amountInWei) / 10**18;
      return `${amountInEth} ETH`;
    } catch (e) {
      // Si ce n'est pas un nombre, retourner tel quel
      return amount;
    }
  };
  
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="ghost" 
            onClick={handleGoBack}
            className="flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          
          {canBurn && (
            <Dialog open={showBurnDialog} onOpenChange={setShowBurnDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="flex items-center"
                  disabled={isBurnPending || isBurnConfirming}
                >
                  <Flame className="mr-2 h-4 w-4" />
                  Brûler
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmer la destruction du NFT</DialogTitle>
                  <DialogDescription>
                    Êtes-vous sûr de vouloir brûler ce NFT ? Cette action est irréversible et supprimera définitivement ce NFT de votre portefeuille.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setShowBurnDialog(false)}>Annuler</Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleBurnNFT}
                    disabled={isBurnPending || isBurnConfirming}
                  >
                    {isBurnPending || isBurnConfirming ? 'En cours...' : 'Confirmer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary rounded-full"></div>
          </div>
        ) : error ? (
          <Card className="max-w-xl mx-auto">
            <CardContent className="py-8">
              <div className="text-center text-red-500">{error}</div>
            </CardContent>
          </Card>
        ) : metadata ? (
          <>
            {/* Bloc d'instructions pour ajouter le NFT au wallet */}
            <Alert className="mb-6 max-w-xl mx-auto bg-purple-50 border-purple-200">
              <AlertDescription>
                <p className="mb-3">Ce NFT est unique et vous appartient. S'il n'apparait pas automatiquement dans votre wallet, vous pouvez l'importer manuellement en renseignant les informations suivantes :</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Adresse :</span> 
                    <div className="flex items-center">
                      <span className="mr-2 bg-white px-2 py-1 rounded border">
                        {depositNFTAddress ? depositNFTAddress as string : '...'}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8" 
                              onClick={() => depositNFTAddress && copyToClipboard(depositNFTAddress as string, 'address')}
                              disabled={!depositNFTAddress}
                            >
                              {copiedAddress ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{copiedAddress ? 'Copié !' : 'Copier l\'adresse'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">ID du token :</span>
                    <div className="flex items-center">
                      <span className="mr-2 bg-white px-2 py-1 rounded border">{tokenId}</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8" 
                              onClick={() => copyToClipboard(tokenId, 'tokenId')}
                            >
                              {copiedTokenId ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{copiedTokenId ? 'Copié !' : 'Copier l\'ID'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
            
            <Card className="max-w-xl mx-auto">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{metadata.name}</CardTitle>
                    <CardDescription>{metadata.description}</CardDescription>
                  </div>
                  <Badge variant="outline">NFT #{tokenId}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Image - encore plus réduite */}
                <div className="flex justify-center">
                  {metadata.image ? (
                    <div className="relative w-full max-w-[200px] aspect-square border rounded-md overflow-hidden bg-gray-100">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <img 
                        src={metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")} 
                        alt={metadata.name}
                        className="w-full h-full object-contain relative z-10"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-[200px] aspect-square border rounded-md flex items-center justify-center bg-gray-100">
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>
                
                <Separator />
                
                {/* Attributs */}
                <div>
                  <h3 className="text-base font-medium mb-3">Attributs</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {metadata.attributes && metadata.attributes.map((attr: any, index: number) => {
                      // Formater les valeurs spéciales
                      let formattedValue = attr.value;
                      
                      // Si c'est un montant
                      if (attr.trait_type === "Montant Initial" || attr.trait_type === "Montant Remboursé") {
                        formattedValue = formatAmount(attr.value);
                      }
                      
                      // Si c'est une date
                      if (attr.trait_type === "Date de Paiement" || attr.trait_type === "Date de Remboursement") {
                        formattedValue = formatDate(attr.value);
                      }
                      
                      // Si c'est une adresse
                      if (attr.trait_type === "Locataire" || attr.trait_type === "Propriétaire") {
                        formattedValue = shortenAddress(attr.value);
                      }
                      
                      return (
                        <div key={index} className="bg-purple-50 border border-purple-100 p-2 rounded-md text-sm">
                          <p className="text-xs text-gray-500">{attr.trait_type}</p>
                          <p className="font-medium">{formattedValue}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="max-w-xl mx-auto">
            <CardContent className="py-8">
              <div className="text-center">Aucune donnée disponible</div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}