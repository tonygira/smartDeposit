import axios from 'axios';

// Définition des clés API depuis les variables d'environnement
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_API_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY || '';
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || '';

/**
 * Télécharge un fichier vers IPFS via Pinata
 * @param file Le fichier à télécharger
 * @param metadata Métadonnées associées au fichier
 * @returns Le CID du fichier sur IPFS
 */
export const uploadToPinata = async (
  file: File,
  metadata: Record<string, any> = {}
) => {
  // Créer un FormData pour l'upload
  const formData = new FormData();
  formData.append('file', file);

  // Ajouter les métadonnées
  const pinataMetadata = {
    name: file.name,
    keyvalues: metadata,
  };
  formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

  try {
    // Envoyer la requête à l'API Pinata
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.IpfsHash;
  } catch (error) {
    console.error('Erreur lors de l\'upload vers Pinata:', error);
    throw error;
  }
};

/**
 * Récupère un fichier depuis IPFS via Pinata Gateway
 * @param cid Le CID du fichier sur IPFS
 * @returns Le fichier récupéré
 */
export const getFromIPFS = async (cid: string) => {
  try {
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`, {
      responseType: 'arraybuffer',
    });
    return new Blob([response.data]);
  } catch (error) {
    console.error('Erreur lors de la récupération depuis IPFS:', error);
    throw error;
  }
};