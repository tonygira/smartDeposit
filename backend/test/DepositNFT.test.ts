import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { SmartDeposit, DepositNFT } from "../typechain-types";
import { ContractTransactionReceipt, EventLog } from "ethers";

describe("DepositNFT", function () {
  let smartDeposit: SmartDeposit;
  let depositNFT: DepositNFT;
  let owner: SignerWithAddress;
  let landlord: SignerWithAddress;
  let tenant: SignerWithAddress;

  beforeEach(async function () {
    [owner, landlord, tenant] = await ethers.getSigners();

    // Étape 1: Déployer le contrat DepositNFT (sans paramètres)
    const DepositNFT = await ethers.getContractFactory("DepositNFT");
    depositNFT = await DepositNFT.deploy();
    await depositNFT.waitForDeployment();

    // Étape 2: Déployer le contrat SmartDeposit avec l'adresse du DepositNFT
    const SmartDeposit = await ethers.getContractFactory("SmartDeposit");
    smartDeposit = await SmartDeposit.deploy(await depositNFT.getAddress());
    await smartDeposit.waitForDeployment();

    // Étape 3: Initialiser DepositNFT avec l'adresse de SmartDeposit
    await depositNFT.connect(owner).initialize(await smartDeposit.getAddress());

    // Étape 4: Transférer la propriété de DepositNFT au contrat SmartDeposit
    await depositNFT.connect(owner).transferOwnership(await smartDeposit.getAddress());
  });

  describe("Minting", function () {
    it("Should mint NFT when deposit is paid", async function () {
      // Créer une propriété
      const propertyName = "Test Property";
      const propertyLocation = "Test Location";
      await smartDeposit.connect(landlord).createProperty(propertyName, propertyLocation);
      const propertyId = 1; // Premier ID

      // Créer une caution
      const depositCode = "123456";
      await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode);
      const depositId = 1; // Premier ID

      // Définir le montant de la caution
      const depositAmount = ethers.parseEther("1"); // 1 ETH
      await smartDeposit.connect(landlord).setDepositAmount(depositId, depositAmount);

      // Vérifier que le tenant n'a pas de NFT avant le paiement
      expect(await depositNFT.balanceOf(tenant.address)).to.equal(0);

      // Payer la caution
      const tx = await smartDeposit.connect(tenant).payDeposit(depositId, depositCode, {
        value: depositAmount,
      });
      const receipt = await tx.wait();

      // Vérifier l'événement DepositNFTMinted
      const event = receipt?.logs.find(log => {
        try {
          return depositNFT.interface.parseLog({
            topics: log.topics,
            data: log.data,
          })?.name === "DepositNFTMinted";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      // Vérifier que le NFT a été minté
      expect(await depositNFT.balanceOf(tenant.address)).to.equal(1);

      // Vérifier les mappings
      const tokenId = await depositNFT.getTokenIdFromDeposit(depositId);
      expect(tokenId).to.equal(1); // Premier token

      const depositIdFromToken = await depositNFT.getDepositIdFromToken(tokenId);
      expect(depositIdFromToken).to.equal(depositId);

      // Vérifier que le NFT appartient au tenant
      expect(await depositNFT.ownerOf(tokenId)).to.equal(tenant.address);
    });

    it("Should not allow minting from non-SmartDeposit contract", async function () {
      await expect(
        depositNFT.connect(tenant).mintDepositNFT(1, tenant.address)
      ).to.be.revertedWith("Only SmartDeposit can mint");
    });

    it("Should not mint NFT when deposit amount is incorrect", async function () {
      // Créer une propriété et une caution
      await smartDeposit.connect(landlord).createProperty("Test Property", "Test Location");
      await smartDeposit.connect(landlord).createDeposit(1, "123456");
      const depositId = 1;
      const depositAmount = ethers.parseEther("1");

      // Définir le montant de la caution
      await smartDeposit.connect(landlord).setDepositAmount(depositId, depositAmount);

      // Tenter de payer avec un montant incorrect
      await expect(
        smartDeposit.connect(tenant).payDeposit(depositId, "123456", {
          value: depositAmount / 2n, // Moitié du montant requis
        })
      ).to.be.revertedWith("Incorrect amount");

      // Vérifier qu'aucun NFT n'a été minté
      expect(await depositNFT.balanceOf(tenant.address)).to.equal(0);
    });

    it("Should not mint NFT when access code is incorrect", async function () {
      // Créer une propriété et une caution
      await smartDeposit.connect(landlord).createProperty("Test Property", "Test Location");
      await smartDeposit.connect(landlord).createDeposit(1, "123456");
      const depositId = 1;
      const depositAmount = ethers.parseEther("1");

      // Définir le montant de la caution
      await smartDeposit.connect(landlord).setDepositAmount(depositId, depositAmount);

      // Tenter de payer avec un code incorrect
      await expect(
        smartDeposit.connect(tenant).payDeposit(depositId, "000000", {
          value: depositAmount,
        })
      ).to.be.revertedWith("Invalid deposit code");

      // Vérifier qu'aucun NFT n'a été minté
      expect(await depositNFT.balanceOf(tenant.address)).to.equal(0);
    });
  });

  describe("TokenURI", function () {
    it("Should return correct token URI format", async function () {
      // Créer une propriété et une caution payée pour obtenir un NFT
      await smartDeposit.connect(landlord).createProperty("Test Property", "Test Location");
      const depositCode = "123456";
      await smartDeposit.connect(landlord).createDeposit(1, depositCode);
      const depositId = 1;
      const depositAmount = ethers.parseEther("0.12345");
      await smartDeposit.connect(landlord).setDepositAmount(depositId, depositAmount);
      
      // Payer la caution pour recevoir le NFT
      await smartDeposit.connect(tenant).payDeposit(depositId, depositCode, {
        value: depositAmount,
      });
      
      // Récupérer l'ID du token
      const tokenId = await depositNFT.getTokenIdFromDeposit(depositId);
      
      // Vérifier le format de l'URI
      const tokenURI = await depositNFT.tokenURI(tokenId);
      
      // L'URI doit commencer par "data:application/json;base64,"
      expect(tokenURI.startsWith("data:application/json;base64,")).to.be.true;
      
      // Tenter de décoder le base64 pour confirmer que c'est un JSON valide
      const base64Part = tokenURI.replace("data:application/json;base64,", "");
      const decodedData = Buffer.from(base64Part, 'base64').toString('utf-8');
      
      // Vérifier que les données décodées forment un JSON valide
      const jsonData = JSON.parse(decodedData);
      
      // Vérifier que le JSON contient les champs attendus
      expect(jsonData).to.have.property("name");
      expect(jsonData).to.have.property("description");
      expect(jsonData).to.have.property("image");
      expect(jsonData).to.have.property("attributes");
      
      // Vérifier que les attributs contiennent les informations attendues
      const attributes = jsonData.attributes;
      const attributeNames = attributes.map((attr: any) => attr.trait_type);
      
      expect(attributeNames).to.include("ID Caution");
      expect(attributeNames).to.include("Montant Initial");
      expect(attributeNames).to.include("Statut");
      expect(attributeNames).to.include("ID Propriété");
      expect(attributeNames).to.include("Locataire");
      expect(attributeNames).to.include("Propriétaire");
      expect(attributeNames).to.include("Date de Paiement");
      expect(attributeNames).to.include("Montant Remboursé");
      expect(attributeNames).to.include("Date de Remboursement");
      
      // L'attribut "Statut" doit avoir la valeur "Payée"
      const statusAttr = attributes.find((attr: any) => attr.trait_type === "Statut");
      expect(statusAttr.value).to.equal("Payée");

      // Vérifier que le montant initial est correct
      const initialAmountAttr = attributes.find((attr: any) => attr.trait_type === "Montant Initial");
      expect(initialAmountAttr.value).to.equal(depositAmount);

      // Vérifier que le montant remboursé est correct
    //   const refundedAmountAttr = attributes.find((attr: any) => attr.trait_type === "Montant Remboursé");
    //   expect(refundedAmountAttr.value).to.equal(finalAmount);

      // Vérifier que l'URI de l'image est correcte
      expect(jsonData.image).to.not.be.undefined;
      // TODO : tests SVG

    });

    it("Should generate SVG with correct ID, amount and color based on status", async function () {
      // Créer une propriété
      await smartDeposit.connect(landlord).createProperty("Test Property1", "Test Location 1");
      const propertyId1 = 1;
      await smartDeposit.connect(landlord).createProperty("Test Property2", "Test Location 2");
      const propertyId2 = 2;
      await smartDeposit.connect(landlord).createProperty("Test Property3", "Test Location 3");
      const propertyId3 = 3;
      await smartDeposit.connect(landlord).createProperty("Test Property4", "Test Location 4");
      const propertyId4 = 4;

      // Créer et payer différentes cautions pour tester les statuts
      async function createAndPayDeposit(propertyId: number, depositCode: string, amount: bigint) {
        await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode);
        const depositId = await smartDeposit.getDepositIdFromProperty(propertyId);
        await smartDeposit.connect(landlord).setDepositAmount(depositId, amount);
        await smartDeposit.connect(tenant).payDeposit(depositId, depositCode, { value: amount });
        return depositId;
      }

      // 1. Caution payée (PAID - status 1) - Violet
      const paidDepositId = await createAndPayDeposit(propertyId1, "DEPOSIT1", ethers.parseEther("0.1234"));
      const paidTokenId = await depositNFT.getTokenIdFromDeposit(paidDepositId);
      const paidTokenURI = await depositNFT.tokenURI(paidTokenId);
      
      // 2. Caution retenue (RETAINED - status 3) - Rouge
      const retainedDepositId = await createAndPayDeposit(propertyId2, "DEPOSIT2", ethers.parseEther("0.5"));
      await smartDeposit.connect(landlord).initiateDispute(retainedDepositId);
      await smartDeposit.connect(landlord).resolveDispute(retainedDepositId, 0n); // 0 refunded = RETAINED
      const retainedTokenId = await depositNFT.getTokenIdFromDeposit(retainedDepositId);
      const retainedTokenURI = await depositNFT.tokenURI(retainedTokenId);
      
      // 3. Caution partiellement remboursée (PARTIALLY_REFUNDED - status 4) - Jaune
      const partialDepositId = await createAndPayDeposit(propertyId3, "DEPOSIT3", ethers.parseEther("1.0"));
      await smartDeposit.connect(landlord).initiateDispute(partialDepositId);
      await smartDeposit.connect(landlord).resolveDispute(partialDepositId, ethers.parseEther("0.5")); // 50% refunded
      const partialTokenId = await depositNFT.getTokenIdFromDeposit(partialDepositId);
      const partialTokenURI = await depositNFT.tokenURI(partialTokenId);
      
      // 4. Caution remboursée (REFUNDED - status 5) - Vert
      const refundedDepositId = await createAndPayDeposit(propertyId4, "DEPOSIT4", ethers.parseEther("0.25"));
      await smartDeposit.connect(landlord).refundDeposit(refundedDepositId);
      const refundedTokenId = await depositNFT.getTokenIdFromDeposit(refundedDepositId);
      const refundedTokenURI = await depositNFT.tokenURI(refundedTokenId);
      
      // Fonction utilitaire pour décoder l'URI et extraire le SVG
      function decodeSVG(tokenURI: string) {
        const base64Json = tokenURI.replace("data:application/json;base64,", "");
        const jsonData = JSON.parse(Buffer.from(base64Json, 'base64').toString('utf-8'));
        const base64SVG = jsonData.image.replace("data:image/svg+xml;base64,", "");
        return Buffer.from(base64SVG, 'base64').toString('utf-8');
      }
      
      // Extraire les SVGs
      const paidSVG = decodeSVG(paidTokenURI);
      const retainedSVG = decodeSVG(retainedTokenURI);
      const partialSVG = decodeSVG(partialTokenURI);
      const refundedSVG = decodeSVG(refundedTokenURI);
      
      // Vérifier le contenu des SVGs
      
      // 1. Vérifier les IDs de caution et montants
      expect(paidSVG).to.include(`Caution #${paidDepositId}`);
      expect(paidSVG).to.include("0.1234 ETH"); // 4 décimales comme configuré
      
      expect(retainedSVG).to.include(`Caution #${retainedDepositId}`);
      expect(retainedSVG).to.include("0.5000 ETH");
      
      expect(partialSVG).to.include(`Caution #${partialDepositId}`);
      expect(partialSVG).to.include("1.0000 ETH");
      
      expect(refundedSVG).to.include(`Caution #${refundedDepositId}`);
      expect(refundedSVG).to.include("0.2500 ETH");
      
      // 2. Vérifier les couleurs selon le statut
      expect(paidSVG).to.include('fill="#7759F9"'); // Violet pour PAID
      expect(retainedSVG).to.include('fill="#e63946"'); // Rouge pour RETAINED
      expect(partialSVG).to.include('fill="#ffbb00"'); // Jaune pour PARTIALLY_REFUNDED
      expect(refundedSVG).to.include('fill="#25a244"'); // Vert pour REFUNDED
    });
  });

  describe("Soul-Bound Token tests", function () {
    let tokenId: bigint;
    
    beforeEach(async function () {
      // Créer une propriété
      await smartDeposit.connect(landlord).createProperty("Test Property", "Test Location");
      const propertyId = 1;
      
      // Créer et payer une caution
      const depositCode = "123456";
      await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode);
      const depositId = 1;
      const depositAmount = ethers.parseEther("1");
      await smartDeposit.connect(landlord).setDepositAmount(depositId, depositAmount);
      
      // Payer la caution pour recevoir le NFT
      await smartDeposit.connect(tenant).payDeposit(depositId, depositCode, {
        value: depositAmount,
      });
      
      // Récupérer l'ID du token
      tokenId = await depositNFT.getTokenIdFromDeposit(depositId);
    });
    
    it("Should not allow transfers", async function () {
      // Vérifier que le NFT appartient au locataire
      expect(await depositNFT.ownerOf(tokenId)).to.equal(tenant.address);
      
      // Tenter un transferFrom direct
      await expect(
        depositNFT.connect(tenant).transferFrom(tenant.address, landlord.address, tokenId)
      ).to.be.revertedWith("SBT: transfer not allowed");
      
      // Tenter un safeTransferFrom avec data
      await expect(
        depositNFT.connect(tenant)["safeTransferFrom(address,address,uint256,bytes)"](
          tenant.address, 
          landlord.address, 
          tokenId,
          "0x"
        )
      ).to.be.revertedWith("SBT: transfer not allowed");
      
      // Vérifier que le NFT est toujours détenu par le locataire
      expect(await depositNFT.ownerOf(tokenId)).to.equal(tenant.address);
    });
    
    it("Should not allow approve", async function () {
      await expect(
        depositNFT.connect(tenant).approve(landlord.address, tokenId)
      ).to.be.revertedWith("SBT: approve not allowed");
    });
    
    it("Should not allow setApprovalForAll", async function () {
      await expect(
        depositNFT.connect(tenant).setApprovalForAll(landlord.address, true)
      ).to.be.revertedWith("SBT: setApprovalForAll not allowed");
    });
    
    it("Should not allow burning by non-owner", async function () {
      await expect(
        depositNFT.connect(landlord).burn(tokenId)
      ).to.be.revertedWith("SBT: Only owner can burn");
      
      // Vérifier que le NFT existe toujours
      expect(await depositNFT.ownerOf(tokenId)).to.equal(tenant.address);
    });
    
    it("Should allow burning by owner", async function () {
      // Vérifier que le NFT appartient au locataire
      expect(await depositNFT.ownerOf(tokenId)).to.equal(tenant.address);
      
      // Le tenant brûle son propre NFT
      const tx = await depositNFT.connect(tenant).burn(tokenId);
      const receipt = await tx.wait();
      
      // Vérifier l'événement Burned
      const burnEvent = receipt?.logs.find(log => {
        try {
          const parsedLog = depositNFT.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          return parsedLog?.name === "Burned";
        } catch {
          return false;
        }
      });
      
      expect(burnEvent).to.not.be.undefined;
      
      // Vérifier que le NFT n'existe plus
      await expect(
        depositNFT.ownerOf(tokenId)
      ).to.be.reverted;
    });
  });
}); 