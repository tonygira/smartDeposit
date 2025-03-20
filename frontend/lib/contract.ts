import { parseAbi } from "viem"

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
export const SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || ""

/*
export const SMART_DEPOSIT_ABI = parseAbi([
  // Events
  "event PropertyCreated(uint256 indexed propertyId, address indexed landlord, string name, uint256 depositAmount)",
  "event DepositMade(uint256 indexed depositId, uint256 indexed propertyId, address indexed tenant, uint256 amount)",
  "event DepositStatusChanged(uint256 indexed depositId, uint8 status)",
  "event DisputeRaised(uint256 indexed depositId, address indexed initiator)",
  "event DisputeResolved(uint256 indexed depositId, bool favorTenant)",

  // Functions
  "function createProperty(string memory _name, string memory _location, uint256 _depositAmount) external returns (uint256)",
  "function makeDeposit(uint256 _propertyId) external payable returns (uint256)",
  "function initiateDispute(uint256 _depositId) external",
  "function resolveDispute(uint256 _depositId, bool _favorTenant) external",
  "function releaseDeposit(uint256 _depositId) external",
  "function refundDeposit(uint256 _depositId) external",

  // View functions
  "function getLandlordProperties(address _landlord) external view returns (uint256[] memory)",
  "function getTenantDeposits(address _tenant) external view returns (uint256[] memory)",
  "function getPropertyDetails(uint256 _propertyId) external view returns (uint256 id, address landlord, string memory name, string memory location, uint256 depositAmount, bool isActive)",
  "function getDepositDetails(uint256 _depositId) external view returns (uint256 id, uint256 propertyId, address tenant, uint256 amount, uint256 timestamp, uint8 status)",
])*/


export const SMART_DEPOSIT_ABI = [
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "depositId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "propertyId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "tenant",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "DepositMade",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "depositId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "enum SmartDeposit.DepositStatus",
          "name": "status",
          "type": "uint8"
        }
      ],
      "name": "DepositStatusChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "depositId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "initiator",
          "type": "address"
        }
      ],
      "name": "DisputeRaised",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "depositId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "favorTenant",
          "type": "bool"
        }
      ],
      "name": "DisputeResolved",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "propertyId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "landlord",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "depositAmount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "enum SmartDeposit.PropertyStatus",
          "name": "status",
          "type": "uint8"
        }
      ],
      "name": "PropertyCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "propertyId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "enum SmartDeposit.PropertyStatus",
          "name": "status",
          "type": "uint8"
        }
      ],
      "name": "PropertyStatusChanged",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "_name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "_location",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "_depositAmount",
          "type": "uint256"
        }
      ],
      "name": "createProperty",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "depositCounter",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_depositId",
          "type": "uint256"
        }
      ],
      "name": "getDepositDetails",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "propertyId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "tenant",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        },
        {
          "internalType": "enum SmartDeposit.DepositStatus",
          "name": "status",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_landlord",
          "type": "address"
        }
      ],
      "name": "getLandlordProperties",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_propertyId",
          "type": "uint256"
        }
      ],
      "name": "getPropertyDetails",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "landlord",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "location",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "depositAmount",
          "type": "uint256"
        },
        {
          "internalType": "enum SmartDeposit.PropertyStatus",
          "name": "status",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_tenant",
          "type": "address"
        }
      ],
      "name": "getTenantDeposits",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_depositId",
          "type": "uint256"
        }
      ],
      "name": "initiateDispute",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_propertyId",
          "type": "uint256"
        }
      ],
      "name": "makeDeposit",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "propertyCounter",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_depositId",
          "type": "uint256"
        }
      ],
      "name": "refundDeposit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_depositId",
          "type": "uint256"
        }
      ],
      "name": "releaseDeposit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_depositId",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "_favorTenant",
          "type": "bool"
        }
      ],
      "name": "resolveDispute",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]

export enum PropertyStatus {
  NOT_RENTED = 0,
  RENTED = 1,
  DISPUTED = 2,
}

export const getPropertyStatusText = (status: number): string => {
  switch (status) {
    case PropertyStatus.NOT_RENTED:
      return "Non loué"
    case PropertyStatus.RENTED:
      return "Loué"
    case PropertyStatus.DISPUTED:
      return "En litige"
  }
}

export enum DepositStatus {
  PENDING = 0,
  ACTIVE = 1,
  DISPUTED = 2,
  RELEASED = 3,
  REFUNDED = 4,
}

export const getDepositStatusText = (status: number): string => {
  switch (status) {
    case DepositStatus.PENDING:
      return "En attente"
    case DepositStatus.ACTIVE:
      return "Actif"
    case DepositStatus.DISPUTED:
      return "En litige"
    case DepositStatus.RELEASED:
      return "Conservée"
    case DepositStatus.REFUNDED:
      return "Remboursée"
  }
}