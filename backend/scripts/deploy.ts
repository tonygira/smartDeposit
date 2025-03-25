import { ethers, run } from "hardhat";

async function main() {
  console.log("Déploiement du contrat SmartDeposit...");

  // Déploiement du contrat
  const SmartDeposit = await ethers.getContractFactory("SmartDeposit");
  const smartDeposit = await SmartDeposit.deploy();

  await smartDeposit.waitForDeployment();

  const address = await smartDeposit.getAddress();
  console.log(`Contrat SmartDeposit déployé à l'adresse: ${address}`);
  
    /*
  // Vérification sur Etherscan (attendre quelques blocs)
  console.log("Attente de quelques blocs avant la vérification...");
  await new Promise(resolve => setTimeout(resolve, 40000)); // 40 secondes d'attente
  
  // Vérification du contrat
try {
    console.log("Vérification du contrat sur Etherscan...");
    await run("verify:verify", {
      address: address,
      constructorArguments: []
    });
    console.log("Contrat vérifié avec succès!");
  } catch (error) {
    console.log("Erreur lors de la vérification:", error);
  }*/
}

// Exécution du script
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
