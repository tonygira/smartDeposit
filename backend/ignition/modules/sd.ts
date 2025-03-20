// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SDModule = buildModule("SDModule", (m) => {
  const smartDeposit = m.contract("SmartDeposit");

  return { smartDeposit };
});

export default SDModule;
