# Smart Deposit Backend

Ce dossier contient les smart contracts et l'environnement de développement du projet Smart Deposit.

## Technologies Utilisées

- **Solidity**: 0.8.28
- **Framework**: Hardhat 2.22
- **Tests**: Hardhat Test Runner
- **Standards**: OpenZeppelin 5.2 pour les implémentations ERC-721
- **Développement**: TypeScript pour les scripts et les tests

## Structure des Contrats

Le projet comprend deux contrats principaux :

1. **SmartDeposit.sol**: Le contrat principal qui gère les propriétés, les cautions et les processus de résolution des litiges.
2. **DepositNFT.sol**: Contrat ERC-721 pour la tokenisation des cautions, permettant la représentation des dépôts sous forme de NFT.

## Fonctionnalités Principales

- Création et gestion de biens immobiliers
- Dépôt et remboursement automatisés des cautions
- Système de résolution des litiges
- Gestion des droits propriétaire/locataire
- Représentation des cautions sous forme de NFT (avec métadonnées dynamiques)
- Stockage de fichiers associés aux cautions (via IPFS)

## Installation et Configuration

### Prérequis

- Node.js (v18+)
- npm ou yarn
- Git

### Installation

1. Cloner le dépôt (si ce n'est pas déjà fait)
```bash
git clone https://github.com/votre-username/smartDeposit.git
cd smartDeposit/backend
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
```bash
cp .env.example .env
```
Puis modifiez le fichier `.env` avec vos propres clés privées et URLs de providers.

## Commandes Disponibles

- **Compiler les contrats**
```bash
npx hardhat compile
```

- **Exécuter les tests**
```bash
npx hardhat test
```

- **Vérifier la couverture de code**
```bash
npx hardhat coverage
```

- **Déployer sur Sepolia**
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

- **Générer la documentation**
```bash
npx hardhat docgen
```

## Structure du Code

```
backend/
├── contracts/           # Smart contracts Solidity
├── scripts/             # Scripts de déploiement et utilitaires
├── test/                # Tests unitaires des contrats
├── artifacts/           # Compilations générées
├── cache/               # Cache de Hardhat
├── typechain-types/     # Types TypeScript générés
└── hardhat.config.ts    # Configuration Hardhat
```

## Tests

Le projet dispose d'une suite de tests complète pour tous les smart contracts, avec une couverture de code supérieure à 95%. Les tests couvrent :

- Toutes les fonctionnalités des contrats
- Les cas limites et les flux d'erreur
- Les modifiers de sécurité
- Les événements et les mises à jour d'état

## Sécurité

Plusieurs mesures de sécurité sont implémentées dans les smart contracts :

- Utilisation de modifiers pour contrôler l'accès aux fonctions
- Vérifications des entrées utilisateur
- Protection contre les réentrances
- Validation des états avant les actions
- Tests exhaustifs des cas limite

## Déploiement

Le smart contract est actuellement déployé sur le réseau de test Sepolia :

- **SmartDeposit**: `0x77A88047a35905bE0a994d59d40Bc7Df0C6F4653`
- **DepositNFT**: `0xFfCfa4a838e7C9308844Eb2213E91f67cFD5aB26`

Pour vérifier le déploiement, vous pouvez utiliser l'explorateur de blocs Sepolia Etherscan.