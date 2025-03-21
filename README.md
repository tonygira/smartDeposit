# Smart Deposit - Solution de Gestion de Dépôts de Garantie sur Ethereum

## Description
Smart Deposit est une application décentralisée (dApp) permettant la gestion sécurisée cautions locatives sur la blockchain Ethereum. La solution comprend un smart contract déployé sur le réseau Sepolia et une interface utilisateur moderne développée avec Next.js.

## Architecture Technique

### Smart Contract (Backend)
- Développé en Solidity 0.8.28
- Déployé sur le réseau de test Sepolia
- Fonctionnalités principales:
  - Création et gestion de biens immobiliers
  - Dépôt et remboursement automatisés des cautions
  - Système de résolution des litiges
  - Gestion des droits propriétaire/locataire

### Frontend
- Framework Next.js 14
- Intégration Web3 via ethers.js et RainbowKit
- Interface responsive avec Tailwind CSS
- Déploiement continu sur Vercel

### DevOps & Qualité
- Pipeline CI/CD avec GitHub Actions
- Tests unitaires exhaustifs avec Hardhat
- Couverture de code > 95%  (bientôt !)
- Déploiement automatisé sur Vercel
- Vérification du code avec Solhint

## Tests et Sécurité
- Tests unitaires complets du smart contract
- Gestion sécurisée des clés privées (à creuser) + chiffrement des données immo (à prévoir).
- Validation des inputs et gestion des erreurs

## Déploiement
- Smart Contract déployé sur Sepolia: `0x92536b7c57798c52E1DCC87c53344eb64D0abC05`
- Frontend accessible sur Vercel
- Configuration via variables d'environnement

## Documentation
Pour plus de détails sur l'implémentation et l'utilisation:
- [Documentation technique](./docs/technical.md)
- [Guide utilisateur](./docs/user-guide.md)
- [Architecture](./docs/architecture.md)