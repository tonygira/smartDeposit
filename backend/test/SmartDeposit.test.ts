import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SmartDeposit } from '../typechain-types'
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
    const SmartDeposit = await ethers.getContractFactory('SmartDeposit')
    const smartDeposit = await SmartDeposit.deploy() as SmartDeposit
    return { smartDeposit, owner, landlord, tenant, other }
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
    })

    describe('Modifier Checks', function () {
      it('should fail when non-existent property is queried', async function () {
        const { smartDeposit } = await loadFixture(deploySmartDepositFixture)
        await expect(
          smartDeposit.getProperty(999n)
        ).to.be.revertedWith("Property does not exist")
      })
    })
  })

  describe('3. Deposit Creation and Setup', function () {
    describe('Success Cases', function () {
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
        ).to.be.revertedWith("Only landlord or tenant can add files")
      })

      it('should fail when adding file to non-existent deposit', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)

        await expect(
          addTestFile(smartDeposit, landlord, 999n)
        ).to.be.revertedWith("Deposit does not exist")
      })

      it('should fail when adding file with invalid type', async function () {
        const { smartDeposit, landlord } = await loadFixture(deploySmartDepositFixture)
        const { depositId } = await setupDeposit(smartDeposit, landlord)

        await expect(
          addTestFile(smartDeposit, landlord, depositId, 99) // Invalid file type
        ).to.be.revertedWith("Invalid file type")
      })
    })
  })
})