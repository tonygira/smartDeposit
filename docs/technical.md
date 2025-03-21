# Documentation Technique - Smart Deposit

## Technologies utilisées
- **Frontend**: Next.js, React, TypeScript, wagmi, viem
- **Smart Contract**: Solidity 0.8.28
- **Développement blockchain**: Hardhat
- **Style**: Tailwind CSS, shadcn/ui
- **Réseau**: Sepolia Testnet

## Structure du projet
- `/frontend`: Application Next.js pour l'interface utilisateur
- `/backend`: Contrats intelligents et configuration Hardhat

## Smart Contracts
### SmartDeposit.sol
Le contrat principal qui gère les biens immobiliers et leurs cautions.

#### Fonctions principales
- `createProperty(string name, string location, uint256 depositAmount)`: Crée un nouveau bien
- `makeDeposit(uint256 propertyId)`: Verse une caution pour un bien
- `refundDeposit(uint256 propertyId)`: Rembourse une caution
- `initiateDispute(uint256 propertyId)`: Démarre un litige
- `resolveDispute(uint256 propertyId, bool favorTenant)`: Résout un litige

## Configuration
### Variables d'environnement
```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
PRIVATE_KEY=...
ETHERSCAN_API_KEY=...
```

## Déploiement
### Déployer le contrat
```
cd backend
npx hardhat run scripts/deploy.js --network sepolia --verify
```

### Déployer le frontend
```
cd frontend
npm run build
npm run start
```

## Tests
```
cd backend
npx hardhat test
```

## API du Smart Contract

### Propriétés
| Fonction | Description | Paramètres |
|----------|-------------|------------|
| `createProperty` | Crée un nouveau bien immobilier | name (string), location (string), depositAmount (uint256) |
| `getPropertyDetails` | Récupère les détails d'un bien | propertyId (uint256) |
| `getLandlordProperties` | Récupère tous les biens d'un propriétaire | landlord (address) |
| `getTenantProperties` | Récupère tous les biens loués par un locataire | tenant (address) |
| `deleteProperty` | Supprime un bien (uniquement par le propriétaire et si non loué) | propertyId (uint256) |

### Cautions
| Fonction | Description | Paramètres |
|----------|-------------|------------|
| `makeDeposit` | Dépose une caution pour un bien | propertyId (uint256) |
| `refundDeposit` | Rembourse une caution (uniquement par le propriétaire) | propertyId (uint256) |
| `getDepositStatus` | Récupère l'état d'une caution | propertyId (uint256) |

### Litiges
| Fonction | Description | Paramètres |
|----------|-------------|------------|
| `initiateDispute` | Démarre un litige sur une caution | propertyId (uint256) |
| `resolveDispute` | Résout un litige | propertyId (uint256), favorTenant (bool) |

## Dépendances
- @nomicfoundation/hardhat-toolbox
- @rainbow-me/rainbowkit
- wagmi
- viem
- next
- react
- tailwindcss
- shadcn/ui 