import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const MSG_STORE   = "0x54768713E7FB1278CEd53225A01579BB71e0507f";
  const ID_REGISTRY = "0x78DafC029aa976eD498da867324F18d5203c02A4";
  const FEE_RECIPIENT = deployer.address;
  const FEE_BPS = 30;

  console.log("Deploying PaymentRouter...");
  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const paymentRouter = await PaymentRouter.deploy(MSG_STORE, ID_REGISTRY, FEE_RECIPIENT, FEE_BPS);
  await paymentRouter.waitForDeployment();
  const addr = await paymentRouter.getAddress();
  console.log(`PaymentRouter deployed at: ${addr}`);

  // Wire: MessageStore must trust new PaymentRouter for sendSystemMessage
  const msgStoreAbi = ["function setTrustedCaller(address caller, bool trusted) external"];
  const msgStore = new ethers.Contract(MSG_STORE, msgStoreAbi, deployer);
  const tx = await msgStore.setTrustedCaller(addr, true);
  await tx.wait();
  console.log(`MessageStore.setTrustedCaller(${addr}) ✓`);
  console.log(`\nUpdate frontend/.env.local:\nNEXT_PUBLIC_PAYMENT_ROUTER_ADDR=${addr}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
