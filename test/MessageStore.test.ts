import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * MessageStore tests
 *
 * NOTE: FHE input submission (fromExternal) requires the fhEVM local devnet or
 * mock-utils. These tests cover metadata, access control, and revert paths
 * which do NOT require an actual FHE encryption round.
 *
 * Integration tests covering sendMessage() with real FHE inputs should be run
 * against the fhEVM local devnet using @fhevm/mock-utils.
 */
describe("MessageStore", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  let msgStore: any;
  let idReg: any;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    idReg = await IdentityRegistry.deploy();
    await idReg.waitForDeployment();

    const MessageStore = await ethers.getContractFactory("MessageStore");
    msgStore = await MessageStore.deploy(await idReg.getAddress());
    await msgStore.waitForDeployment();
  });

  describe("setTrustedCaller", () => {
    it("owner can set trusted caller", async () => {
      await expect(msgStore.setTrustedCaller(alice.address, true))
        .to.emit(msgStore, "TrustedCallerSet")
        .withArgs(alice.address, true);
      expect(await msgStore.trustedCallers(alice.address)).to.equal(true);
    });

    it("non-owner cannot set trusted caller", async () => {
      await expect(
        msgStore.connect(alice).setTrustedCaller(bob.address, true)
      ).to.be.revertedWithCustomError(msgStore, "OwnableUnauthorizedAccount");
    });
  });

  describe("sendMessage — registration gate", () => {
    it("reverts if sender is not registered", async () => {
      // We pass dummy bytes for the handle/proof — the registration check fires first
      const dummyHandle = ethers.ZeroHash;
      const dummyProof  = "0x";
      await expect(
        msgStore.connect(alice).sendMessage(bob.address, dummyHandle, dummyProof, 0, 0)
      ).to.be.revertedWithCustomError(msgStore, "SenderNotRegistered");
    });
  });

  describe("getMessageMeta — access control", () => {
    it("non-participant cannot read message metadata (reverts)", async () => {
      // msg 0 never exists, check that NotParticipant fires
      await expect(
        msgStore.connect(carol).getMessageMeta(1)
      ).to.be.revertedWithCustomError(msgStore, "NotParticipant");
    });
  });

  describe("sendSystemMessage — trusted caller gate", () => {
    it("untrusted caller cannot send system message", async () => {
      await expect(
        msgStore.connect(alice).sendSystemMessage(
          alice.address, bob.address, ethers.ZeroHash, 1
        )
      ).to.be.revertedWithCustomError(msgStore, "NotTrustedCaller");
    });
  });

  describe("getThreadId", () => {
    it("returns 0 for non-existent thread", async () => {
      expect(await msgStore.getThreadId(alice.address, bob.address)).to.equal(0);
    });
  });

  describe("getThreadMessageIds", () => {
    it("returns empty array for non-existent thread", async () => {
      const ids = await msgStore.getThreadMessageIds(999, 0, 10);
      expect(ids.length).to.equal(0);
    });
  });
});
