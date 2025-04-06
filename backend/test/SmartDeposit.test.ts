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
        
        // Créer une caution
        const depositCode = "CODE123"
        const tx = await smartDeposit.connect(landlord).createDeposit(propertyId, depositCode)
        const receipt = await tx.wait()
        
        // Vérifier l'événement
        const event = receipt?.logs[0] as EventLog
        expect(event.eventName).to.equal('DepositCreated')
        
        const depositId = event.args[0]
        
        // Vérifier les données de la caution
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
      
      it('should fail when setting amount for non-pending deposit', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour changer son statut de PENDING à PAID
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier que la caution a bien le statut PAID
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(1) // PAID
        
        // Tentative de modification du montant après paiement
        await expect(
          smartDeposit.connect(landlord).setDepositAmount(depositId, ethers.parseEther("2"))
        ).to.be.revertedWith("Deposit not pending")
      })

      it('should fail when creating deposit for non-existent property', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Tentative de créer une caution pour une propriété qui n'existe pas
        const nonExistentPropertyId = 999n
        
        await expect(
          smartDeposit.connect(landlord).createDeposit(nonExistentPropertyId, "CODE123")
        ).to.be.revertedWith("Property does not exist")
      })
      
      it('should fail when non-landlord tries to create deposit', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété
        const { propertyId } = await createTestProperty(smartDeposit, landlord, "Test Property")
        
        // Tentative de création d'une caution par quelqu'un qui n'est pas le propriétaire
        await expect(
          smartDeposit.connect(tenant).createDeposit(propertyId, "CODE123")
        ).to.be.revertedWith("Not the landlord")
      })
      
      it('should fail when creating deposit for rented property', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour que la propriété soit marquée comme louée
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier que la propriété est bien louée
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(1) // RENTED
        
        // Tentative de création d'une nouvelle caution alors que la propriété est louée
        await expect(
          smartDeposit.connect(landlord).createDeposit(propertyId, "NEWCODE")
        ).to.be.revertedWith("Property not available")
      })
      
      it('should fail when previous deposit is not closed', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution (en attente)
        const { depositId, propertyId } = await setupDeposit(smartDeposit, landlord, ethers.parseEther("1"), false)
        
        // Tentative de création d'une nouvelle caution alors que la précédente n'est pas close (PENDING ou PAID ou DISPUTED)
        await expect(
          smartDeposit.connect(landlord).createDeposit(propertyId, "NEWCODE")
        ).to.be.revertedWith("Property already has an active deposit")
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

  describe('4. Deposit Payment', function () {
    describe('Success Cases', function () {
      it('should allow tenant to pay deposit with correct code and amount', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        const tx = await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        const receipt = await tx.wait()
        
        // Vérifier que l'événement DepositPaid a été émis
        const event = receipt?.logs.find((log) => {
          try {
            const parsed = smartDeposit.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })
            return parsed?.name === 'DepositPaid'
          } catch {
            return false
          }
        })
        
        expect(event).to.not.be.undefined
        
        // Vérifier que la caution a bien été mise à jour
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.tenant).to.equal(tenant.address)
        expect(deposit.status).to.equal(1) // PAID
        expect(deposit.paymentDate).to.not.equal(0)
        
        // Vérifier que la propriété a bien été mise à jour
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(1) // RENTED
      })
    })
    
    describe('Modifier and Requirement Checks', function () {
      it('should fail when paying non-existent deposit', async function () {
        const { smartDeposit, tenant } = await loadFixture(deploySmartDepositFixture)
        
        const nonExistentDepositId = 999n
        
        await expect(
          smartDeposit.connect(tenant).payDeposit(nonExistentDepositId, "TEST123", {
            value: ethers.parseEther("1")
          })
        ).to.be.revertedWith("Deposit does not exist")
      })
      
      it('should fail when paying deposit with wrong status', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution une première fois
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Tenter de payer la caution une seconde fois
        await expect(
          smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
            value: depositAmount
          })
        ).to.be.revertedWith("Deposit not requested")
      })
      
      it('should fail when paying deposit with wrong code', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Tenter de payer la caution avec un mauvais code
        await expect(
          smartDeposit.connect(tenant).payDeposit(depositId, "WRONG_CODE", {
            value: depositAmount
          })
        ).to.be.revertedWith("Invalid deposit code")
      })
      
      it('should fail when paying deposit with incorrect amount', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Tenter de payer la caution avec un montant incorrect
        await expect(
          smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
            value: depositAmount + 1n
          })
        ).to.be.revertedWith("Incorrect amount")
      })
    })
  })

  describe('5. Deposit Refund', function () {
    describe('Success Cases', function () {
      it('should allow landlord to refund deposit', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier le solde du contrat avant remboursement
        const contractBalance = await ethers.provider.getBalance(await smartDeposit.getAddress())
        expect(contractBalance).to.equal(depositAmount)
        
        // Enregistrer le solde du locataire avant remboursement
        const tenantBalanceBefore = await ethers.provider.getBalance(tenant.address)
        
        // Effectuer le remboursement
        const tx = await smartDeposit.connect(landlord).refundDeposit(depositId)
        const receipt = await tx.wait()
        
        // Vérifier que l'événement DepositRefunded a été émis
        const event = receipt?.logs.find((log) => {
          try {
            const parsed = smartDeposit.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })
            return parsed?.name === 'DepositRefunded'
          } catch {
            return false
          }
        })
        
        expect(event).to.not.be.undefined
        
        // Vérifier que la caution a bien été mise à jour
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(5) // REFUNDED
        expect(deposit.refundDate).to.not.equal(0)
        expect(deposit.finalAmount).to.equal(depositAmount)
        
        // Vérifier que la propriété a bien été mise à jour
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(0) // NOT_RENTED
        expect(property.currentDepositId).to.equal(0n)
        
        // Vérifier que l'argent a bien été transféré au locataire
        const tenantBalanceAfter = await ethers.provider.getBalance(tenant.address)
        expect(tenantBalanceAfter).to.be.gt(tenantBalanceBefore)
        
        // Vérifier que le contrat n'a plus l'argent de la caution
        const contractBalanceAfter = await ethers.provider.getBalance(await smartDeposit.getAddress())
        expect(contractBalanceAfter).to.equal(0n)
      })

      it('should update NFT metadata when refunding deposit', async function () {
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier qu'un NFT a bien été créé
        const tokenId = await depositNFT.getTokenIdFromDeposit(depositId)
        expect(tokenId).to.be.gt(0, "Le NFT n'a pas été créé correctement")
        
        // Effectuer le remboursement
        await smartDeposit.connect(landlord).refundDeposit(depositId)
        
        // Vérifier les métadonnées du NFT
        const tokenURI = await depositNFT.tokenURI(tokenId)
        const decodedData = Buffer.from(tokenURI.split(',')[1], 'base64').toString('utf-8')
        
        // debug only
        // console.log("Métadonnées NFT après remboursement:", decodedData)
        
        /* Note: Le cas où tokenId=0 dans la fonction refundDeposit() n'est pas testé ici
           car il est théoriquement impossible d'avoir un dépôt payé sans NFT associé.
           Le code suivant dans SmartDeposit.sol n'est donc pas couvert par les tests:
           
           uint256 tokenId = depositNFT.getTokenIdFromDeposit(_depositId);
           if (tokenId > 0) {
               depositNFT.updateTokenMetadata(_depositId);
           }
           
           Pour tester ce cas, il faudrait manipuler l'état interne du contrat
           d'une façon qui ne devrait jamais se produire dans des conditions normales.
        */
        
        // Vérifier que le NFT existe toujours après le remboursement et appartient toujours au locataire
        const ownerAfterRefund = await depositNFT.ownerOf(tokenId).catch(() => null)
        expect(ownerAfterRefund).to.equal(tenant.address, "Le NFT n'appartient plus au locataire après remboursement")
        
        // Vérifier que le status indique "Remboursée" dans les attributs
        const jsonObj = JSON.parse(decodedData);
        const statusAttribute = jsonObj.attributes.find(attr => attr.trait_type === "Statut");
        expect(statusAttribute).to.not.be.undefined;
        expect(statusAttribute.value).to.equal("Remboursée");
      })
    })
    
    describe('Modifier and Requirement Checks', function () {
      it('should fail when refunding non-existent deposit', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        const nonExistentDepositId = 999n
        
        await expect(
          smartDeposit.connect(landlord).refundDeposit(nonExistentDepositId)
        ).to.be.revertedWith("Deposit does not exist")
      })
      
      it('should fail when non-landlord tries to refund deposit', async function () {
        const { smartDeposit, landlord, tenant, other } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Tentative de remboursement par le locataire
        await expect(
          smartDeposit.connect(tenant).refundDeposit(depositId)
        ).to.be.revertedWith("Not the landlord")
        
        // Tentative de remboursement par un tiers
        await expect(
          smartDeposit.connect(other).refundDeposit(depositId)
        ).to.be.revertedWith("Not the landlord")
      })
      
      it('should fail when refunding deposit with wrong status', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution (status PENDING)
        const { depositId } = await setupDeposit(smartDeposit, landlord, ethers.parseEther("1"), false)
        
        // Tenter de rembourser une caution qui n'a pas été payée
        await expect(
          smartDeposit.connect(landlord).refundDeposit(depositId)
        ).to.be.revertedWith("Deposit not paid")
      })
    })
  })

  describe('6. Dispute Management', function () {
    describe('Success Cases', function () {
      it('should allow landlord to initiate dispute on a paid deposit', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier le litige
        const tx = await smartDeposit.connect(landlord).initiateDispute(depositId)
        const receipt = await tx.wait()
        
        // Vérifier que l'événement DepositStatusChanged a été émis
        const statusEvent = receipt?.logs.find((log) => {
          try {
            const parsed = smartDeposit.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })
            return parsed?.name === 'DepositStatusChanged'
          } catch {
            return false
          }
        })
        
        expect(statusEvent).to.not.be.undefined
        
        // Vérifier que l'événement PropertyStatusChanged a été émis
        const propertyEvent = receipt?.logs.find((log) => {
          try {
            const parsed = smartDeposit.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })
            return parsed?.name === 'PropertyStatusChanged'
          } catch {
            return false
          }
        })
        
        expect(propertyEvent).to.not.be.undefined
        
        // Vérifier que la caution a bien été mise à jour
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(2) // DISPUTED
        
        // Vérifier que la propriété a bien été mise à jour
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(2) // DISPUTED
      })
      
      it('should update NFT metadata when initiating dispute', async function () {
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier qu'un NFT a bien été créé
        const tokenId = await depositNFT.getTokenIdFromDeposit(depositId)
        expect(tokenId).to.be.gt(0, "Le NFT n'a pas été créé correctement")
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Vérifier les métadonnées du NFT
        const tokenURI = await depositNFT.tokenURI(tokenId)
        const decodedData = Buffer.from(tokenURI.split(',')[1], 'base64').toString('utf-8')
        
        // debug only
        //console.log("Métadonnées NFT après litige:", decodedData)
        
        /* Note: Le cas où tokenId=0 dans la fonction initiateDispute() n'est pas testé ici
           car il est théoriquement impossible d'avoir un dépôt payé sans NFT associé.
           Le code suivant dans SmartDeposit.sol n'est donc pas couvert par les tests:
           
           uint256 tokenId = depositNFT.getTokenIdFromDeposit(_depositId);
           if (tokenId > 0) {
               depositNFT.updateTokenMetadata(_depositId);
           }
           
           Pour tester ce cas, il faudrait manipuler l'état interne du contrat
           d'une façon qui ne devrait jamais se produire dans des conditions normales.
        */
        
        // Vérifier que le status indique "En litige" dans les attributs
        const jsonObj = JSON.parse(decodedData);
        const statusAttribute = jsonObj.attributes.find(attr => attr.trait_type === "Statut");
        expect(statusAttribute).to.not.be.undefined;
        expect(statusAttribute.value).to.equal("En litige");
      })
    })
    
    describe('Modifier and Requirement Checks', function () {
      it('should fail when initiating dispute on non-existent deposit', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        const nonExistentDepositId = 999n
        
        await expect(
          smartDeposit.connect(landlord).initiateDispute(nonExistentDepositId)
        ).to.be.revertedWith("Deposit does not exist")
      })
      
      it('should fail when non-landlord tries to initiate dispute', async function () {
        const { smartDeposit, landlord, tenant, other } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Tentative d'initiation de litige par le locataire
        await expect(
          smartDeposit.connect(tenant).initiateDispute(depositId)
        ).to.be.revertedWith("Not the landlord")
        
        // Tentative d'initiation de litige par un tiers
        await expect(
          smartDeposit.connect(other).initiateDispute(depositId)
        ).to.be.revertedWith("Not the landlord")
      })
      
      it('should fail when initiating dispute on deposit with wrong status', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution (status PENDING)
        const { depositId } = await setupDeposit(smartDeposit, landlord, ethers.parseEther("1"), false)
        
        // Tenter d'initier un litige sur une caution qui n'a pas été payée
        await expect(
          smartDeposit.connect(landlord).initiateDispute(depositId)
        ).to.be.revertedWith("Deposit not paid")
      })
      
      it('should fail when initiating dispute on already disputed deposit', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Tenter d'initier à nouveau un litige sur la même caution
        await expect(
          smartDeposit.connect(landlord).initiateDispute(depositId)
        ).to.be.revertedWith("Deposit not paid")
      })
      
      it('should fail when initiating dispute on refunded deposit', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Rembourser la caution
        await smartDeposit.connect(landlord).refundDeposit(depositId)
        
        // Tenter d'initier un litige sur une caution remboursée
        await expect(
          smartDeposit.connect(landlord).initiateDispute(depositId)
        ).to.be.revertedWith("Deposit not paid")
      })
    })
  })

  describe('7. Dispute Resolution', function () {
    describe('Success Cases', function () {
      it('should allow landlord to resolve dispute with full refund', async function () {
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Vérifier le solde du contrat avant résolution
        const contractBalance = await ethers.provider.getBalance(await smartDeposit.getAddress())
        expect(contractBalance).to.equal(depositAmount)
        
        // Enregistrer le solde du locataire avant remboursement
        const tenantBalanceBefore = await ethers.provider.getBalance(tenant.address)
        
        // Résoudre le litige avec un remboursement complet
        const tx = await smartDeposit.connect(landlord).resolveDispute(depositId, depositAmount)
        const receipt = await tx.wait()
        
        // Vérifier que l'événement DepositRefunded a été émis
        const event = receipt?.logs.find((log) => {
          try {
            const parsed = smartDeposit.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            })
            return parsed?.name === 'DepositRefunded'
          } catch {
            return false
          }
        })
        
        expect(event).to.not.be.undefined
        
        // Vérifier que la caution a bien été mise à jour
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(5) // REFUNDED
        expect(deposit.refundDate).to.not.be.undefined
        expect(deposit.finalAmount).to.equal(depositAmount)
        
        // Vérifier que la propriété a bien été mise à jour
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(0) // NOT_RENTED
        expect(property.currentDepositId).to.equal(0n)
        
        // Vérifier que l'argent a bien été transféré au locataire
        const tenantBalanceAfter = await ethers.provider.getBalance(tenant.address)
        // Vérification exacte pour le locataire qui n'a pas payé de gas
        expect(tenantBalanceAfter).to.equal(tenantBalanceBefore + depositAmount)
        
        // Vérifier que le contrat n'a plus l'argent de la caution
        const contractBalanceAfter = await ethers.provider.getBalance(await smartDeposit.getAddress())
        expect(contractBalanceAfter).to.equal(0n)
      })

      it('should allow landlord to resolve dispute with partial refund', async function () {
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        const landlordBalanceBefore = await ethers.provider.getBalance(landlord.address)
        const tenantBalanceBefore = await ethers.provider.getBalance(tenant.address)
        
        // Résoudre le litige avec un remboursement partiel (50%)
        const refundAmount = depositAmount / 2n
        const tx = await smartDeposit.connect(landlord).resolveDispute(depositId, refundAmount)
        
        // Calculer les frais de gaz
        const receipt = await tx.wait()
        const gasCost = receipt.gasUsed * receipt.gasPrice
        
        // Vérifier que la caution a bien été mise à jour
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(4) // PARTIALLY_REFUNDED
        expect(deposit.refundDate).to.not.be.undefined
        expect(deposit.finalAmount).to.equal(refundAmount)
        
        // Vérifier que la propriété a bien été mise à jour
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(0) // NOT_RENTED
  
        // vérifier que le locataire a bien le montant remboursé
        const tenantBalanceAfter = await ethers.provider.getBalance(tenant.address)
        expect(tenantBalanceAfter).to.equal(tenantBalanceBefore + refundAmount)
        
        // Vérifier que la différence entre le montant initial et le remboursement est allée au propriétaire
        // En tenant compte des frais de gaz
        const landlordBalanceAfter = await ethers.provider.getBalance(landlord.address)
        expect(landlordBalanceAfter).to.equal(landlordBalanceBefore + depositAmount - refundAmount - gasCost)

        // Vérifier que le contrat n'a plus rien
        const contractBalanceAfter = await ethers.provider.getBalance(await smartDeposit.getAddress())
        expect(contractBalanceAfter).to.equal(0n)
      })

      it('should allow landlord to resolve dispute with retained deposit', async function () {  
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        const landlordBalanceBefore = await ethers.provider.getBalance(landlord.address)
        const tenantBalanceBefore = await ethers.provider.getBalance(tenant.address)
        const contractBalanceBefore = await ethers.provider.getBalance(await smartDeposit.getAddress())
        
        // Résoudre le litige avec un remboursement nul (caution retenue)
        const refundAmount = 0n
        const tx = await smartDeposit.connect(landlord).resolveDispute(depositId, refundAmount)
        
        // Calculer les frais de gaz
        const receipt = await tx.wait()
        const gasCost = receipt.gasUsed * receipt.gasPrice
        
        // Vérifier que la caution a bien été mise à jour
        const deposit = await smartDeposit.getDeposit(depositId)
        expect(deposit.status).to.equal(3) // RETAINED
        expect(deposit.refundDate).to.not.be.undefined
        expect(deposit.finalAmount).to.equal(refundAmount)
        
        // Vérifier que la propriété a bien été mise à jour
        const property = await smartDeposit.getProperty(propertyId)
        expect(property.status).to.equal(0) // NOT_RENTED

        // vérifier que le locataire n'a pas été remboursé
        const tenantBalanceAfter = await ethers.provider.getBalance(tenant.address)
        expect(tenantBalanceAfter).to.equal(tenantBalanceBefore)

        // vérifier que le contrat n'a plus rien
        const contractBalanceAfter = await ethers.provider.getBalance(await smartDeposit.getAddress())
        expect(contractBalanceAfter).to.equal(0n)

        // vérifier que le propriétaire a bien le montant de la caution
        // En tenant compte des frais de gaz
        const landlordBalanceAfter = await ethers.provider.getBalance(landlord.address)
        expect(landlordBalanceAfter).to.equal(landlordBalanceBefore + depositAmount - gasCost)
      })
      
      it('should update NFT metadata when resolving dispute with retained deposit', async function () {
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier qu'un NFT a bien été créé
        const tokenId = await depositNFT.getTokenIdFromDeposit(depositId)
        expect(tokenId).to.be.gt(0, "Le NFT n'a pas été créé correctement")
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Résoudre le litige avec un remboursement nul (caution retenue)
        const refundAmount = 0n
        await smartDeposit.connect(landlord).resolveDispute(depositId, refundAmount)
        
        // Vérifier les métadonnées du NFT
        const tokenURI = await depositNFT.tokenURI(tokenId)
        const decodedData = Buffer.from(tokenURI.split(',')[1], 'base64').toString('utf-8')
        
        /* Note: Le cas où tokenId=0 dans la fonction resolveDispute() n'est pas testé ici
           car il est théoriquement impossible d'avoir un dépôt payé sans NFT associé.
           Le code suivant dans SmartDeposit.sol n'est donc pas couvert par les tests:
           
           uint256 tokenId = depositNFT.getTokenIdFromDeposit(_depositId);
           if (tokenId > 0) {
               depositNFT.updateTokenMetadata(_depositId);
           }
           
           Pour tester ce cas, il faudrait manipuler l'état interne du contrat
           d'une façon qui ne devrait jamais se produire dans des conditions normales.
        */
        
        // Vérifier que le status indique "Retenue" dans les attributs
        const jsonObj = JSON.parse(decodedData);
        const statusAttribute = jsonObj.attributes.find(attr => attr.trait_type === "Statut");
        expect(statusAttribute).to.not.be.undefined;
        expect(statusAttribute.value).to.equal("Retenue");
      })
      
      it('should update NFT metadata when resolving dispute with full refund', async function () {
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier qu'un NFT a bien été créé
        const tokenId = await depositNFT.getTokenIdFromDeposit(depositId)
        expect(tokenId).to.be.gt(0, "Le NFT n'a pas été créé correctement")
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Résoudre le litige avec un remboursement complet
        await smartDeposit.connect(landlord).resolveDispute(depositId, depositAmount)
        
        // Vérifier les métadonnées du NFT
        const tokenURI = await depositNFT.tokenURI(tokenId)
        const decodedData = Buffer.from(tokenURI.split(',')[1], 'base64').toString('utf-8')
        
        // Vérifier que le status indique "Remboursée" dans les attributs
        const jsonObj = JSON.parse(decodedData);
        const statusAttribute = jsonObj.attributes.find(attr => attr.trait_type === "Statut");
        expect(statusAttribute).to.not.be.undefined;
        expect(statusAttribute.value).to.equal("Remboursée");
      })
      
      it('should update NFT metadata when resolving dispute with partial refund', async function () {
        const { smartDeposit, depositNFT, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour créer le NFT
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier qu'un NFT a bien été créé
        const tokenId = await depositNFT.getTokenIdFromDeposit(depositId)
        expect(tokenId).to.be.gt(0, "Le NFT n'a pas été créé correctement")
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Résoudre le litige avec un remboursement partiel
        const refundAmount = depositAmount / 2n
        await smartDeposit.connect(landlord).resolveDispute(depositId, refundAmount)
        
        // Vérifier les métadonnées du NFT
        const tokenURI = await depositNFT.tokenURI(tokenId)
        const decodedData = Buffer.from(tokenURI.split(',')[1], 'base64').toString('utf-8')
        
        // Vérifier que le status indique "Partiellement remboursée" dans les attributs
        const jsonObj = JSON.parse(decodedData);
        const statusAttribute = jsonObj.attributes.find(attr => attr.trait_type === "Statut");
        expect(statusAttribute).to.not.be.undefined;
        expect(statusAttribute.value).to.equal("Partiellement remboursée");
      })
    })
    
    describe('Modifier and Requirement Checks', function () {
      it('should fail when resolving non-existent deposit', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        const nonExistentDepositId = 999n
        
        await expect(
          smartDeposit.connect(landlord).resolveDispute(nonExistentDepositId, ethers.parseEther("1"))
        ).to.be.revertedWith("Deposit does not exist")
      })
      
      it('should fail when non-landlord tries to resolve dispute', async function () {
        const { smartDeposit, landlord, tenant, other } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Tentative de résolution par le locataire
        await expect(
          smartDeposit.connect(tenant).resolveDispute(depositId, depositAmount)
        ).to.be.revertedWith("Not the landlord")
        
        // Tentative de résolution par un tiers
        await expect(
          smartDeposit.connect(other).resolveDispute(depositId, depositAmount)
        ).to.be.revertedWith("Not the landlord")
      })
      
      it('should fail when resolving deposit with wrong status', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution (status PENDING)
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour obtenir le statut PAID
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Tenter de résoudre un litige sur une caution qui n'est pas en litige
        await expect(
          smartDeposit.connect(landlord).resolveDispute(depositId, depositAmount)
        ).to.be.revertedWith("Deposit not disputed")
      })
      
      it('should fail when refund amount exceeds deposit amount', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Initier le litige
        await smartDeposit.connect(landlord).initiateDispute(depositId)
        
        // Tenter de résoudre avec un montant de remboursement supérieur au dépôt
        await expect(
          smartDeposit.connect(landlord).resolveDispute(depositId, depositAmount + 1n)
        ).to.be.revertedWith("Refund exceeds deposit")
      })
    })
  })

  describe('8. Deposit Queries', function () {
    describe('Tenant Deposit Queries', function () {
      it('should return empty array for tenant with no deposits', async function () {
        const { smartDeposit, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Récupérer les cautions du locataire (qui n'en a pas encore)
        const deposits = await smartDeposit.getTenantDeposits(tenant.address)
        
        // Vérifier que le tableau est vide
        expect(deposits).to.be.an('array').that.is.empty
      })
      
      it('should retrieve all deposits for a tenant', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer plusieurs propriétés et cautions
        const { depositId: depositId1, propertyId: propertyId1 } = await setupDeposit(
          smartDeposit, 
          landlord, 
          ethers.parseEther("1")
        )
        
        const { depositId: depositId2, propertyId: propertyId2 } = await setupDeposit(
          smartDeposit, 
          landlord, 
          ethers.parseEther("2")
        )
        
        // Payer les cautions
        await smartDeposit.connect(tenant).payDeposit(depositId1, "TEST123", {
          value: ethers.parseEther("1")
        })
        
        await smartDeposit.connect(tenant).payDeposit(depositId2, "TEST123", {
          value: ethers.parseEther("2")
        })
        
        // Récupérer les cautions du locataire
        const deposits = await smartDeposit.getTenantDeposits(tenant.address)
        
        // Vérifier que le tableau contient les deux cautions
        expect(deposits).to.have.lengthOf(2)
        expect(deposits).to.include(depositId1)
        expect(deposits).to.include(depositId2)
      })
      
      it('should update tenant deposits after refund', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier que la caution est bien associée au locataire
        const depositsBefore = await smartDeposit.getTenantDeposits(tenant.address)
        expect(depositsBefore).to.have.lengthOf(1)
        expect(depositsBefore[0]).to.equal(depositId)
        
        // Rembourser la caution
        await smartDeposit.connect(landlord).refundDeposit(depositId)
        
        // Vérifier que la caution est toujours associée au locataire (même après remboursement)
        const depositsAfter = await smartDeposit.getTenantDeposits(tenant.address)
        expect(depositsAfter).to.have.lengthOf(1)
        expect(depositsAfter[0]).to.equal(depositId)
      })

      describe('Edge Cases', function () {
        it('should not return empty array for tenant with previous deposits that were refunded', async function () {
          const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
          
          // Créer une propriété et une caution
          const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
          
          // Payer la caution
          await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
            value: depositAmount
          })
          
          // Vérifier que le locataire a bien une caution active
          const depositsBeforeRefund = await smartDeposit.getTenantDeposits(tenant.address)
          expect(depositsBeforeRefund).to.have.lengthOf(1)
          
          // Rembourser la caution
          await smartDeposit.connect(landlord).refundDeposit(depositId)
          
          // Vérifier que le locataire a toujours la caution dans son historique
          const depositsAfterRefund = await smartDeposit.getTenantDeposits(tenant.address)
          expect(depositsAfterRefund).to.have.lengthOf(1)
          expect(depositsAfterRefund[0]).to.equal(depositId)
        })
      })
    })
    
    describe('Property Deposit Queries', function () {
      it('should return empty array for property with no deposit history', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété sans caution
        const { propertyId } = await createTestProperty(smartDeposit, landlord)
        
        // Récupérer l'historique des cautions de la propriété
        const deposits = await smartDeposit.connect(landlord).getPropertyDeposits(propertyId)
        
        // Vérifier que le tableau est vide
        expect(deposits).to.be.an('array').that.is.empty
      })
      
      it('should retrieve all deposit history for a property', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété
        const { propertyId } = await createTestProperty(smartDeposit, landlord)
        
        // Créer une première caution
        const depositTx1 = await smartDeposit.connect(landlord).createDeposit(propertyId, "CODE1")
        const depositReceipt1 = await depositTx1.wait()
        const depositEvent1 = depositReceipt1?.logs[0] as EventLog
        const depositId1 = depositEvent1.args[0]
        
        // Définir le montant de la caution
        await smartDeposit.connect(landlord).setDepositAmount(depositId1, ethers.parseEther("1"))
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId1, "CODE1", {
          value: ethers.parseEther("1")
        })
        
        // Rembourser la caution
        await smartDeposit.connect(landlord).refundDeposit(depositId1)
        
        // Créer une deuxième caution
        const depositTx2 = await smartDeposit.connect(landlord).createDeposit(propertyId, "CODE2")
        const depositReceipt2 = await depositTx2.wait()
        const depositEvent2 = depositReceipt2?.logs[0] as EventLog
        const depositId2 = depositEvent2.args[0]
        
        // Définir le montant de la caution
        await smartDeposit.connect(landlord).setDepositAmount(depositId2, ethers.parseEther("2"))
        
        // Récupérer l'historique des cautions de la propriété
        const deposits = await smartDeposit.connect(landlord).getPropertyDeposits(propertyId)
        
        // Vérifier que le tableau contient les deux cautions
        expect(deposits).to.have.lengthOf(2)
        expect(deposits).to.include(depositId1)
        expect(deposits).to.include(depositId2)
      })
      
      it('should record deposits in property history even after refund', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Vérifier que la caution est bien associée à la propriété
        const depositsBefore = await smartDeposit.connect(landlord).getPropertyDeposits(propertyId)
        expect(depositsBefore).to.have.lengthOf(1)
        expect(depositsBefore[0]).to.equal(depositId)
        
        // Rembourser la caution
        await smartDeposit.connect(landlord).refundDeposit(depositId)
        
        // Vérifier que la caution est toujours dans l'historique de la propriété
        const depositsAfter = await smartDeposit.connect(landlord).getPropertyDeposits(propertyId)
        expect(depositsAfter).to.have.lengthOf(1)
        expect(depositsAfter[0]).to.equal(depositId)
      })

      describe('Modifier Checks', function () {
        it('should fail when querying deposits for non-existent property', async function () {
          const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
          
          // Tentative de récupération des cautions pour une propriété qui n'existe pas
          const nonExistentPropertyId = 999n
          
          await expect(
            smartDeposit.connect(landlord).getPropertyDeposits(nonExistentPropertyId)
          ).to.be.revertedWith("Property does not exist")
        })
        
        it('should fail when non-landlord tries to query property deposits', async function () {
          const { smartDeposit, landlord, tenant, other } = await loadFixture(deploySmartDepositFixture)
          
          // Créer une propriété
          const { propertyId } = await createTestProperty(smartDeposit, landlord)
          
          // Tentative de récupération des cautions par le locataire (non propriétaire)
          await expect(
            smartDeposit.connect(tenant).getPropertyDeposits(propertyId)
          ).to.be.revertedWith("Not the landlord")
          
          // Tentative de récupération des cautions par un tiers (non propriétaire)
          await expect(
            smartDeposit.connect(other).getPropertyDeposits(propertyId)
          ).to.be.revertedWith("Not the landlord")
        })
      })
    })
  })

  describe('9. Additional Queries and Modifiers', function () {
    describe('Property and Deposit ID Retrieval', function () {
      it('should retrieve current deposit ID from property', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété
        const { propertyId } = await createTestProperty(smartDeposit, landlord)
        
        // Créer une caution
        const depositTx = await smartDeposit.connect(landlord).createDeposit(propertyId, "CODE123")
        const depositReceipt = await depositTx.wait()
        const depositEvent = depositReceipt?.logs[0] as EventLog
        const depositId = depositEvent.args[0]
        
        // Récupérer l'ID de la caution à partir de la propriété
        const retrievedDepositId = await smartDeposit.getDepositIdFromProperty(propertyId)
        
        // Vérifier que l'ID récupéré correspond bien à l'ID de la caution créée
        expect(retrievedDepositId).to.equal(depositId)
      })
      
      it('should retrieve property ID from deposit ID', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution pour devenir locataire
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Récupérer l'ID de la propriété à partir de l'ID de la caution
        const retrievedPropertyId = await smartDeposit.connect(tenant).getPropertyIdFromDeposit(depositId)
        
        // Vérifier que l'ID récupéré correspond bien à l'ID de la propriété
        expect(retrievedPropertyId).to.equal(propertyId)
      })
      
      describe('Modifier Checks for getDepositIdFromProperty', function () {
        it('should fail when querying non-existent property', async function () {
          const { smartDeposit } = await loadFixture(deploySmartDepositFixture)
          
          // Tentative de récupération de l'ID de caution pour une propriété qui n'existe pas
          const nonExistentPropertyId = 999n
          
          await expect(
            smartDeposit.getDepositIdFromProperty(nonExistentPropertyId)
          ).to.be.revertedWith("Property does not exist")
        })
      })
      
      describe('Modifier Checks for getPropertyIdFromDeposit', function () {
        it('should fail when querying non-existent deposit', async function () {
          const { smartDeposit, tenant } = await loadFixture(deploySmartDepositFixture)
          
          // Tentative de récupération de l'ID de propriété pour une caution qui n'existe pas
          const nonExistentDepositId = 999n
          
          await expect(
            smartDeposit.connect(tenant).getPropertyIdFromDeposit(nonExistentDepositId)
          ).to.be.revertedWith("Deposit does not exist")
        })
        
        it('should fail when non-tenant tries to query property ID from deposit', async function () {
          const { smartDeposit, landlord, tenant, other } = await loadFixture(deploySmartDepositFixture)
          
          // Créer une propriété et une caution
          const { depositId, depositAmount } = await setupDeposit(smartDeposit, landlord)
          
          // Payer la caution pour que tenant devienne le locataire
          await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
            value: depositAmount
          })
          
          // Tentative de récupération par le propriétaire
          await expect(
            smartDeposit.connect(landlord).getPropertyIdFromDeposit(depositId)
          ).to.be.revertedWith("Not the tenant")
          
          // Tentative de récupération par un tiers (non propriétaire)
          await expect(
            smartDeposit.connect(other).getPropertyIdFromDeposit(depositId)
          ).to.be.revertedWith("Not the tenant")
        })
      })
    })
    
    describe('Deposit and File Retrieval', function () {
      it('should retrieve deposit information correctly', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Récupérer les informations de la caution
        const deposit = await smartDeposit.getDeposit(depositId)
        
        // Vérifier que les informations sont correctes
        expect(deposit.propertyId).to.equal(propertyId)
        expect(deposit.amount).to.equal(depositAmount)
        expect(deposit.tenant).to.equal(tenant.address)
        expect(deposit.status).to.equal(1) // PAID
      })
      
      it('should retrieve deposit files correctly', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        const { depositId } = await setupDeposit(smartDeposit, landlord)
        
        // Ajouter un fichier à la caution
        const cid = "QmTest123"
        const fileName = "test.pdf"
        const fileType = 0 // INVENTORY
        
        await smartDeposit.connect(landlord).addDepositFile(
          depositId,
          fileType,
          cid,
          fileName
        )
        
        // Récupérer les fichiers de la caution
        const files = await smartDeposit.getDepositFiles(depositId)
        
        // Vérifier que les fichiers sont correctement récupérés
        expect(files).to.have.lengthOf(1)
        expect(files[0].cid).to.equal(cid)
        expect(files[0].fileName).to.equal(fileName)
        expect(files[0].fileType).to.equal(fileType)
        expect(files[0].uploader).to.equal(landlord.address)
      })
      
      describe('Modifier Checks', function () {
        it('should fail when getting non-existent deposit', async function () {
          const { smartDeposit } = await loadFixture(deploySmartDepositFixture)
          
          // Tentative de récupération d'une caution qui n'existe pas
          const nonExistentDepositId = 999n
          
          await expect(
            smartDeposit.getDeposit(nonExistentDepositId)
          ).to.be.revertedWith("Deposit does not exist")
        })
        
        it('should fail when getting files for non-existent deposit', async function () {
          const { smartDeposit } = await loadFixture(deploySmartDepositFixture)
          
          // Tentative de récupération des fichiers d'une caution qui n'existe pas
          const nonExistentDepositId = 999n
          
          await expect(
            smartDeposit.getDepositFiles(nonExistentDepositId)
          ).to.be.revertedWith("Deposit does not exist")
        })
      })
    })
    
    describe('NFT Extended Deposit Info', function () {
      it('should retrieve extended deposit information for NFT correctly', async function () {
        const { smartDeposit, landlord, tenant } = await loadFixture(deploySmartDepositFixture)
        
        // Créer une propriété et une caution
        const { depositId, propertyId, depositAmount } = await setupDeposit(smartDeposit, landlord)
        
        // Payer la caution
        await smartDeposit.connect(tenant).payDeposit(depositId, "TEST123", {
          value: depositAmount
        })
        
        // Récupérer les informations étendues de la caution pour le NFT
        const [
          retrievedPropertyId,
          retrievedTenant,
          retrievedAmount,
          retrievedStatus,
          paymentTimestamp,
          refundTimestamp,
          finalAmount,
          retrievedLandlord
        ] = await smartDeposit.getExtendedDepositInfoForNFT(depositId)
        
        // Vérifier que les informations sont correctes
        expect(retrievedPropertyId).to.equal(propertyId)
        expect(retrievedTenant).to.equal(tenant.address)
        expect(retrievedAmount).to.equal(depositAmount)
        expect(retrievedStatus).to.equal(1) // PAID
        expect(paymentTimestamp).to.be.gt(0) // Timestamp du paiement doit être > 0
        expect(refundTimestamp).to.equal(0) // Pas encore remboursé
        expect(finalAmount).to.equal(0) // Pas encore de montant final
        expect(retrievedLandlord).to.equal(landlord.address)
      })
      
      it('should fail when getting extended info for non-existent deposit', async function () {
        const { smartDeposit } = await loadFixture(deploySmartDepositFixture)
        
        // Tentative de récupération des informations étendues d'une caution qui n'existe pas
        const nonExistentDepositId = 999n
        
        await expect(
          smartDeposit.getExtendedDepositInfoForNFT(nonExistentDepositId)
        ).to.be.revertedWith("Deposit does not exist")
      })
    })
    
    describe('Contract Addresses', function () {
      it('should retrieve the DepositNFT contract address correctly', async function () {
        const { smartDeposit, depositNFT } = await loadFixture(deploySmartDepositFixture)
        
        // Récupérer l'adresse du contrat DepositNFT
        const nftAddress = await smartDeposit.getDepositNFTAddress()
        
        // Vérifier que l'adresse récupérée correspond bien à celle du contrat DepositNFT
        expect(nftAddress).to.equal(await depositNFT.getAddress())
      })
    })
  })
})