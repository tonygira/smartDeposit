import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["evm.bytecode.object", "evm.deployedBytecode.object"]
        }
      }
    }
  },
  defaultNetwork: 'hardhat',
  networks: {
    // sepolia: {
    //   url: process.env.SEPOLIA_RPC_URL,
    //   accounts: [`0x${process.env.PRIVATE_KEY}`],
    //   chainId: 11155111
    // },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
      loggingEnabled: true // Active les logs
    }
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY
    }
  }
};

export default config;
