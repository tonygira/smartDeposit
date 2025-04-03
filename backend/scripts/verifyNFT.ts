import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  let tenantAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
//   let depositNFTAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
    let depositNFTAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Adresse par défaut
  
  console.log("Compte utilisé pour la vérification:", deployer.address);
  console.log("Adresse du locataire à vérifier:", tenantAddress);
  console.log("Vérification du NFT à l'adresse:", depositNFTAddress);

  // Récupérer le contrat avec son adresse
  const DepositNFT = await ethers.getContractFactory("DepositNFT");
  const depositNFT = DepositNFT.attach(depositNFTAddress);

  try {
    // Vérifier que le contrat a été initialisé
    let smartDepositAddress;
    try {
      smartDepositAddress = await depositNFT.getSmartDepositAddress();
      console.log(`\nContrat SmartDeposit associé: ${smartDepositAddress}`);
      
      // Récupérer le contrat SmartDeposit pour afficher plus d'informations
      const SmartDeposit = await ethers.getContractFactory("SmartDeposit");
      const smartDeposit = SmartDeposit.attach(smartDepositAddress);
      console.log("Contrat SmartDeposit récupéré avec succès");
    } catch (error) {
      console.log("\nLe contrat DepositNFT n'a pas encore été initialisé avec SmartDeposit");
    }

    // Vérifier le nombre de NFTs du locataire
    const balance = await depositNFT.balanceOf(tenantAddress);
    console.log(`\nNombre de NFTs détenus par le locataire : ${balance}`);

    // Vérifier le nombre total de tokens émis
    const totalTokens = await depositNFT.getCurrentTokenCount();
    console.log(`Nombre total de tokens émis dans le système : ${totalTokens}`);

    // Si le locataire a des NFTs, afficher leurs détails en utilisant tokenOfOwnerByIndex
    if (balance > 0n) {
      for (let i = 0; i < Number(balance); i++) {
        try {
          // Utiliser la fonction tokenOfOwnerByIndex disponible grâce à ERC721Enumerable
          const tokenId = await depositNFT.tokenOfOwnerByIndex(tenantAddress, i);
          console.log(`\n=== Détails du NFT #${i + 1} ===`);
          console.log(`Token ID: ${tokenId}`);
          
          try {
            const depositId = await depositNFT.getDepositIdFromToken(tokenId);
            console.log(`Deposit ID associé: ${depositId}`);
            
            // Si nous avons le contrat SmartDeposit, obtenons plus d'informations sur le dépôt
            if (smartDepositAddress) {
              const SmartDeposit = await ethers.getContractFactory("SmartDeposit");
              const smartDeposit = SmartDeposit.attach(smartDepositAddress);
              
              try {
                const extendedInfo = await smartDeposit.getExtendedDepositInfoForNFT(depositId);
                console.log("\nInformations détaillées du dépôt:");
                console.log(`- ID Propriété: ${extendedInfo[0]}`);
                console.log(`- Adresse du locataire: ${extendedInfo[1]}`);
                console.log(`- Montant: ${ethers.formatEther(extendedInfo[2])} ETH`);
                
                // Afficher le statut sous forme textuelle
                const statusMap = ["En attente", "Payée", "Disputée", "Retenue", "Partiellement remboursée", "Remboursée"];
                console.log(`- Statut: ${statusMap[Number(extendedInfo[3])]}`);
                
                // Afficher les dates si disponibles
                if (extendedInfo[4] > 0n) {
                  const paymentDate = new Date(Number(extendedInfo[4]) * 1000);
                  console.log(`- Date de paiement: ${paymentDate.toLocaleString()}`);
                }
                
                if (extendedInfo[5] > 0n) {
                  const refundDate = new Date(Number(extendedInfo[5]) * 1000);
                  console.log(`- Date de remboursement: ${refundDate.toLocaleString()}`);
                  console.log(`- Montant remboursé: ${ethers.formatEther(extendedInfo[6])} ETH`);
                }
                
                console.log(`- Adresse du propriétaire: ${extendedInfo[7]}`);
              } catch (error) {
                console.log(`Erreur lors de la récupération des informations étendues: ${error.message}`);
              }
            }
          } catch (error) {
            console.log(`Erreur lors de la récupération du Deposit ID: ${error.message}`);
          }
          
          try {
            const uri = await depositNFT.tokenURI(tokenId);
            console.log("\nMétadonnées du NFT:");
            
            // Extraire et décoder les métadonnées Base64
            if (uri.startsWith("data:application/json;base64,")) {
              const base64Data = uri.replace("data:application/json;base64,", "");
              const decodedData = Buffer.from(base64Data, 'base64').toString('utf8');
              const jsonData = JSON.parse(decodedData);
              
              console.log(`\nNom: ${jsonData.name}`);
              console.log(`Description: ${jsonData.description}`);
              console.log(`Image: ${jsonData.image}`);
              console.log("\nAttributs NFT:");
              for (const attr of jsonData.attributes) {
                //Traitement spécial pour les montants pour les afficher en ETH
                if (attr.trait_type === "Montant Initial" || attr.trait_type === "Montant Remboursé") {
                    console.log(`- ${attr.trait_type}: ${ethers.formatEther(attr.value)} ETH`);
                }
                else {
                  console.log(`- ${attr.trait_type}: ${attr.value}`);
                }
              }
              
              console.log("\nJSON complet:");
              console.log(JSON.stringify(jsonData, null, 2));
            } else {
              console.log("Format d'URI non standard:", uri);
            }
          } catch (error) {
            console.log(`Erreur lors de la récupération de l'URI: ${error.message}`);
          }
        } catch (error) {
          console.log(`Erreur pour le NFT #${i+1}: ${error.message}`);
        }
      }
    } else {
      console.log("Le locataire ne possède aucun NFT.");
    }

    // Afficher les informations du contrat pour l'ajout dans MetaMask
    if (balance > 0n) {
        console.log("\n=== Informations pour ajouter le(s) NFT(s) dans MetaMask ===");
        console.log(`Adresse du contrat: ${depositNFTAddress}`);
        console.log(`le ou les ID de token(s)`);
    }
    
  } catch (error) {
    console.error("Erreur lors de la vérification du NFT:", error);
  }
}

main().catch((error) => {
  console.error(error);

  process.exitCode = 1;
}); 