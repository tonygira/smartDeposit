# Architecture - Smart Deposit

## Vue d'ensemble
Smart Deposit utilise une architecture décentralisée avec un contrat intelligent comme source de vérité et une interface utilisateur moderne qui interagit avec la blockchain.

## Diagramme d'architecture
```
Frontend (Next.js) <--> Blockchain (Ethereum/Sepolia) <--> Smart Contract
             ↑                                                 ↑
             |                                                 |
        Utilisateurs                                      Données
           (UI)                                       (Biens, Cautions)
```

## Composants principaux

### Smart Contract
- **SmartDeposit.sol**: Contrat principal qui implémente la logique métier
  - Stocke les données des biens et des cautions
  - Gère les transactions financières
  - Implémente les règles de sécurité

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
3. Le contrat intelligent exécute la logique métier
4. L'état de l'application est mis à jour via des événements
5. L'interface utilisateur reflète les changements

## Sécurité
- Toutes les transactions sont signées par le wallet de l'utilisateur
- Les fonds sont gérés par le contrat intelligent
- Les règles métier sont appliquées au niveau du contrat
- Aucune donnée sensible n'est stockée en dehors de la blockchain  (TODO: chiffrement)

## Structure des données

### Entités du Smart Contract
```
Property {
  uint256 id;
  address landlord;
  string name;
  string location;
  uint256 depositAmount;
  PropertyStatus status; // Enum: NOT_RENTED, RENTED, DISPUTED
  address tenant; // Si occupé
}

Deposit {
  uint256 id;
  uint256 propertyId;
  address tenant;
  uint256 amount;
  uint256 timestamp;
  DepositStatus status;  // Enum: PENDING, ACTIVE, DISPUTED, RELEASED, REFUNDED
}

```

### Organisation du frontend
```
frontend/
├── app/                    # Pages de l'application
│   ├── dashboard/          # Tableau de bord propriétaire
│   ├── deposits/           # Gestion des cautions (locataire)
│   ├── properties/         # Gestion des biens
│   │   ├── [id]/           # Détails d'un bien
│   │   └── create/         # Création d'un bien
│   └── page.tsx            # Page d'accueil
├── components/             # Composants réutilisables
│   ├── header.tsx          # En-tête avec navigation
│   └── ui/                 # Composants d'interface
├── lib/                    # Bibliothèques et utilitaires
│   └── contract.ts         # Configuration du contrat
└── public/                 # Ressources statiques
```

## Interactions avec la blockchain
- **Lecture**: Utilisation de `useReadContract` et `useReadContracts` pour récupérer les données
- **Écriture**: Utilisation de `useWriteContract` pour effectuer des transactions
- **Suivi**: Utilisation de `useWaitForTransactionReceipt` pour suivre l'état des transactions

## Évolution et extensibilité
L'architecture de Smart Deposit a été conçue pour faciliter les futures évolutions:

1. **Nouveaux types de biens**: La structure peut être étendue pour supporter différents types de propriétés
2. **Fonctionnalités avancées**: Support pour le téléchargement de documents (IPFS)
3. **Multi-réseaux**: L'application pourrait être déployée sur plusieurs réseaux blockchain
4. **Système de réputation**: Évaluation des propriétaires et locataires basée sur leur historique
5. **Gouvernance DAO**: Système de gouvernance décentralisée pour la résolution des litiges 