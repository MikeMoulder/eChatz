import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("InviteRegistry", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;

  let idRegAddr: string;
  let invRegAddr: string;
  let idReg: Awaited<ReturnType<typeof ethers.getContractAt>>;
  let invReg: Awaited<ReturnType<typeof ethers.getContractAt>>;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    // Deploy IdentityRegistry
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const idRegContract = await IdentityRegistry.deploy();
    await idRegContract.waitForDeployment();
    idRegAddr = await idRegContract.getAddress();
    idReg = idRegContract as unknown as Awaited<ReturnType<typeof ethers.getContractAt>>;

    // Deploy InviteRegistry
    const InviteRegistry = await ethers.getContractFactory("InviteRegistry");
    const invRegContract = await InviteRegistry.deploy(idRegAddr);
    await invRegContract.waitForDeployment();
    invRegAddr = await invRegContract.getAddress();
    invReg = invRegContract as unknown as Awaited<ReturnType<typeof ethers.getContractAt>>;

    // Wire
    await (idReg as any).setInviteRegistry(invRegAddr);
  });

  it("hasPendingInvite returns false before any invite", async () => {
    expect(await (invReg as any).hasPendingInvite(bob.address)).to.equal(false);
  });

  it("unregistered user cannot create an invite", async () => {
    await expect(
      (invReg as any).connect(alice).createInvite(bob.address, "link-slug-001")
    ).to.be.revertedWithCustomError(invReg, "InviterNotRegistered");
  });

  it("non-inviteRegistry cannot call redeemInvite", async () => {
    await expect(
      (invReg as any).connect(alice).redeemInvite(bob.address)
    ).to.be.revertedWithCustomError(invReg, "CallerNotIdentityRegistry");
  });

  it("invalid inviteId reverts cancelInvite", async () => {
    await expect(
      (invReg as any).connect(alice).cancelInvite(999)
    ).to.be.revertedWithCustomError(invReg, "InvalidInviteId");
  });

  it("getSentInvites returns empty for new address", async () => {
    const sent = await (invReg as any).getSentInvites(alice.address);
    expect(sent.length).to.equal(0);
  });
});
