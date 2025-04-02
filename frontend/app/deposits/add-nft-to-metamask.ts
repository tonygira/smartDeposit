import { ethers } from 'ethers';

/**
 * Fonction pour ajouter un NFT à MetaMask
 * @param nftAddress Adresse du contrat NFT
 * @param tokenId ID du token NFT
 * @returns Promise<boolean> true si le NFT a été ajouté avec succès
 */
export async function addNFTToMetaMask(nftAddress: string, tokenId: string): Promise<boolean> {
  try {
    // Vérifier si MetaMask est installé
    if (!window.ethereum) {
      alert('MetaMask n\'est pas installé !');
      return false;
    }
    
    // Demander à l'utilisateur de connecter son wallet si ce n'est pas déjà fait
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    
    // Demander à MetaMask d'ajouter le NFT
    const wasAdded = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC721',
        options: {
          address: nftAddress,
          tokenId: tokenId
        },
      },
    });
    
    return wasAdded;
  } catch (error) {
    console.error('Erreur lors de l\'ajout du NFT à MetaMask:', error);
    return false;
  }
}

/**
 * Vérifie si l'utilisateur possède un NFT spécifique
 * @param nftAddress Adresse du contrat NFT
 * @param tokenId ID du token NFT
 * @param userAddress Adresse de l'utilisateur
 * @returns Promise<boolean> true si l'utilisateur possède le NFT
 */
export async function checkNFTOwnership(
  nftAddress: string, 
  tokenId: string, 
  userAddress: string
): Promise<boolean> {
  try {
    if (!window.ethereum) return false;
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    
    // Interface minimale pour ERC721
    const erc721Interface = new ethers.Interface([
      'function ownerOf(uint256 tokenId) view returns (address)'
    ]);
    
    const nftContract = new ethers.Contract(nftAddress, erc721Interface, provider);
    console.log('nftContract', nftContract);
    
    // Vérifier le propriétaire du NFT
    const owner = await nftContract.ownerOf(tokenId);
    
    // Comparer les adresses (en minuscules pour éviter les problèmes de casse)
    console.log('owner', owner);
    console.log('userAddress', userAddress);
    
    return owner.toLowerCase() === userAddress.toLowerCase();
  } catch (error) {
    console.error('Erreur lors de la vérification de propriété du NFT:', error);
    return false;
  }
} 