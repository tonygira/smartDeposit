# Smart Deposit - Solution de Gestion de Cautions Immobilières sur Ethereum

## Description
Smart Deposit est une application décentralisée (dApp) permettant la gestion sécurisée des cautions locatives sur la blockchain Ethereum. La solution comprend 2 smart contracts déployés sur le réseau Sepolia et une interface utilisateur moderne développée avec Next.js.

## Structure du Projet

- **Backend** : Smart contracts Solidity et environnement de test/déploiement
- **Frontend** : Application web avec Next.js et intégration blockchain

## Documentation Détaillée

Pour des informations détaillées sur chaque partie du projet, veuillez consulter :

- [Documentation du Backend](./backend/README.md)
- [Documentation du Frontend](./frontend/README.md)
- [Documentation Technique](./docs/technical.md)
- [Guide Utilisateur](./docs/user-guide.md)

## Aperçu Technique

### Smart Contract (Backend)
- Développé en Solidity 0.8.28
- Déployé sur le réseau de test Sepolia
- Tests avec Hardhat
- Framework OpenZeppelin pour les standards ERC-721

### Frontend
- Framework Next.js 15
- React 19
- Intégration Web3 via wagmi, viem et RainbowKit
- Interface responsive avec Tailwind CSS
- Composants UI avec Shadcn UI

### DevOps & Qualité
- Tests unitaires du smart contract avec couverture >95%
- Pipeline CI/CD avec GitHub Actions
- Déploiement continu via Vercel

## Installation Rapide

Pour installer et exécuter le projet complet, suivez les instructions détaillées dans les README du backend et du frontend.

1. Cloner le dépôt
```bash
git clone https://github.com/votre-username/smartDeposit.git
cd smartDeposit
```

2. Installer et configurer le backend et le frontend en suivant les instructions de leur README respectif.

## Sécurité

Le projet implémente plusieurs mesures de sécurité :
- Gestion fine des droits d'accès via modifiers Solidity
- Tests exhaustifs des cas limites
- Validation des inputs et gestion des erreurs

## Licence

Ce projet est sous licence [MIT](LICENSE).