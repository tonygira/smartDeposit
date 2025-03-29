const fs = require('fs');
const path = require('path');

// Lire le fichier ABI
const abiFile = path.join(__dirname, '../lib/contract.json');
const contractFile = path.join(__dirname, '../lib/contract.ts');

// Lire le contenu du fichier ABI
const abiContent = JSON.parse(fs.readFileSync(abiFile, 'utf8'));

// Créer le contenu du fichier contract.ts
const contractContent = `// Ce fichier est généré automatiquement. Ne pas modifier manuellement.
import { parseAbi } from "viem"

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3"
export const SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || ""

export enum PropertyStatus {
  NOT_RENTED = 0,
  RENTED = 1,
  DISPUTED = 2,
}

export const getPropertyStatusText = (status: number): string => {
  switch (status) {
    case PropertyStatus.NOT_RENTED:
      return "Non loué"
    case PropertyStatus.RENTED:
      return "Loué"
    case PropertyStatus.DISPUTED:
      return "En litige"
    default:
      return "Non loué"
  }
}

export enum DepositStatus {
  PENDING = 0,
  PAID = 1,
  DISPUTED = 2,
  RETAINED = 3,
  PARTIALLY_REFUNDED = 4,
  REFUNDED = 5,
}

export function getDepositStatusText(status: number, lang: string = 'fr') {
  console.log("getDepositStatusText reçoit:", status, "de type", typeof status);

  switch (status) {
    case DepositStatus.PENDING:
      return "En attente"
    case DepositStatus.PAID:
      return "Payée"
    case DepositStatus.DISPUTED:
      return "En litige"
    case DepositStatus.REFUNDED:
      return "Remboursée"
    case DepositStatus.PARTIALLY_REFUNDED:
      return "Partiellement remboursée"
    case DepositStatus.RETAINED:
      return "Conservée"
    default:
      return "En attente"
  }
}

export const SMART_DEPOSIT_ABI = ${JSON.stringify(abiContent.abi, null, 2)}
`;

// Écrire le nouveau contenu dans contract.ts
fs.writeFileSync(contractFile, contractContent);

console.log('Fichier contract.ts mis à jour avec succès !'); 