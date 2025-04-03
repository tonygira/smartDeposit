import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Déploiement avec l'adresse:", deployer.address);

  // Étape 1: Déployer le contrat DepositNFT (sans paramètres)
  const DepositNFT = await ethers.getContractFactory("DepositNFT");
  const depositNFT = await DepositNFT.deploy();
  await depositNFT.waitForDeployment();
  
  const depositNFTAddress = await depositNFT.getAddress();
  console.log("DepositNFT déployé à l'adresse:", depositNFTAddress);

  // Étape 2: Déployer le contrat SmartDeposit avec l'adresse du DepositNFT
  const SmartDeposit = await ethers.getContractFactory("SmartDeposit");
  const smartDeposit = await SmartDeposit.deploy(depositNFTAddress);
  await smartDeposit.waitForDeployment();
  
  const smartDepositAddress = await smartDeposit.getAddress();
  console.log("SmartDeposit déployé à l'adresse:", smartDepositAddress);

  // Étape 3: Initialiser DepositNFT avec l'adresse de SmartDeposit
  console.log("Initialisation de DepositNFT avec l'adresse de SmartDeposit...");
  const initTx = await depositNFT.initialize(smartDepositAddress);
  await initTx.wait();
  console.log("DepositNFT initialisé avec succès");

  // Étape 4: Transférer la propriété de DepositNFT au contrat SmartDeposit
  console.log("Transfert de la propriété de DepositNFT à SmartDeposit...");
  const transferTx = await depositNFT.transferOwnership(smartDepositAddress);
  await transferTx.wait();
  console.log("Propriété transférée avec succès");
  
  console.log("Déploiement terminé!");
}

// Exécution du script
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
