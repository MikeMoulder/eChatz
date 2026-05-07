import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * IdentityRegistry tests
 *
 * Uses mock-utils for FHE operations in the hardhat test environment.
 * All FHE operations are executed as simulated plaintext in local tests.
 */
describe("IdentityRegistry", function () {
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let identityRegistry: Awaited<ReturnType<typeof deployIdentityRegistry>>;

  async function deployIdentityRegistry() {
    const [deployer, a, b] = await ethers.getSigners();
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const contract = await IdentityRegistry.deploy();
    await contract.waitForDeployment();
    return { contract, deployer, a, b };
  }

  beforeEach(async () => {
    const result = await deployIdentityRegistry();
    identityRegistry = result;
    owner = result.deployer;
    alice = result.a;
    bob   = result.b;
  });

  describe("setInviteRegistry", () => {
    it("owner can set invite registry once", async () => {
      const { contract } = identityRegistry;
      const fakeAddr = ethers.Wallet.createRandom().address;
      await expect(contract.setInviteRegistry(fakeAddr))
        .to.emit(contract, "InviteRegistrySet")
        .withArgs(fakeAddr);
    });

    it("cannot be set twice", async () => {
      const { contract } = identityRegistry;
      const fakeAddr = ethers.Wallet.createRandom().address;
      await contract.setInviteRegistry(fakeAddr);
      await expect(contract.setInviteRegistry(ethers.Wallet.createRandom().address))
        .to.be.revertedWith("already set");
    });

    it("non-owner cannot set invite registry", async () => {
      const { contract } = identityRegistry;
      await expect(
        contract.connect(alice).setInviteRegistry(ethers.Wallet.createRandom().address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });

  describe("isRegistered", () => {
    it("returns false for unregistered address", async () => {
      const { contract } = identityRegistry;
      expect(await contract.isRegistered(alice.address)).to.equal(false);
    });
  });

  describe("getPublicKey", () => {
    it("reverts for unregistered user", async () => {
      const { contract } = identityRegistry;
      await expect(contract.getPublicKey(alice.address))
        .to.be.revertedWithCustomError(contract, "UserNotRegistered");
    });
  });

  describe("blockAddress", () => {
    it("isBlocked returns false before blocking", async () => {
      const { contract } = identityRegistry;
      expect(await contract.isBlocked(alice.address, bob.address)).to.equal(false);
    });
  });

  describe("linkDevice", () => {
    it("returns empty device list for unregistered user", async () => {
      const { contract } = identityRegistry;
      const devices = await contract.getLinkedDevices(alice.address);
      expect(devices.length).to.equal(0);
    });
  });
});
