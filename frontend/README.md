# Smart Deposit Frontend

Ce dossier contient l'application web frontend du projet Smart Deposit, permettant aux utilisateurs d'interagir avec les smart contracts Ethereum.

## Technologies Utilisées

- **Framework**: Next.js 15.2.3
- **Langage**: TypeScript & React 19
- **Intégration Blockchain**: 
  - wagmi (dernière version)
  - viem (dernière version)
  - RainbowKit pour la gestion des wallets
  - ethers.js 6.13 pour certaines opérations spécifiques
- **UI/UX**:
  - Tailwind CSS 3.4
  - Shadcn UI (composants basés sur Radix UI)
  - Lucide React pour les icônes
- **Stockage Décentralisé**: Pinata SDK (IPFS)

## Fonctionnalités Principales

- Authentification via wallet Ethereum (Metamask, WalletConnect, etc.)
- Interface propriétaire pour gérer les biens immobiliers et les cautions
- Interface locataire pour payer et suivre les cautions
- Visualisation des NFT de caution
- Upload et gestion de fichiers sur IPFS
- Gestion des litiges et remboursements

## Installation et Configuration

### Prérequis

- Node.js (v18+)
- npm ou yarn
- Git

### Installation

1. Cloner le dépôt (si ce n'est pas déjà fait)
```bash
git clone https://github.com/votre-username/smartDeposit.git
cd smartDeposit/frontend
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
```bash
cp .env.example .env.local
```
Puis modifiez le fichier `.env.local` avec vos propres clés API (Infura/Alchemy, Pinata, etc.).

## Commandes Disponibles

- **Démarrer le serveur de développement**
```bash
npm run dev
```

- **Compiler pour la production**
```bash
npm run build
```

- **Démarrer la version de production**
```bash
npm run start
```

- **Mettre à jour l'ABI du contrat**
```bash
npm run update-abi
```
Cette commande copie l'ABI du contrat depuis le dossier `backend/artifacts` et met à jour les configurations nécessaires.

## Structure du Code

```
frontend/
├── app/                 # Dossier principal de l'application Next.js
│   ├── api/             # Routes API
│   ├── account/         # Pages de compte utilisateur
│   ├── properties/      # Pages de gestion des propriétés
│   ├── deposits/        # Pages de gestion des cautions
│   └── layout.tsx       # Layout principal
├── components/          # Composants React réutilisables
├── hooks/               # Custom React hooks
├── lib/                 # Utilitaires, configurations
│   ├── contract.json    # ABI et adresses des contrats
│   └── utils.ts         # Fonctions utilitaires
├── public/              # Assets statiques
└── styles/              # Styles CSS
```

## Déploiement

L'application est déployée automatiquement via Vercel à chaque push sur la branche principale.

- **URL de production**: [https://smart-deposit.vercel.app](https://smart-deposit.vercel.app) (à remplacer par votre URL réelle)

## Intégration avec le Backend

Le frontend interagit avec les smart contracts déployés sur Ethereum Sepolia via l'ABI et les adresses définies dans `lib/contract.json`.

Pour mettre à jour cette intégration après un redéploiement des contrats :

1. Mettez à jour l'adresse du contrat dans le fichier `scripts/update-contract.js`
2. Exécutez `npm run update-abi`

## Contribution

Pour contribuer au frontend :

1. Créez une branche pour votre fonctionnalité
2. Respectez les conventions de code et les types TypeScript
3. Lancez les tests et validez que tout fonctionne
4. Soumettez une Pull Request

## Notes sur la Sécurité

- Toutes les transactions sont signées côté client via le wallet de l'utilisateur
- Aucune clé privée n'est stockée ou gérée par l'application
- ATTENTION, dans cette première version du MVP, les fichiers déposés sur IPFS ne sont pas encore chiffrés.
  Ne deposez pas de fichier sensible.