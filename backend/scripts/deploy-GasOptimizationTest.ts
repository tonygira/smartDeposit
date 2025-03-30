import { ethers, run } from "hardhat";

async function main() {
  console.log("Déploiement du contrat de test de gas optimization...");

  // Déploiement du contrat
  const GasOptimizationTest = await ethers.getContractFactory("GasOptimizationTest");
  const gasOptimizationTest = await GasOptimizationTest.deploy();

  await gasOptimizationTest.waitForDeployment();

  const address = await gasOptimizationTest.getAddress();
  console.log(`Contrat GasOptimizationTest déployé à l'adresse: ${address}`);
  
}

// Exécution du script
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
