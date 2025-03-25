import { parseAbi } from "viem"

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3"
export const SEPOLIA_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || ""

export const SMART_DEPOSIT_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "OwnableInvalidOwner",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "OwnableUnauthorizedAccount",
      "type": "error"
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
          "internalType": "enum SmartDeposit.DepositStatus",
          "name": "status",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "tenantDepositAmount",
          "type": "uint256"
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
          "internalType": "address",
          "name": "previousOwner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "OwnershipTransferred",
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
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_propertyId",
          "type": "uint256"
        }
      ],
      "name": "deleteProperty",
      "outputs": [],
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
          "name": "finalAmount",
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
          "internalType": "uint256",
          "name": "_propertyId",
          "type": "uint256"
        }
      ],
      "name": "getDepositIdFromProperty",
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
          "internalType": "uint256",
          "name": "_depositId",
          "type": "uint256"
        }
      ],
      "name": "getPropertyIdFromDeposit",
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
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
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
      "inputs": [],
      "name": "renounceOwnership",
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
          "internalType": "uint256",
          "name": "_tenantDepositAmount",
          "type": "uint256"
        }
      ],
      "name": "resolveDispute",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "newOwner",
          "type": "address"
        }
      ],
      "name": "transferOwnership",
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
    default:
      return "Non loué"
  }
}

export enum DepositStatus {
  PENDING = 0,
  ACTIVE = 1,
  DISPUTED = 2,
  RETAINED = 3,
  PARTIALLY_REFUNDED = 4,
  REFUNDED = 5,
}

export function getDepositStatusText(status: number) {
  console.log("getDepositStatusText reçoit:", status, "de type", typeof status);
  
  switch (status) {
    case DepositStatus.PENDING:
      return "En attente"
    case DepositStatus.ACTIVE:
      return "Active"
    case DepositStatus.DISPUTED:
      return "En litige"
    case DepositStatus.REFUNDED:
      return "Remboursée"
    case DepositStatus.PARTIALLY_REFUNDED:
      return "Partiellement remboursée"
    case DepositStatus.RETAINED:
      return "Conservée"
    default:
      return "En attente"
  }
}