# Documentation Technique - Smart Deposit

## Vue d'ensemble
Smart Deposit utilise une architecture décentralisée avec deux contrats intelligents comme source de vérité et une interface utilisateur moderne qui interagit avec la blockchain Ethereum. La solution permet la gestion sécurisée des cautions locatives avec tokenisation sous forme de NFT.

## Diagramme d'architecture
```
Frontend (Next.js) <--> Blockchain (Ethereum/Sepolia) <--> Smart Contracts (SmartDeposit + DepositNFT)
             ↑                                                 ↑
             |                                                 |
        Utilisateurs                                      Données
           (UI)                                   (Biens, Cautions, NFTs)
```

## Technologies utilisées
- **Frontend**: 
  - Next.js 15.2.3
  - React 19
  - TypeScript
  - wagmi, viem, RainbowKit pour l'intégration blockchain
  - ethers.js 6.13 pour certaines opérations spécifiques
- **Smart Contract**: 
  - Solidity 0.8.28
  - OpenZeppelin 5.2
- **Développement blockchain**: 
  - Hardhat 2.22
- **Style**: 
  - Tailwind CSS 3.4
  - shadcn/ui
  - Lucide React
- **Stockage décentralisé**:
  - Pinata SDK (IPFS)
- **Réseau**: 
  - Sepolia Testnet

## Structure du projet
- `/frontend`: Application Next.js pour l'interface utilisateur
- `/backend`: Contrats intelligents et configuration Hardhat
- `/docs`: Documentation du projet

## Composants principaux

### Smart Contracts
#### SmartDeposit.sol
Le contrat principal qui gère les biens immobiliers et leurs cautions.

##### Fonctions principales
- `createProperty(string _name, string _location)`: Crée un nouveau bien
- `createDeposit(uint256 _propertyId, string _depositCode)`: Crée une nouvelle demande de caution
- `setDepositAmount(uint256 _depositId, uint256 _amount)`: Définit le montant de la caution
- `payDeposit(uint256 _depositId, string _depositCode)`: Paie une caution (fonction payable)
- `refundDeposit(uint256 _depositId)`: Rembourse une caution intégralement
- `initiateDispute(uint256 _depositId)`: Démarre un litige
- `resolveDispute(uint256 _depositId, DepositStatus _finalStatus, uint256 _refundedAmount)`: Résout un litige
- `addDepositFile(uint256 _depositId, FileType _fileType, string _cid, string _fileName)`: Ajoute un fichier à une caution

#### DepositNFT.sol
Contrat ERC-721 qui représente les cautions sous forme de NFT avec métadonnées dynamiques.

##### Fonctions principales
- `initialize(address smartDepositAddress)`: Initialise le contrat avec l'adresse SmartDeposit
- `mintDepositNFT(uint256 _depositId, address _owner)`: Crée un nouveau NFT pour une caution
- `updateTokenMetadata(uint256 _depositId)`: Met à jour les métadonnées du NFT
- `tokenURI(uint256 _tokenId)`: Génère les métadonnées du NFT avec représentation visuelle
- `burn(uint256 tokenId)`: Permet au propriétaire de brûler son NFT
- `getTokenIdFromDeposit(uint256 _depositId)`: Récupère l'ID du token associé à une caution
- `getDepositIdFromToken(uint256 _tokenId)`: Récupère l'ID de la caution associée à un token

### Frontend
- **Pages**:
  - Accueil (`/`): Présentation et navigation principale
  - Dashboard (`/dashboard`): Tableau de bord pour les propriétaires
  - Deposits (`/deposits`): Gestion des cautions pour les locataires
  - Property Details (`/properties/[id]`): Détails et actions sur un bien spécifique
  - Create Property (`/properties/create`): Formulaire de création d'un bien

- **Composants**:
  - Header: Navigation et connexion wallet
  - Cards: Affichage des informations structurées
  - TransactionStatusCard: Suivi des transactions en cours
  - Buttons: Actions utilisateur avec états de chargement

