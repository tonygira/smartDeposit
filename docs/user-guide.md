# Guide Utilisateur - Smart Deposit

## Introduction
Smart Deposit est une application décentralisée qui permet de gérer des dépôts de garantie immobiliers sur la blockchain Ethereum. Elle offre une solution transparente et sécurisée pour les propriétaires et les locataires, avec tokenisation des cautions sous forme de NFT.

## Prérequis
- Un navigateur web moderne (Chrome, Firefox, Brave)
- Une extension de wallet compatible Ethereum (MetaMask, Coinbase Wallet, etc.)
- Des ETH de test pour le réseau Sepolia (disponibles via un faucet comme [Alchemy Sepolia Faucet](https://sepoliafaucet.com/) ou [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia))
- Une connexion Internet stable

## Accès à l'application
1. Visitez [Smart Deposit App](https://smart-deposit.vercel.app)
2. Cliquez sur "Connect Wallet" en haut à droite
3. Sélectionnez votre wallet préféré
4. Connectez-vous et assurez-vous d'être sur le réseau Sepolia
5. Choisissez votre profil : propriétaire ou locataire

## Pour les propriétaires

### Tableau de bord propriétaire
Après vous être connecté en tant que propriétaire, vous accédez à votre tableau de bord qui affiche :
- Tous vos biens immobiliers
- Statut de chaque bien (Non loué, Loué, En litige)
- Actions disponibles pour chaque bien

### Ajouter un bien
1. Accédez au tableau de bord en cliquant sur "Je suis propriétaire"
2. Cliquez sur "Ajouter un bien"
3. Remplissez le formulaire avec les détails du bien:
   - Nom du bien (ex: "Appartement Montparnasse")
   - Emplacement (ex: "15 rue des Lilas, 75014 Paris")
   - Montant de la caution (en ETH)
4. Confirmez la transaction dans votre wallet
5. Attendez la confirmation de la transaction (cela peut prendre quelques minutes)
6. Le nouveau bien apparaîtra dans votre liste une fois la transaction validée

### Gérer un bien
1. Sur le tableau de bord, tous vos biens sont listés
2. Cliquez sur "Voir les détails" pour accéder à un bien spécifique
3. Selon le statut du bien, vous pouvez:
   - Supprimer le bien (si non loué)
   - Demander une caution (si non loué)
   - Restituer la caution (si loué)
   - Ouvrir un litige (si loué)
   - Régler un litige (si en litige)

### Demander une caution
1. Accédez aux détails du bien
2. Cliquez sur "Créer une caution"
3. Générez un code de caution unique pour ce bien
4. Ajoutez les fichiers obligatoires (bail, état des lieux, photos)
5. Fixez le montant de la caution (en ETH)
6. Cliquez sur "Valider la caution"
7. Confirmez la transaction dans votre wallet
8. Une fois validée, vous accéderez à une page avec un QR code contenant le code de caution
9. Partagez ce QR code ou le code de caution directement avec votre futur locataire
10. Le locataire pourra alors utiliser ce code pour accéder au bien et verser la caution

### Gestion des fichiers
1. Depuis les détails d'un bien loué, cliquez sur "Gérer les fichiers"
2. Vous pouvez:
   - Télécharger le bail et l'état des lieux (formats PDF, JPG, PNG)
   - Visualiser les fichiers déjà téléchargés
   - Supprimer des fichiers (fonctionnalité à venir)
3. Les fichiers sont stockés sur IPFS et liés à la caution

### Restituer une caution
1. Accédez aux détails du bien loué
2. Cliquez sur "Restituer la caution"
3. Confirmez la transaction dans votre wallet
4. Attendez la confirmation de la transaction
5. Le statut du bien passera à "Non loué" et les fonds seront automatiquement transférés au locataire

### Gérer un litige
1. Accédez aux détails du bien en litige
2. Pour initier un litige, cliquez sur "Ouvrir un litige"
3. Pour résoudre un litige:
   - Cliquez sur "Régler le litige"
   - Choisissez entre une retenue totale ou partielle de la caution
   - Si partielle, indiquez le montant à retenir
   - Confirmez votre décision
4. Confirmez la transaction dans votre wallet

## Pour les locataires

### Tableau de bord locataire
Après vous être connecté en tant que locataire, vous accédez à votre tableau de bord qui affiche :
- Vos cautions actives et passées
- Statut de chaque caution
- Vos NFT de caution

### Verser une caution
1. Accédez à la section locataire en cliquant sur "Je suis locataire"
2. Cliquez sur "J'ai un code caution"
3. Saisissez le code de caution fourni par le propriétaire
4. Vous accéderez à la page du bien concerné où vous pourrez:
   - Consulter les détails du bien
   - Visualiser les fichiers déposés par le propriétaire (bail, état des lieux, photos)
   - Vérifier le montant de la caution
5. Cliquez sur "Verser la caution"
6. Confirmez la transaction dans votre wallet (assurez-vous d'avoir suffisamment d'ETH)
7. Attendez la confirmation de la transaction
8. Une fois confirmée, vous recevrez un NFT représentant votre caution

### Consulter vos NFT de caution
1. Dans la section "Mes NFT de caution", vous verrez tous les NFT de caution que vous possédez
2. Chaque NFT contient:
   - Une représentation visuelle dynamique
   - Le montant de la caution
   - Le statut actuel (Payée, Remboursée, En litige, etc.)
   - La date de versement
   - L'adresse du bien associé
3. Le NFT est automatiquement mis à jour lorsque le statut de la caution change

### Gestion des fichiers
1. Depuis les détails d'une caution, cliquez sur "Gérer les fichiers"
2. Vous pouvez:
   - Télécharger des photos ou documents (formats PDF, JPG, PNG)
   - Visualiser les fichiers déjà téléchargés
3. Ces fichiers peuvent servir de preuve en cas de litige

### Initier un litige
1. Si vous êtes en désaccord avec le propriétaire:
   - Accédez aux détails de votre caution
   - Cliquez sur "Contester"
   - Décrivez brièvement le motif du litige
2. Une fois le litige initié, les fonds restent bloqués dans le smart contract jusqu'à résolution

## Comprendre les statuts

### Statuts d'un bien
- **Non loué**: Le bien est disponible pour une location
- **Loué**: Une caution a été versée pour ce bien
- **En litige**: Un litige a été ouvert concernant la caution

### Statuts d'une caution
- **En attente**: La demande de caution a été créée mais pas encore payée
- **Payée**: La caution a été versée et est active
- **En litige**: Un litige a été ouvert concernant cette caution
- **Retenue**: La caution a été retenue par le propriétaire (après litige)
- **Remboursée**: La caution a été intégralement remboursée au locataire
- **Partiellement remboursée**: Une partie de la caution a été remboursée au locataire

## Visualisation des NFT
Chaque caution est représentée par un NFT dynamique qui:
1. Affiche le montant de la caution
2. Change de couleur selon le statut:
   - Violet: Caution payée et active
   - Vert: Caution remboursée
   - Rose: Caution en litige
   - Jaune: Caution partiellement remboursée
   - Rouge: Caution retenue
3. Contient des métadonnées enrichies accessibles via les explorateurs NFT standards
4. Est transférable (mais cela n'affecte pas les droits sur la caution elle-même)

## Suivi des transactions
Pour chaque action impliquant une transaction blockchain:
1. L'état "En cours..." s'affiche pendant que vous confirmez dans votre wallet
2. L'état "Transaction en cours de confirmation..." s'affiche pendant la validation
3. Une notification de succès ou d'échec s'affiche à la fin du processus
4. Le hash de transaction est affiché pour référence et permet de vérifier la transaction sur Etherscan

## Conseils de sécurité
- Vérifiez toujours l'adresse du contrat avant de confirmer une transaction
- Ne partagez jamais votre phrase de récupération ou clé privée
- Utilisez un montant de caution raisonnable
- Consultez et téléchargez les documents associé au bien (bail, état des lieux, photos) avant de verser une caution
- Vérifiez que vous êtes bien connecté au réseau Sepolia et non au réseau principal Ethereum

## Dépannage courant
- **Wallet non détecté**: Assurez-vous que votre extension wallet est installée et déverrouillée
- **Transaction en attente**: Les temps de confirmation peuvent varier, surtout pendant les périodes de congestion du réseau
- **Transaction échouée**: Vérifiez que vous avez suffisamment d'ETH pour couvrir la transaction et les frais de gaz
- **Données non mises à jour**: Rafraîchissez la page ou déconnectez et reconnectez votre wallet
- **NFT non visible**: Vérifiez que votre wallet est configuré pour afficher les NFT, ou consultez votre NFT sur OpenSea Sepolia