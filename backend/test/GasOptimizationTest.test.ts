import { ethers } from "hardhat";
import { expect } from "chai";

async function measureGas(txPromise: Promise<any>, isView: boolean = false): Promise<string> {
    if (isView) {
        // Lecture : Pas de transaction, on ne mesure pas le gas
        await txPromise;
        return "View function (no gas cost)";
    }
    const tx = await txPromise;
    const receipt = await tx.wait();
    return receipt.gasUsed.toString();
}

describe("Gas Optimization Test", function () {
    let contract: any;
    let owner: any;

    beforeEach(async function () {
        const Contract = await ethers.getContractFactory("GasOptimizationTest");
        contract = await Contract.deploy();
        await contract.waitForDeployment();
        [owner] = await ethers.getSigners();
    });

    it("Gas test: Adding properties", async function () {
        const gasDynamic = await measureGas(contract.addPropertyDynamic(1));
        const gasFixed = await measureGas(contract.addPropertyFixed(1));
        const gasPacked = await measureGas(contract.addPropertyPacked(1));

        console.log("Gas usage for adding property:");
        console.log(`- Dynamic (uint256[]): ${gasDynamic}`);
        console.log(`- Fixed (uint32[1000]): ${gasFixed}`);
        console.log(`- Packed (bytes32[]): ${gasPacked}`);
    });

    it("Gas test: Reading properties", async function () {
        for (let i = 1; i <= 10; i++) {
            await contract.addPropertyDynamic(i);
            await contract.addPropertyFixed(i);
            await contract.addPropertyPacked(i);
        }

        const gasReadDynamic = await measureGas(contract.getPropertiesDynamic(), true);
        const gasReadFixed = await measureGas(contract.getPropertiesFixed(), true);
        const gasReadPacked = await measureGas(contract.getPropertiesPacked(), true);

        console.log("Gas usage for reading properties:");
        console.log(`- Dynamic (uint256[]): ${gasReadDynamic}`);
        console.log(`- Fixed (uint32[1000]): ${gasReadFixed}`);
        console.log(`- Packed (bytes32[]): ${gasReadPacked}`);
    });
});
