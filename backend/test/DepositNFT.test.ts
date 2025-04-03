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
      expect(jsonData.image).to.equal("https://ipfs.io/ipfs/bafkreibujq7usmtlnaysncqriuwncuk2cjb2nqythu34ozropbeua6siii");

    });
  });
}); 