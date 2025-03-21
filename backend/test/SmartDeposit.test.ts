const {
  loadFixture
} = require('@nomicfoundation/hardhat-toolbox/network-helpers')
const { expect, assert } = require('chai')
const { ethers } = require('hardhat')

describe('*** SMART DEPOSIT TEST SUITE ***', function () {
  async function deploySmartDepositContract () {
    const [owner, addr2, addr3, addr4] = await ethers.getSigners()
    const SmartDeposit = await ethers.getContractFactory('SmartDeposit')
    const smartDeposit = await SmartDeposit.deploy(SmartDeposit)
    return { smartDeposit, owner, addr2, addr3, addr4 }
  }

  describe('*** SMART DEPOSIT TEST SUITE ***', function () {
    it('should deploy the smart deposit contract', async function () {
      const { smartDeposit, owner, addr2, addr3, addr4 } = await loadFixture(
        deploySmartDepositContract
      )
      // Vérifie que le contrat est déployé avec une adresse valide
      expect(await smartDeposit.getAddress()).to.be.properAddress
      
      // Vérifie que le propriétaire du contrat est correctement défini
      expect(await smartDeposit.owner()).to.equal(owner.address)
      
      // Vérifie que les compteurs sont initialisés à 0
      expect(await smartDeposit.propertyCounter()).to.equal(0)
      expect(await smartDeposit.depositCounter()).to.equal(0)
    })
  })
})