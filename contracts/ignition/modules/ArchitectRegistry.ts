/**
 * Hardhat Ignition deployment module for ArchitectRegistry.
 *
 * WHAT: Deploys the ArchitectRegistry contract (no constructor arguments).
 * WHY: Ignition makes deployments declarative and reproducible, so grant
 *      reviewers and forkers can redeploy with a single command.
 * FILECOIN: Works with any FEVM network configured in hardhat.config.ts, e.g.
 *      npx hardhat ignition deploy ignition/modules/ArchitectRegistry.ts --network <network>
 */
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ArchitectRegistryModule", (m) => {
  const architectRegistry = m.contract("ArchitectRegistry");

  return { architectRegistry };
});
