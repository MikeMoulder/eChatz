import { ethers, network } from "hardhat";

/**
 * Full sequential deployment for eChatz contracts.
 *
 * Deploy order (dependency-driven):
 *   1. IdentityRegistry   — no deps
 *   2. InviteRegistry     — needs IdentityRegistry
 *   3. MessageStore       — needs IdentityRegistry
 *   4. PaymentRouter      — needs MessageStore + IdentityRegistry
 *   5. VotingModule       — needs MessageStore + IdentityRegistry
 *   6. ScheduleModule     — needs PaymentRouter + IdentityRegistry
 *
 * Post-deploy wiring:
 *   - IdentityRegistry.setInviteRegistry(inviteRegistry.address)
 *   - MessageStore.setTrustedCaller(paymentRouter.address, true)
 *   - MessageStore.setTrustedCaller(votingModule.address, true)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying eChatz to network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const PROTOCOL_FEE_RECIPIENT = deployer.address; // override in production
  const FEE_BPS                = 30;               // 0.30%
  const AUTOMATION_EXECUTOR    = deployer.address; // override with Gelato relay addr

  // ─────────────────────────────────────────────
  //  1. IdentityRegistry
  // ─────────────────────────────────────────────
  console.log("1/6 Deploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const idRegAddr = await identityRegistry.getAddress();
  console.log(`    IdentityRegistry deployed at: ${idRegAddr}`);

  // ─────────────────────────────────────────────
  //  2. InviteRegistry
  // ─────────────────────────────────────────────
  console.log("2/6 Deploying InviteRegistry...");
  const InviteRegistry = await ethers.getContractFactory("InviteRegistry");
  const inviteRegistry = await InviteRegistry.deploy(idRegAddr);
  await inviteRegistry.waitForDeployment();
  const invRegAddr = await inviteRegistry.getAddress();
  console.log(`    InviteRegistry deployed at: ${invRegAddr}`);

  // ─────────────────────────────────────────────
  //  3. MessageStore
  // ─────────────────────────────────────────────
  console.log("3/6 Deploying MessageStore...");
  const MessageStore = await ethers.getContractFactory("MessageStore");
  const messageStore = await MessageStore.deploy(idRegAddr);
  await messageStore.waitForDeployment();
  const msgStoreAddr = await messageStore.getAddress();
  console.log(`    MessageStore deployed at: ${msgStoreAddr}`);

  // ─────────────────────────────────────────────
  //  4. PaymentRouter
  // ─────────────────────────────────────────────
  console.log("4/6 Deploying PaymentRouter...");
  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const paymentRouter = await PaymentRouter.deploy(
    msgStoreAddr,
    idRegAddr,
    PROTOCOL_FEE_RECIPIENT,
    FEE_BPS
  );
  await paymentRouter.waitForDeployment();
  const payRouterAddr = await paymentRouter.getAddress();
  console.log(`    PaymentRouter deployed at: ${payRouterAddr}`);

  // ─────────────────────────────────────────────
  //  5. VotingModule
  // ─────────────────────────────────────────────
  console.log("5/6 Deploying VotingModule...");
  const VotingModule = await ethers.getContractFactory("VotingModule");
  const votingModule = await VotingModule.deploy(msgStoreAddr, idRegAddr);
  await votingModule.waitForDeployment();
  const voteModAddr = await votingModule.getAddress();
  console.log(`    VotingModule deployed at: ${voteModAddr}`);

  // ─────────────────────────────────────────────
  //  6. ScheduleModule
  // ─────────────────────────────────────────────
  console.log("6/6 Deploying ScheduleModule...");
  const ScheduleModule = await ethers.getContractFactory("ScheduleModule");
  const scheduleModule = await ScheduleModule.deploy(
    payRouterAddr,
    idRegAddr,
    AUTOMATION_EXECUTOR
  );
  await scheduleModule.waitForDeployment();
  const schedModAddr = await scheduleModule.getAddress();
  console.log(`    ScheduleModule deployed at: ${schedModAddr}`);

  // ─────────────────────────────────────────────
  //  Post-deploy wiring
  // ─────────────────────────────────────────────
  console.log("\nWiring contracts...");

  // Wire InviteRegistry into IdentityRegistry
  let tx = await identityRegistry.setInviteRegistry(invRegAddr);
  await tx.wait();
  console.log("    IdentityRegistry.setInviteRegistry ✓");

  // Authorize PaymentRouter to write system messages
  tx = await messageStore.setTrustedCaller(payRouterAddr, true);
  await tx.wait();
  console.log("    MessageStore.setTrustedCaller(PaymentRouter) ✓");

  // Authorize VotingModule to write system messages
  tx = await messageStore.setTrustedCaller(voteModAddr, true);
  await tx.wait();
  console.log("    MessageStore.setTrustedCaller(VotingModule) ✓");

  // ─────────────────────────────────────────────
  //  Summary
  // ─────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════");
  console.log("eChatz Deployment Complete");
  console.log("════════════════════════════════════════════");
  const addresses = {
    NEXT_PUBLIC_IDENTITY_REGISTRY_ADDR: idRegAddr,
    NEXT_PUBLIC_INVITE_REGISTRY_ADDR:   invRegAddr,
    NEXT_PUBLIC_MESSAGE_STORE_ADDR:     msgStoreAddr,
    NEXT_PUBLIC_PAYMENT_ROUTER_ADDR:    payRouterAddr,
    NEXT_PUBLIC_VOTING_MODULE_ADDR:     voteModAddr,
    SCHEDULE_MODULE_ADDR:               schedModAddr,
    NEXT_PUBLIC_CHAIN_ID:               network.config.chainId ?? 31337,
  };
  console.log(JSON.stringify(addresses, null, 2));
  console.log("\nCopy the above into frontend/.env.local");

  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
