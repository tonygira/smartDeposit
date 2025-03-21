# Guide Utilisateur - Smart Deposit

## Introduction
Smart Deposit est une application décentralisée qui permet de gérer des dépôts de garantie immobiliers sur la blockchain. Elle offre une solution transparente et sécurisée pour les propriétaires et les locataires.

## Prérequis
- Un navigateur web moderne (Chrome, Firefox, Brave)
- Une extension de wallet (MetaMask)
- Des ETH de test pour le réseau Sepolia (disponibles via un faucet)

## Pour les propriétaires

### Connexion
1. Ouvrez l'application Smart Deposit
2. Cliquez sur "Connect Wallet" en haut à droite
3. Connectez votre wallet MetaMask
4. Assurez-vous d'être sur le réseau Sepolia

### Ajouter un bien
1. Accédez au tableau de bord en cliquant sur "Je suis propriétaire"
2. Cliquez sur "Ajouter un bien"
3. Remplissez le formulaire avec les détails du bien:
   - Nom du bien
   - Emplacement
   - Montant de la caution (en ETH)
4. Confirmez la transaction dans votre wallet
5. Attendez la confirmation de la transaction

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
2. Cliquez sur "Demande de caution"
3. Remplissez le formulaire:
   - Téléchargez le bail (fonctionnalité à venir)
   - Téléchargez des photos (fonctionnalité à venir)
   - Spécifiez le montant de la caution en euros
4. Validez la demande

### Restituer une caution
1. Accédez aux détails du bien loué
2. Cliquez sur "Restituer la caution"
3. Confirmez la transaction dans votre wallet
4. Attendez la confirmation de la transaction

### Gérer un litige
1. Accédez aux détails du bien en litige
2. Pour initier un litige, cliquez sur "Ouvrir un litige"
3. Pour résoudre un litige, cliquez sur "Régler le litige"
4. Confirmez la transaction dans votre wallet

## Pour les locataires

### Connexion
1. Ouvrez l'application Smart Deposit
2. Cliquez sur "Connect Wallet" en haut à droite
3. Connectez votre wallet MetaMask
4. Assurez-vous d'être sur le réseau Sepolia

### Verser une caution
1. Accédez à la section locataire en cliquant sur "Je suis locataire"
2. Trouvez le bien pour lequel vous souhaitez verser une caution
3. Cliquez sur "Voir les détails"
4. Cliquez sur "Verser la caution"
5. Confirmez la transaction dans votre wallet
6. Attendez la confirmation de la transaction

### Consulter vos cautions
1. Dans la section locataire, vous verrez tous les biens pour lesquels vous avez versé une caution
2. Vous pouvez suivre l'état de vos cautions en temps réel

## Statuts possibles d'un bien
- **Non loué**: Le bien est disponible pour une location
- **Loué**: Une caution a été versée pour ce bien
- **En litige**: Un litige a été ouvert concernant la caution

## Suivi des transactions
Pour chaque action impliquant une transaction blockchain:
1. L'état "En cours..." s'affiche pendant que vous confirmez dans votre wallet
2. L'état "Transaction en cours de confirmation..." s'affiche pendant la validation
3. Une notification de succès ou d'échec s'affiche à la fin du processus
4. Le hash de transaction est affiché pour référence

## Conseils de sécurité
- Vérifiez toujours l'adresse du contrat avant de confirmer une transaction
- Ne partagez jamais votre phrase de récupération ou clé privée
- Utilisez un montant de caution raisonnable
- Documentez toujours l'état du bien (photos, vidéos) avant de verser une caution 