### État de l'application
- **Blockchain**: Source de vérité pour toutes les données
- **React State**: État temporaire pour l'interface utilisateur
- **Hooks wagmi**: Interface avec la blockchain

## Flux de données
1. L'utilisateur interagit avec l'interface
2. Les actions déclenchent des transactions blockchain
3. Les contrats intelligents exécutent la logique métier
4. L'état de l'application est mis à jour via des événements
5. L'interface utilisateur reflète les changements

## Sécurité
- Toutes les transactions sont signées par le wallet de l'utilisateur
- Les fonds sont gérés par les contrats intelligents
- Les règles métier sont appliquées au niveau du contrat
- Les droits d'accès sont contrôlés via des modifiers spécifiques
- Aucune donnée sensible n'est stockée en dehors de la blockchain
- **Note**: Les fichiers IPFS ne sont pas encore chiffrés dans cette version (fonctionnalité prévue)

## Structure des données

### Entités du Smart Contract
```
Property {
  uint256 id;
  uint256 currentDepositId;
  address landlord;
  string name;
  string location;
  PropertyStatus status; // Enum: NOT_RENTED, RENTED, DISPUTED
}

Deposit {
  uint256 id;
  uint256 propertyId;
  string depositCode;
  address tenant;
  uint256 amount;
  uint256 finalAmount;
  uint256 creationDate;
  uint256 paymentDate;
  uint256 refundDate;
  DepositStatus status;  // Enum: PENDING, PAID, DISPUTED, RETAINED, REFUNDED, PARTIALLY_REFUNDED
}

FileReference {
  string cid;
  uint256 uploadTimestamp;
  FileType fileType; // Enum: LEASE, PHOTOS, ENTRY_INVENTORY, EXIT_INVENTORY
  address uploader;
  string fileName;
}
```

### Organisation du frontend
```
frontend/
├── app/                    # Pages de l'application
│   ├── account/            # Gestion du compte utilisateur
│   ├── deposits/           # Gestion des cautions (locataire)
│   ├── properties/         # Gestion des biens
│   │   ├── [id]/           # Détails d'un bien
│   │   └── create/         # Création d'un bien
│   └── page.tsx            # Page d'accueil
├── components/             # Composants réutilisables
│   ├── ui/                 # Composants d'interface
│   └── layout/             # Composants de structure
├── hooks/                  # Custom hooks React
├── lib/                    # Bibliothèques et utilitaires
│   ├── contract.json       # Configuration du contrat
│   └── utils.ts            # Fonctions utilitaires
├── public/                 # Ressources statiques
└── styles/                 # Styles CSS globaux
```

## Configuration
### Variables d'environnement

#### Frontend (.env.local)
```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x77A88047a35905bE0a994d59d40Bc7Df0C6F4653
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xFfCfa4a838e7C9308844Eb2213E91f67cFD5aB26
NEXT_PUBLIC_ALCHEMY_API_KEY=votre_clé_alchemy
NEXT_PUBLIC_PINATA_API_KEY=votre_clé_pinata
NEXT_PUBLIC_PINATA_SECRET_KEY=votre_secret_pinata
```

#### Backend (.env)
```
PRIVATE_KEY=votre_clé_privée
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/votre_clé_alchemy
ETHERSCAN_API_KEY=votre_clé_etherscan
```

## Déploiement
### Déployer les contrats
```bash
cd backend
npx hardhat run scripts/deploy.ts --network sepolia
```

### Déployer le frontend
```bash
cd frontend
npm run build
npm run start
```

### Adresses de déploiement (Sepolia)
- **SmartDeposit**: `0x77A88047a35905bE0a994d59d40Bc7Df0C6F4653`
- **DepositNFT**: `0xFfCfa4a838e7C9308844Eb2213E91f67cFD5aB26`

## Tests
```bash
cd backend
npx hardhat test
npx hardhat coverage
```

## API du Smart Contract

