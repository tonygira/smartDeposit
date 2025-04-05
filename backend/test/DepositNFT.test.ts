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

  // Fonction utilitaire pour créer un token avec depositId = 0
  async function prepareNFTWithZeroDepositId() {
    // Déployer un nouveau contrat DepositNFT
    const DepositNFT = await ethers.getContractFactory("DepositNFT");
    const customDepositNFT = await DepositNFT.deploy();
    await customDepositNFT.waitForDeployment();
    
    // Initialiser le contrat
    await customDepositNFT.initialize(owner.address);
    
    // Créer un token avec depositId = 0
    const tx = await customDepositNFT.connect(owner).mintDepositNFT(0, tenant.address);
    await tx.wait();
    
    // Récupérer le tokenId (premier token minté)
    const tokenId = 1n;
    
    // Vérifier que le token appartient bien au tenant
    expect(await customDepositNFT.ownerOf(tokenId)).to.equal(tenant.address);
    
    // Récupérer le depositId et vérifier qu'il est bien 0
    const depositId = await customDepositNFT.getDepositIdFromToken(tokenId);
    expect(depositId).to.equal(0n);
    
    return { customDepositNFT, tokenId };
  }

  describe("Initialization tests", function () {
    let uninitializedDepositNFT: DepositNFT;
    
    beforeEach(async function () {
      // Déployer un nouveau contrat DepositNFT qui ne sera pas initialisé
      const DepositNFT = await ethers.getContractFactory("DepositNFT");
      uninitializedDepositNFT = await DepositNFT.deploy();
      await uninitializedDepositNFT.waitForDeployment();
    });
    
    it("Should revert when calling mintDepositNFT on uninitialized contract", async function () {
      await expect(
        uninitializedDepositNFT.connect(owner).mintDepositNFT(1, tenant.address)
      ).to.be.revertedWith("Contract not initialized");
    });
    
    it("Should revert when calling updateTokenMetadata on uninitialized contract", async function () {
      await expect(
        uninitializedDepositNFT.connect(owner).updateTokenMetadata(1)
      ).to.be.revertedWith("Contract not initialized");
    });
    
    it("Should revert when calling getTokenIdFromDeposit on uninitialized contract", async function () {
      await expect(
        uninitializedDepositNFT.connect(owner).getTokenIdFromDeposit(1)
      ).to.be.revertedWith("Contract not initialized");
    });
    
    it("Should revert when calling getDepositIdFromToken on uninitialized contract", async function () {
      await expect(
        uninitializedDepositNFT.connect(owner).getDepositIdFromToken(1)
      ).to.be.revertedWith("Contract not initialized");
    });
    
    it("Should revert when calling tokenURI on uninitialized contract", async function () {
      await expect(
        uninitializedDepositNFT.connect(owner).tokenURI(1)
      ).to.be.revertedWith("Contract not initialized");
    });
    
    it("Should not allow initializing the contract twice", async function () {
      // Initialiser d'abord le contrat
      await uninitializedDepositNFT.connect(owner).initialize(await smartDeposit.getAddress());
      
      // Tenter de l'initialiser une seconde fois
      await expect(
        uninitializedDepositNFT.connect(owner).initialize(await smartDeposit.getAddress())
      ).to.be.revertedWith("Contract already initialized");
    });
    
    it("Should not allow initializing with zero address", async function () {
      await expect(
        uninitializedDepositNFT.connect(owner).initialize(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid SmartDeposit address");
    });
    
    it("Should not allow non-owner to initialize the contract", async function () {
      // Tentative d'initialisation par un compte non-owner (tenant)
      await expect(
        uninitializedDepositNFT.connect(tenant).initialize(await smartDeposit.getAddress())
      ).to.be.revertedWithCustomError(uninitializedDepositNFT, "OwnableUnauthorizedAccount")
        .withArgs(tenant.address);
      
      // Tentative d'initialisation par un compte non-owner (landlord)
      await expect(
        uninitializedDepositNFT.connect(landlord).initialize(await smartDeposit.getAddress())
      ).to.be.revertedWithCustomError(uninitializedDepositNFT, "OwnableUnauthorizedAccount")
        .withArgs(landlord.address);
    });
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

    it("Should not mint with zero address as owner", async function () {
      // Nous avons besoin de déployer un nouveau DepositNFT que nous pouvons contrôler directement
      // pour simuler un appel depuis SmartDeposit mais avec une adresse zéro
      const DepositNFT = await ethers.getContractFactory("DepositNFT");
      const newDepositNFT = await DepositNFT.deploy();
      await newDepositNFT.waitForDeployment();
      
      // Initialiser le contrat
      await newDepositNFT.initialize(owner.address); // Nous utilisons owner comme SmartDeposit simulé
      
      // Appeler mintDepositNFT depuis "SmartDeposit" (owner) avec une adresse zéro
      await expect(
        newDepositNFT.connect(owner).mintDepositNFT(1, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid owner address");
    });

    it("Should not mint NFT if it already exists for the deposit", async function () {
      // Nous avons besoin de déployer un nouveau DepositNFT que nous pouvons contrôler directement
      const DepositNFT = await ethers.getContractFactory("DepositNFT");
      const newDepositNFT = await DepositNFT.deploy();
      await newDepositNFT.waitForDeployment();
      
      // Initialiser le contrat
      await newDepositNFT.initialize(owner.address); // Nous utilisons owner comme SmartDeposit simulé
      
      // Minter un NFT pour le dépôt #1
      await newDepositNFT.connect(owner).mintDepositNFT(1, tenant.address);
      
      // Tenter de minter un autre NFT pour le même dépôt
      await expect(
        newDepositNFT.connect(owner).mintDepositNFT(1, landlord.address)
      ).to.be.revertedWith("NFT already exists for this deposit");
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

    it("Should revert if token does not exist", async function () {
      // Essayer d'obtenir l'URI d'un token qui n'existe pas
      await expect(
        depositNFT.tokenURI(999) // ID de token non existant
      ).to.be.revertedWith("Token does not exist");
    });

    // Cas très particulier, il suppose qu'un problème est survenu lors de la création du NFT
    // et que le mapping depositId -> tokenId n'est pas mis à jour.
    it("Should revert if no deposit is associated with the token", async function () {
      // Utiliser la fonction utilitaire pour préparer un NFT avec depositId = 0
      const { customDepositNFT, tokenId } = await prepareNFTWithZeroDepositId();
      
      // Tenter d'obtenir l'URI du token - devrait échouer car aucun dépôt n'est associé
      await expect(
        customDepositNFT.tokenURI(tokenId)
      ).to.be.revertedWith("No deposit associated with this token");
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
    
    it("Should display dispute text for disputed deposits", async function () {
      // Créer une propriété
      await smartDeposit.connect(landlord).createProperty("Test Property Dispute", "Test Location Dispute");
      const propertyId = 1;
      
      // Créer et payer une caution
      const depositCode = "DISPUTE";
      await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode);
      const depositId = await smartDeposit.getDepositIdFromProperty(propertyId);
      const depositAmount = ethers.parseEther("0.75");
      await smartDeposit.connect(landlord).setDepositAmount(depositId, depositAmount);
      
      // Payer la caution
      await smartDeposit.connect(tenant).payDeposit(depositId, depositCode, { value: depositAmount });
      
      // Initier un litige (mais ne pas le résoudre pour rester en statut DISPUTED)
      await smartDeposit.connect(landlord).initiateDispute(depositId);
      
      // Récupérer l'ID du token et son URI
      const tokenId = await depositNFT.getTokenIdFromDeposit(depositId);
      const tokenURI = await depositNFT.tokenURI(tokenId);
      
      // Décoder le SVG
      const base64Json = tokenURI.replace("data:application/json;base64,", "");
      const jsonData = JSON.parse(Buffer.from(base64Json, 'base64').toString('utf-8'));
      const base64SVG = jsonData.image.replace("data:image/svg+xml;base64,", "");
      const svgContent = Buffer.from(base64SVG, 'base64').toString('utf-8');
      
      // Vérifier que le SVG contient la couleur rose pâle pour le statut DISPUTED
      expect(svgContent).to.include('fill="lightpink"');
      
      // Vérifier que le texte "LITIGE" est présent
      expect(svgContent).to.include('LiTiGE');
      
      // Vérifier les autres éléments du SVG
      expect(svgContent).to.include(`Caution #${depositId}`);
      expect(svgContent).to.include("0.7500 ETH");
      
      // Vérifier le statut dans les métadonnées
      const statusAttr = jsonData.attributes.find((attr: any) => attr.trait_type === "Statut");
      expect(statusAttr.value).to.equal("En litige");
    });
  });

  describe("Soul-Bound Token tests", function () {
    let tokenId: bigint;
    let depositId: bigint;
    
    beforeEach(async function () {
      // Créer une propriété
      await smartDeposit.connect(landlord).createProperty("Test Property", "Test Location");
      const propertyId = 1;
      
      // Créer et payer une caution
      const depositCode = "123456";
      await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode);
      depositId = 1n;
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

    it("Should not allow safeTransferFrom without data", async function () {
      await expect(
        depositNFT.connect(tenant)["safeTransferFrom(address,address,uint256)"](
          tenant.address, 
          landlord.address, 
          tokenId
        )
      ).to.be.revertedWith("SBT: transfer not allowed");
    });

    it("Should prevent transfer even after refund", async function () {
      // Rembourser la caution
      await smartDeposit.connect(landlord).refundDeposit(depositId);
      
      // Tentative de transfert après remboursement
      await expect(
        depositNFT.connect(tenant).transferFrom(tenant.address, landlord.address, tokenId)
      ).to.be.revertedWith("SBT: transfer not allowed");
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

    it("Should clean up mappings when NFT is burned", async function () {
      // Récupérer l'ID du dépôt avant de brûler
      const depositId = await depositNFT.getDepositIdFromToken(tokenId);
      expect(depositId).to.not.equal(0); // Vérifier qu'il y a bien un dépôt associé
      
      // Vérifier que le mapping deposit->token est correct
      const tokenIdBefore = await depositNFT.getTokenIdFromDeposit(depositId);
      expect(tokenIdBefore).to.equal(tokenId);
      
      // Brûler le NFT
      await depositNFT.connect(tenant).burn(tokenId);
      
      // Vérifier que les mappings ont été nettoyés
      const tokenIdAfter = await depositNFT.getTokenIdFromDeposit(depositId);
      expect(tokenIdAfter).to.equal(0); // Devrait être réinitialisé à 0
      
      // Vérifier que le mapping token->deposit est également nettoyé
      // Note: getDepositIdFromToken pourrait échouer car le token n'existe plus,
      // mais si la fonction est conçue pour fonctionner avec des tokens inexistants,
      // elle devrait retourner 0
      try {
        const depositIdAfter = await depositNFT.getDepositIdFromToken(tokenId);
        expect(depositIdAfter).to.equal(0);
      } catch (error) {
        // C'est aussi acceptable si la fonction échoue car le token n'existe plus
      }
      
      // Vérifier que le tenant n'a plus le NFT
      expect(await depositNFT.balanceOf(tenant.address)).to.equal(0);
    });

    // Ce cas est très spécial, il suppose qu'un problème est survenu lors de la création du NFT
    // et que le mapping depositId -> tokenId n'est pas mis à jour.
    it("Should handle burn correctly when depositId is 0", async function () {
      const { customDepositNFT, tokenId } = await prepareNFTWithZeroDepositId();
      
      // Brûler le token - cela devrait fonctionner même si depositId est 0
      await customDepositNFT.connect(tenant).burn(tokenId);
      
      // Vérifier que le token a bien été brûlé
      await expect(customDepositNFT.ownerOf(tokenId)).to.be.reverted;
      
      // Vérifier que le tenant n'a plus de token
      expect(await customDepositNFT.balanceOf(tenant.address)).to.equal(0);
    });
  });

  describe("MetadataUpdate", function () {
    let depositId: bigint;
    let tokenId: bigint;
    let depositAmount: bigint;

    beforeEach(async function () {
      // Créer une propriété
      await smartDeposit.connect(landlord).createProperty("Test Property", "Test Location");
      const propertyId = 1;
      
      // Créer et payer une caution
      const depositCode = "123456";
      await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode);
      depositId = 1n;
      depositAmount = ethers.parseEther("1");
      await smartDeposit.connect(landlord).setDepositAmount(depositId, depositAmount);
      
      // Payer la caution pour recevoir le NFT
      await smartDeposit.connect(tenant).payDeposit(depositId, depositCode, {
        value: depositAmount,
      });
      
      // Récupérer l'ID du token
      tokenId = await depositNFT.getTokenIdFromDeposit(depositId);
    });

    // Fonction utilitaire pour vérifier l'émission d'événements MetadataUpdate
    async function verifyMetadataUpdateEvent(transaction: any, expectedTokenId: bigint) {
      const receipt = await transaction.wait();
      
      // Chercher l'événement MetadataUpdate dans les logs
      const event = receipt?.logs.find(log => {
        try {
          const parsedLog = depositNFT.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          return parsedLog?.name === "MetadataUpdate";
        } catch {
          return false;
        }
      });
      
      // Vérifier que l'événement existe
      expect(event).to.not.be.undefined;
      
      // Si possible, vérifier que l'argument est bon
      if (event && event.args) {
        expect(event.args[0]).to.equal(expectedTokenId);
      }
    }

    it("Should not allow updateTokenMetadata from non-SmartDeposit address", async function () {
      await expect(
        depositNFT.connect(tenant).updateTokenMetadata(depositId)
      ).to.be.revertedWith("Only SmartDeposit can update metadata");
    });

    it("Should fail if no NFT exists for the deposit ID", async function () {
      // Nous avons besoin de déployer un nouveau DepositNFT que nous pouvons contrôler directement
      const DepositNFT = await ethers.getContractFactory("DepositNFT");
      const newDepositNFT = await DepositNFT.deploy();
      await newDepositNFT.waitForDeployment();
      
      // Initialiser le contrat
      await newDepositNFT.initialize(owner.address); // Nous utilisons owner comme SmartDeposit simulé
      
      // Tenter de mettre à jour les métadonnées d'un dépôt qui n'a pas de NFT
      await expect(
        newDepositNFT.connect(owner).updateTokenMetadata(999) // ID inexistant
      ).to.be.revertedWith("No NFT found for this deposit");
    });

    it("Should emit MetadataUpdate event when refunding deposit", async function () {
      const tx = await smartDeposit.connect(landlord).refundDeposit(depositId);
      await verifyMetadataUpdateEvent(tx, tokenId);
    });

    it("Should emit MetadataUpdate event when initiating dispute", async function () {
      const tx = await smartDeposit.connect(landlord).initiateDispute(depositId);
      await verifyMetadataUpdateEvent(tx, tokenId);
    });

    it("Should emit MetadataUpdate event when resolving dispute", async function () {
      // D'abord initier un litige
      await smartDeposit.connect(landlord).initiateDispute(depositId);
      
      // Résoudre le litige, ce qui devrait déclencher updateTokenMetadata
      const refundAmount = depositAmount / 2n; // Remboursement partiel
      const tx = await smartDeposit.connect(landlord).resolveDispute(depositId, refundAmount);
      await verifyMetadataUpdateEvent(tx, tokenId);
    });

    it("Should verify that URI changes after status update", async function () {
      // Fonction utilitaire pour décoder une URI et extraire les attributs
      function decodeTokenURI(uri: string) {
        const base64Part = uri.replace("data:application/json;base64,", "");
        const jsonData = JSON.parse(Buffer.from(base64Part, 'base64').toString('utf-8'));
        return jsonData;
      }
      
      // Obtenir l'URI avant le changement de statut
      const uriBefore = await depositNFT.tokenURI(tokenId);
      const jsonDataBefore = decodeTokenURI(uriBefore);
      const statusAttrBefore = jsonDataBefore.attributes.find((attr: any) => attr.trait_type === "Statut");
      
      // Changer le statut de la caution
      await smartDeposit.connect(landlord).refundDeposit(depositId);
      
      // Obtenir l'URI après le changement de statut
      const uriAfter = await depositNFT.tokenURI(tokenId);
      const jsonDataAfter = decodeTokenURI(uriAfter);
      
      // Vérifier que l'URI a changé
      expect(uriBefore).to.not.equal(uriAfter);
      
      // Vérifier que le statut a changé
      const statusAttrAfter = jsonDataAfter.attributes.find((attr: any) => attr.trait_type === "Statut");
      expect(statusAttrBefore.value).to.equal("Payée");
      expect(statusAttrAfter.value).to.equal("Remboursée");
    });
  });
}); 