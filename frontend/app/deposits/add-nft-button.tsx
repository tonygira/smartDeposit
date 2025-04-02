'use client';

import { useState } from 'react';
import { addNFTToMetaMask, checkNFTOwnership } from './add-nft-to-metamask';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';

interface AddNFTButtonProps {
  nftAddress: string;
  tokenId: string;
  userAddress: string;
  className?: string;
}

export default function AddNFTButton({ 
  nftAddress, 
  tokenId, 
  userAddress,
  className = '' 
}: AddNFTButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const handleAddNFT = async () => {
    setIsAdding(true);
    setErrorMessage('');
    
    try {
      // Vérifier d'abord si l'utilisateur possède ce NFT
      const isOwner = await checkNFTOwnership(nftAddress, tokenId, userAddress);

      console.log('nftAddress', nftAddress);
      console.log('tokenId', tokenId);
      console.log('userAddress', userAddress);
      console.log('isOwner', isOwner);
      
      if (!isOwner) {
        setErrorMessage('Vous ne semblez pas être le propriétaire de ce NFT.');
        setIsAdding(false);
        return;
      }
      
      // Ajouter le NFT à MetaMask
      const success = await addNFTToMetaMask(nftAddress, tokenId);
      
      if (success) {
        setAdded(true);
        setTimeout(() => setAdded(false), 3000); // Reset après 3 secondes
      } else {
        setErrorMessage('MetaMask a refusé d\'ajouter le NFT.');
      }
    } catch (error) {
      console.error('Erreur:', error);
      setErrorMessage('Une erreur est survenue. Vérifiez que MetaMask est connecté.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className={className}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddNFT}
              disabled={isAdding}
              className={`relative rounded-full p-2 transition-colors ${added ? 'bg-green-100' : ''}`}
            >
              {isAdding ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500" />
              ) : (
                <Image 
                  src="/images/metamask-fox.svg" 
                  alt="Ajouter à MetaMask" 
                  width={24} 
                  height={24} 
                  className="h-5 w-5"
                />
              )}
              {added && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {added ? "NFT ajouté à MetaMask!" : errorMessage || "Ajouter ce NFT à MetaMask"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
} 