### Propriétés
| Fonction | Description | Paramètres |
|----------|-------------|------------|
| `createProperty` | Crée un nouveau bien immobilier | _name (string), _location (string) |
| `deleteProperty` | Supprime un bien (uniquement par le propriétaire et si non loué) | _propertyId (uint256) |
| `getProperty` | Récupère les détails d'un bien | _propertyId (uint256) |
| `getLandlordProperties` | Récupère tous les biens d'un propriétaire | _landlord (address) |
| `getPropertyDeposits` | Récupère l'historique des cautions d'un bien | _propertyId (uint256) |
| `getDepositIdFromProperty` | Récupère l'ID de la caution active d'un bien | _propertyId (uint256) |

### Cautions
| Fonction | Description | Paramètres |
|----------|-------------|------------|
| `createDeposit` | Crée une nouvelle demande de caution | _propertyId (uint256), _depositCode (string) |
| `setDepositAmount` | Définit le montant de la caution | _depositId (uint256), _amount (uint256) |
| `payDeposit` | Paie une caution (fonction payable) | _depositId (uint256), _depositCode (string) |
| `refundDeposit` | Rembourse une caution (uniquement par le propriétaire) | _depositId (uint256) |
| `getDeposit` | Récupère les détails d'une caution | _depositId (uint256) |
| `getTenantDeposits` | Récupère toutes les cautions d'un locataire | _tenant (address) |
| `addDepositFile` | Ajoute un fichier à une caution | _depositId (uint256), _fileType (FileType), _cid (string), _fileName (string) |
| `getDepositFiles` | Récupère tous les fichiers d'une caution | _depositId (uint256) |
| `getPropertyIdFromDeposit` | Récupère l'ID du bien associé à une caution | _depositId (uint256) |

### Litiges
| Fonction | Description | Paramètres |
|----------|-------------|------------|
| `initiateDispute` | Démarre un litige sur une caution | _depositId (uint256) |
| `resolveDispute` | Résout un litige | _depositId (uint256), _finalStatus (DepositStatus), _refundedAmount (uint256) |

### NFT
| Fonction | Description | Paramètres |
|----------|-------------|------------|
| `initialize` | Initialise le contrat NFT avec l'adresse du contrat SmartDeposit | smartDepositAddress (address) |
| `mintDepositNFT` | Crée un nouveau NFT pour une caution | _depositId (uint256), _owner (address) |
| `tokenURI` | Récupère les métadonnées d'un NFT | _tokenId (uint256) |
| `getTokenIdFromDeposit` | Récupère l'ID du token associé à une caution | _depositId (uint256) |
| `getDepositIdFromToken` | Récupère l'ID de la caution associée à un token | _tokenId (uint256) |
| `getExtendedDepositInfoForNFT` | Récupère les informations détaillées d'une caution | _depositId (uint256) |
| `getDepositNFTAddress` | Récupère l'adresse du contrat DepositNFT | - |

## Interactions avec la blockchain
- **Lecture**: Utilisation de `useReadContract` et `useReadContracts` pour récupérer les données
- **Écriture**: Utilisation de `useWriteContract` pour effectuer des transactions
- **Suivi**: Utilisation de `useWaitForTransactionReceipt` pour suivre l'état des transactions

## Évolution et extensibilité
L'architecture de Smart Deposit a été conçue pour faciliter les futures évolutions:

1. **Chiffrement des fichiers IPFS**: Implémentation prévue pour sécuriser les documents sensibles
2. **Historique des cautions d'un bien**: Affichage de l'historique des cautions 
2. **Notification push**: Alertes pour les actions importantes (demande de caution, remboursement, litige)
3. **Multi-réseaux**: Support pour d'autres réseaux Ethereum (mainnet, Layer 2)
4. **Système de réputation**: Évaluation des propriétaires et locataires basée sur leur historique
5. **Intégration Kleros**: Protocole de résolution des litiges en ligne (lorsqu'on ne peut régler à l'amiable)
6. **Interface mobile**: Version responsive optimisée pour les appareils mobiles 