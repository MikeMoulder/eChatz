import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PaymentRouter", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let feeRecipient: HardhatEthersSigner;

  let idReg: any;
  let msgStore: any;
  let payRouter: any;

  const FEE_BPS = 30; // 0.30%

  beforeEach(async () => {
    [deployer, alice, bob, feeRecipient] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    idReg = await IdentityRegistry.deploy();
    await idReg.waitForDeployment();

    const MessageStore = await ethers.getContractFactory("MessageStore");
    msgStore = await MessageStore.deploy(await idReg.getAddress());
    await msgStore.waitForDeployment();

    const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
    payRouter = await PaymentRouter.deploy(
      await msgStore.getAddress(),
      await idReg.getAddress(),
      feeRecipient.address,
      FEE_BPS
    );
    await payRouter.waitForDeployment();

    // Wire MessageStore trusted caller
    await msgStore.setTrustedCaller(await payRouter.getAddress(), true);
  });

  describe("constructor", () => {
    it("sets feeBps correctly", async () => {
      expect(await payRouter.feeBps()).to.equal(FEE_BPS);
    });

    it("sets protocolFeeRecipient correctly", async () => {
      expect(await payRouter.protocolFeeRecipient()).to.equal(feeRecipient.address);
    });

    it("reverts if feeBps > MAX_FEE_BPS at deploy time", async () => {
      const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
      await expect(
        PaymentRouter.deploy(
          await msgStore.getAddress(),
          await idReg.getAddress(),
          feeRecipient.address,
          9999 // > 1000 bps
        )
      ).to.be.revertedWith("fee too high");
    });
  });

  describe("setFeeBps", () => {
    it("owner can update fee", async () => {
      await expect(payRouter.setFeeBps(50))
        .to.emit(payRouter, "FeeBpsUpdated")
        .withArgs(50);
    });

    it("reverts if fee > MAX_FEE_BPS", async () => {
      await expect(payRouter.setFeeBps(9999))
        .to.be.revertedWithCustomError(payRouter, "FeeTooHigh");
    });

    it("non-owner cannot update fee", async () => {
      await expect(payRouter.connect(alice).setFeeBps(10))
        .to.be.revertedWithCustomError(payRouter, "OwnableUnauthorizedAccount");
    });
  });

  describe("sendETH — registration gate", () => {
    it("reverts if sender not registered", async () => {
      await expect(
        payRouter.connect(alice).sendETH(
          bob.address,
          ethers.ZeroHash, // dummy handle
          "0x",            // dummy proof
          { value: ethers.parseEther("0.01") }
        )
      ).to.be.revertedWithCustomError(payRouter, "SenderNotRegistered");
    });
  });

  describe("fulfillRequest — not found", () => {
    it("reverts on non-existent request", async () => {
      await expect(payRouter.connect(alice).fulfillRequest(999))
        .to.be.revertedWithCustomError(payRouter, "RequestNotFound");
    });
  });

  describe("approveEscrowRelease — not found", () => {
    it("reverts on non-existent escrow", async () => {
      await expect(payRouter.connect(alice).approveEscrowRelease(999))
        .to.be.revertedWithCustomError(payRouter, "EscrowNotFound");
    });
  });

  describe("contributeToSplit — not found", () => {
    it("reverts on non-existent split", async () => {
      await expect(payRouter.connect(alice).contributeToSplit(999))
        .to.be.revertedWithCustomError(payRouter, "SplitNotFound");
    });
  });
});
