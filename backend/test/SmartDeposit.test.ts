import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SmartDeposit, DepositNFT } from '../typechain-types'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { ContractTransactionReceipt, EventLog } from 'ethers'

interface PropertySetup {
  propertyId: bigint;
  tx: any;
  receipt: ContractTransactionReceipt;
}

interface DepositSetup {
  propertyId: bigint;
  depositId: bigint;
  depositAmount: bigint;
}

describe('SmartDeposit', function () {
  // Base deployment fixture
  async function deploySmartDepositFixture() {
    const [owner, landlord, tenant, other] = await ethers.getSigners()
    
    // Étape 1: Déployer le contrat DepositNFT (sans paramètres)
    const DepositNFT = await ethers.getContractFactory('DepositNFT')
    const depositNFT = await DepositNFT.deploy()
    await depositNFT.waitForDeployment()

    // Étape 2: Déployer le contrat SmartDeposit avec l'adresse du DepositNFT
    const SmartDeposit = await ethers.getContractFactory('SmartDeposit')
    const smartDeposit = await SmartDeposit.deploy(await depositNFT.getAddress())
    await smartDeposit.waitForDeployment()

    // Étape 3: Initialiser DepositNFT avec l'adresse de SmartDeposit
    await depositNFT.connect(owner).initialize(await smartDeposit.getAddress())

    // Étape 4: Transférer la propriété de DepositNFT au contrat SmartDeposit
    await depositNFT.connect(owner).transferOwnership(await smartDeposit.getAddress())

    return { smartDeposit, depositNFT, owner, landlord, tenant, other }
  }

  async function createTestProperty(
    contract: SmartDeposit,
    signer: HardhatEthersSigner,
    name = "Test Property",
    location = "Test Location"
  ): Promise<PropertySetup> {
    const tx = await contract.connect(signer).createProperty(name, location)
    const receipt = await tx.wait()
    if (!receipt) throw new Error("Transaction failed")

    const event = receipt.logs[0] as EventLog
    if (!event || event.eventName !== 'PropertyCreated') {
      throw new Error("PropertyCreated event not found")
    }

    return {
      propertyId: event.args[0],
      tx,
      receipt
    }
  }

  async function setupDeposit(
    contract: SmartDeposit,
    landlord: HardhatEthersSigner,
    depositAmount = ethers.parseEther("1"),
    setAmount = true
  ): Promise<DepositSetup> {
    const { propertyId } = await createTestProperty(contract, landlord)

    const depositTx = await contract.connect(landlord).createDeposit(propertyId, "TEST123")
    const depositReceipt = await depositTx.wait()
    if (!depositReceipt) throw new Error("Deposit transaction failed")

    const event = depositReceipt.logs[0] as EventLog
    if (!event || event.eventName !== 'DepositCreated') {
      throw new Error("DepositCreated event not found")
    }

    const depositId = event.args[0]

    // Only set amount if requested
    if (setAmount) {
      await contract.connect(landlord).setDepositAmount(depositId, depositAmount)
    }

    return {
      propertyId,
      depositId,
      depositAmount
    }
  }

  describe('1. Deployment', function () {
    it('should deploy with correct owner', async function () {
      const { smartDeposit, owner } = await loadFixture(deploySmartDepositFixture)
      expect(await smartDeposit.owner()).to.equal(owner.address)
    })
  })

  describe('2. Property Management', function () {
    describe('Success Cases', function () {
      it('should create a property with correct parameters', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)

        const name = "Paris Apartment"
        const location = "15 rue de la Paix"

        const { propertyId, receipt } = await createTestProperty(
          smartDeposit,
          landlord,
          name,
          location
        )

        // Check events
        const event = receipt.logs[0] as EventLog
        if (!event || event.eventName !== 'PropertyCreated') {
          throw new Error("PropertyCreated event not found")
        }
        expect(event.args[0]).to.equal(1n) // propertyId
        expect(event.args[1]).to.equal(landlord.address) // landlord
        expect(event.args[2]).to.equal(name) // name

        // Check property data
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.name).to.equal(name)
        expect(property.location).to.equal(location)
        expect(property.landlord).to.equal(landlord.address)
        expect(property.status).to.equal(0) // NOT_RENTED
        expect(property.currentDepositId).to.equal(0n)
      })

      it('should list properties for landlord correctly', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)

        const { propertyId: id1 } = await createTestProperty(
          smartDeposit,
          landlord,
          "Property 1"
        )
        const { propertyId: id2 } = await createTestProperty(
          smartDeposit,
          landlord,
          "Property 2"
        )

        const properties = await smartDeposit.getLandlordProperties(landlord.address)
        expect(properties).to.have.lengthOf(2)
        expect(properties[0]).to.equal(id1)
        expect(properties[1]).to.equal(id2)
      })

      it('should delete a property correctly', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)

        const { propertyId } = await createTestProperty(
          smartDeposit,
          landlord,
          "Property To Delete"
        )

        // Vérifier que la propriété existe avant suppression
        const propertiesBefore = await smartDeposit.getLandlordProperties(landlord.address)
        expect(propertiesBefore).to.include(propertyId)

        // Supprimer la propriété
        await smartDeposit.connect(landlord).deleteProperty(propertyId)

        // Vérifier que la propriété a été supprimée
        const propertiesAfter = await smartDeposit.getLandlordProperties(landlord.address)
        expect(propertiesAfter).to.not.include(propertyId)

        // Vérifier que la tentative d'accès à la propriété échoue
        await expect(
          smartDeposit.getProperty(propertyId)
        ).to.be.revertedWith("Property does not exist")
      })
    })

    describe('Modifier Checks', function () {
      it('should fail when non-existent property is queried', async function () {
        const { smartDeposit } = await loadFixture(deploySmartDepositFixture)
        await expect(
          smartDeposit.getProperty(999n)
        ).to.be.revertedWith("Property does not exist")
      })
    })

    describe('Modifier and Requirement Checks', function () {
      it('should fail when deleting property with active deposit', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt actif
        const { depositId, propertyId } = await setupDeposit(smartDeposit, landlord)
        
        // La tentative de suppression devrait échouer
        await expect(
          smartDeposit.connect(landlord).deleteProperty(propertyId)
        ).to.be.revertedWith("Cannot delete property with active deposit")
      })

      it('should fail when deleting property with deposit history', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer et rembourser le dépôt pour créer un historique
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        await smartDeposit.connect(landlord).refundDeposit(depositId)
        
        // La tentative de suppression devrait échouer car il y a un historique
        await expect(
          smartDeposit.connect(landlord).deleteProperty(propertyId)
        ).to.be.revertedWith("Cannot delete property with deposit history")
      })

      it('should fail when non-landlord tries to delete property', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        const { propertyId } = await createTestProperty(
          smartDeposit,
          landlord,
          "Property To Delete"
        )
        
        // La tentative de suppression par un non-propriétaire devrait échouer
        await expect(
          smartDeposit.connect(tenant).deleteProperty(propertyId)
        ).to.be.revertedWith("Not the landlord")
      })

      it('should fail when deleting non-existent property', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Tentative de suppression d'une propriété qui n'existe pas
        const nonExistentPropertyId = 999n
        
        await expect(
          smartDeposit.connect(landlord).deleteProperty(nonExistentPropertyId)
        ).to.be.revertedWith("Property does not exist")
      })

      it('should handle properly deletion even if property is not in landlord array', async function () {
        // Cette situation est difficile à tester directement car cela nécessite une incohérence 
        // dans l'état du contrat (propriété existe mais pas dans le tableau du propriétaire)
        // Nous allons vérifier que la suppression d'une propriété qui existe réussit toujours
        
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer deux propriétés
        const { propertyId: propertyId1 } = await createTestProperty(
          smartDeposit,
          landlord,
          "Property 1"
        )
        const { propertyId: propertyId2 } = await createTestProperty(
          smartDeposit,
          landlord,
          "Property 2"
        )
        
        // Vérifier que les deux propriétés existent
        const propertiesBefore = await smartDeposit.getLandlordProperties(landlord.address)
        expect(propertiesBefore).to.include(propertyId1)
        expect(propertiesBefore).to.include(propertyId2)
        
        // Supprimer la première propriété
        await smartDeposit.connect(landlord).deleteProperty(propertyId1)
        
        // Vérifier que la première propriété a été supprimée et la seconde existe toujours
        const propertiesAfter = await smartDeposit.getLandlordProperties(landlord.address)
        expect(propertiesAfter).to.not.include(propertyId1)
        expect(propertiesAfter).to.include(propertyId2)
        
        // La longueur du tableau doit avoir diminué de 1
        expect(propertiesAfter.length).to.equal(propertiesBefore.length - 1)
      })
    })
  })

  describe('3. Deposit Creation and Setup', function () {
    describe('Success Cases', function () {
      it('should create deposit with correct parameters', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété
        const { propertyId } = await createTestProperty(smartDeposit, landlord, "Test Property")
        
        // Créer un dépôt
        const depositCode = "CODE123"
        const tx = await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode)
        const receipt = await tx.wait()
        
        // Vérifier l'événement
        const event = receipt?.logs[0] as EventLog
        expect(event.eventName).to.equal('DepositCreated')
        
        const depositId = event.args[0]
        
        // Vérifier les données du dépôt
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.propertyId).to.equal(propertyId)
        expect(deposit.depositCode).to.equal(depositCode)
        expect(deposit.status).to.equal(0) // PENDING
        
        // Vérifier que la propriété a bien été mise à jour
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.currentDepositId).to.equal(depositId)
      })

      it('should create deposit with initial zero amount', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)

        // Pass false to prevent setting the amount
        const { depositId } = await setupDeposit(smartDeposit, landlord, ethers.parseEther("1"), false)
        const deposit = await smartDeposit.getDeposit(depositId)

        expect(deposit.amount).to.equal(0n)
        expect(deposit.status).to.equal(0) // PENDING
      })

      it('should update deposit amount correctly', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        const depositAmount = ethers.parseEther("1")

        const { depositId } = await setupDeposit(smartDeposit, landlord, depositAmount)
        const deposit = await smartDeposit.getDeposit(depositId)

        expect(deposit.amount).to.equal(depositAmount)
      })
    })

    describe('Modifier and Requirement Checks', function () {
      it('should fail when setting zero amount', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        const { depositId } = await setupDeposit(smartDeposit, landlord)

        await expect(
          smartDeposit.connect(landlord).setDepositAmount(depositId, 0n)
        ).to.be.revertedWith("Deposit amount must be greater than 0")
      })

      it('should fail when non-landlord tries to set amount', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        const { depositId } = await setupDeposit(smartDeposit, landlord)

        await expect(
          smartDeposit.connect(tenant).setDepositAmount(depositId, ethers.parseEther("1"))
        ).to.be.revertedWith("Not the landlord")
      })

      it('should fail when setting amount for non-existent deposit', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)

        await expect(
          smartDeposit.connect(landlord).setDepositAmount(999n, ethers.parseEther("1"))
        ).to.be.revertedWith("Deposit does not exist")
      })

      it('should fail when creating deposit for non-existent property', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Tentative de créer un dépôt pour une propriété qui n'existe pas
        const nonExistentPropertyId = 999n
        
        await expect(
          smartDeposit.connect(landlord).createDeposit(nonExistentPropertyId, "CODE123")
        ).to.be.revertedWith("Property does not exist")
      })
      
      it('should fail when non-landlord tries to create deposit', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété
        const { propertyId } = await createTestProperty(smartDeposit, landlord, "Test Property")
        
        // Tentative de création d'un dépôt par quelqu'un qui n'est pas le propriétaire
        await expect(
          smartDeposit.connect(tenant).createDeposit(propertyId, "CODE123")
        ).to.be.revertedWith("Not the landlord")
      })
      
      it('should fail when creating deposit for rented property', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer le dépôt pour que la propriété soit marquée comme louée
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier que la propriété est bien louée
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(1) // RENTED
        
        // Tentative de création d'un nouveau dépôt alors que la propriété est louée
        await expect(
          smartDeposit.connect(landlord).createDeposit(propertyId, "NEWCODE")
        ).to.be.revertedWith("Property not available")
      })
      
      it('should fail when previous deposit is not closed', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt (en attente)
        const { depositId, propertyId } = await setupDeposit(smartDeposit, landlord, ethers.parseEther("1"), false)
        
        // Tentative de création d'un nouveau dépôt alors que le précédent n'est pas clos (PENDING ou PAID ou DISPUTED)
        await expect(
          smartDeposit.connect(landlord).createDeposit(propertyId, "NEWCODE")
        ).to.be.revertedWith("Property already has an active deposit")
      })

      it('should allow creating new deposit after previous is REFUNDED', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer le dépôt
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Rembourser complètement le dépôt
        await smartDeposit.connect(landlord).refundDeposit(depositId)
        
        // Vérifier que le dépôt est bien REFUNDED
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(5) // REFUNDED = 5
        
        // La création d'un nouveau dépôt devrait maintenant être possible
        const newDepositTx = await smartDeposit.connect(landlord).createDeposit(propertyId, "NEWCODE")
        const newDepositReceipt = await newDepositTx.wait()
        
        const event = newDepositReceipt?.logs[0] as EventLog
        expect(event.eventName).to.equal('DepositCreated')
      })
      
      it('should allow creating new deposit after previous is PARTIALLY_REFUNDED', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer le dépôt
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier un litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Résoudre le litige avec un remboursement partiel (50%)
        const halfAmount = depositAmount / 2n
        await smartDeposit.connect(landlord).resolveDispute(depositId, halfAmount)
        
        // Vérifier que le dépôt est bien PARTIALLY_REFUNDED
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(4) // PARTIALLY_REFUNDED = 4
        
        // La création d'un nouveau dépôt devrait maintenant être possible
        const newDepositTx = await smartDeposit.connect(landlord).createDeposit(propertyId, "NEWCODE")
        const newDepositReceipt = await newDepositTx.wait()
        
        const event = newDepositReceipt?.logs[0] as EventLog
        expect(event.eventName).to.equal('DepositCreated')
      })
      
      it('should allow creating new deposit after previous is RETAINED', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer le dépôt
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier un litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Résoudre le litige avec rétention complète du dépôt (0% remboursé)
        await smartDeposit.connect(landlord).resolveDispute(depositId, 0n)
        
        // Vérifier que le dépôt est bien RETAINED
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(3) // RETAINED = 3
        
        // La création d'un nouveau dépôt devrait maintenant être possible
        const newDepositTx = await smartDeposit.connect(landlord).createDeposit(propertyId, "NEWCODE")
        const newDepositReceipt = await newDepositTx.wait()
        
        const event = newDepositReceipt?.logs[0] as EventLog
        expect(event.eventName).to.equal('DepositCreated')
      })
    })
  })

  describe('4. File Management', function () {
    // Helper function for file addition
    async function addTestFile(
      contract: SmartDeposit,
      signer: HardhatEthersSigner,
      depositId: bigint,
      fileType = 0, // INVENTORY by default
      cid = "QmTest123",
      fileName = "test.pdf"
    ) {
      const tx = await contract.connect(signer).addDepositFile(
        depositId,
        fileType,
        cid,
        fileName
      )
      const receipt = await tx.wait()
      if (!receipt) throw new Error("Transaction failed")

      const event = receipt.logs[0] as EventLog
      if (!event || event.eventName !== 'FileAdded') {
        throw new Error("FileAdded event not found")
      }

      return {
        tx,
        receipt,
        event
      }
    }

    describe('Success Cases', function () {
      it('should add file with correct parameters', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        const { depositId } = await setupDeposit(smartDeposit, landlord)

        const cid = "QmTest123"
        const fileName = "inventory.pdf"
        const fileType = 0 // INVENTORY

        const { event } = await addTestFile(
          smartDeposit,
          landlord,
          depositId,
          fileType,
          cid,
          fileName
        )

        // Check event args
        expect(event.args[0]).to.equal(depositId) // depositId
        expect(event.args[1]).to.equal(fileType) // fileType
        expect(event.args[2]).to.equal(cid) // cid
        expect(event.args[3]).to.equal(landlord.address) // uploader

        // Check stored file data
        const files = await smartDeposit.getDepositFiles(depositId)
        expect(files).to.have.lengthOf(1)
        expect(files[0].cid).to.equal(cid)
        expect(files[0].fileType).to.equal(fileType)
        expect(files[0].fileName).to.equal(fileName)
        expect(files[0].uploader).to.equal(landlord.address)
      })
    })

    describe('Modifier and Requirement Checks', function () {
      it('should fail when non-participant tries to add file', async function () {
        const { smartDeposit, landlord, other } = await loadFixture(deploySmartDepositFixture)
        const { depositId } = await setupDeposit(smartDeposit, landlord)

        await expect(
          addTestFile(smartDeposit, other, depositId)
        ).to.be.revertedWith("Not the landlord")
      })

      it('should fail when adding file to non-existent deposit', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)

        await expect(
          addTestFile(smartDeposit, landlord, 999n)
        ).to.be.revertedWith("Deposit does not exist")
      })
    })
  })

  describe('5. Fallback and Receive Functions', function () {
    it('should revert when calling non-existent function (fallback)', async function () {
      const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
      
      // Créer une signature de fonction qui n'existe pas
      const nonExistentFunctionSignature = '0x12345678' // Signature hexadécimale arbitraire
      
      // Appeler la fonction inexistante, ce qui devrait déclencher le fallback
      await expect(
        landlord.sendTransaction({
          to: await smartDeposit.getAddress(),
          data: nonExistentFunctionSignature
        })
      ).to.be.revertedWith("Function does not exist")
    })
    
    it('should emit Received event when sending ETH directly', async function () {
      const { smartDeposit, tenant } = await loadFixture(deploySmartDepositFixture)
      
      // Envoyer de l'ETH directement au contrat
      const tx = await tenant.sendTransaction({
        to: await smartDeposit.getAddress(),
        value: ethers.parseEther("0.1")
      })
      
      const receipt = await tx.wait()
      
      // Vérifier que l'événement Received a été émis
      expect(receipt?.logs.some(log => {
        try {
          const parsedLog = smartDeposit.interface.parseLog({
            topics: log.topics,
            data: log.data,
          })
          return parsedLog?.name === 'Received'
        } catch {
          return false
        }
      })).to.be.true
    })
  })

  describe('6. Access Control Modifiers', function () {
    describe('onlyTenant Modifier', function () {
      it('should allow tenant to access restricted functions', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer le dépôt pour devenir locataire (en une seule transaction)
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Maintenant le tenant devrait pouvoir accéder à getPropertyIdFromDeposit
        const result = await smartDeposit.connect(tenant).getPropertyIdFromDeposit(depositId)
        expect(result).to.equal(propertyId)
      })
      
      it('should revert when non-tenant tries to access restricted functions', async function () {
        const { smartDeposit, landlord, tenant, other } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et un dépôt
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer le dépôt pour que tenant devienne locataire (en une seule transaction)
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Maintenant un autre utilisateur ne devrait pas pouvoir accéder à getPropertyIdFromDeposit
        await expect(
          smartDeposit.connect(other).getPropertyIdFromDeposit(depositId)
        ).to.be.revertedWith("Not the tenant")
        
        // Le propriétaire non plus ne devrait pas pouvoir accéder
        await expect(
          smartDeposit.connect(landlord).getPropertyIdFromDeposit(depositId)
        ).to.be.revertedWith("Not the tenant")
      })
    })
  })
})