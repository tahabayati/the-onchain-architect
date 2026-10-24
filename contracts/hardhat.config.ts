import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  // Hardhat v3 requires plugins to be registered here (side-effect imports no longer work).
  // The toolbox bundles Ignition, so this also registers the `ignition` task.
  plugins: [hardhatToolboxViemPlugin],
  solidity: "0.8.24", // Must match the pragma in ArchitectRegistry.sol
  defaultNetwork: "calibration",
  networks: {
    calibration: {
      type: "http",
      chainType: "l1",
      chainId: 314159,
      url: "https://api.calibration.node.glif.io/rpc/v1",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
});