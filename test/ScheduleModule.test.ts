import { expect } from "chai";
import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ScheduleModule", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let automationExecutor: HardhatEthersSigner;

  let idReg: any;
  let msgStore: any;
  let payRouter: any;
  let schedMod: any;

  beforeEach(async () => {
    [deployer, alice, bob, automationExecutor] = await ethers.getSigners();

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
      deployer.address,
      30
    );
    await payRouter.waitForDeployment();
    await msgStore.setTrustedCaller(await payRouter.getAddress(), true);

    const ScheduleModule = await ethers.getContractFactory("ScheduleModule");
    schedMod = await ScheduleModule.deploy(
      await payRouter.getAddress(),
      await idReg.getAddress(),
      automationExecutor.address
    );
    await schedMod.waitForDeployment();
  });

  describe("constructor", () => {
    it("sets automationExecutor correctly", async () => {
      expect(await schedMod.automationExecutor()).to.equal(automationExecutor.address);
    });
  });

  describe("setAutomationExecutor", () => {
    it("owner can update executor", async () => {
      await expect(schedMod.setAutomationExecutor(alice.address))
        .to.emit(schedMod, "AutomationExecutorUpdated")
        .withArgs(alice.address);
    });

    it("non-owner cannot update executor", async () => {
      await expect(schedMod.connect(alice).setAutomationExecutor(bob.address))
        .to.be.revertedWithCustomError(schedMod, "OwnableUnauthorizedAccount");
    });
  });

  describe("executeScheduled — not found / not executor", () => {
    it("reverts if schedule not found", async () => {
      await expect(
        schedMod.connect(automationExecutor).executeScheduled(999)
      ).to.be.revertedWithCustomError(schedMod, "ScheduleNotFound");
    });

    it("reverts if not automation executor and not owner", async () => {
      await expect(
        schedMod.connect(alice).executeScheduled(1)
      ).to.be.revertedWithCustomError(schedMod, "NotAutomationExecutor");
    });
  });

  describe("isDue", () => {
    it("returns false for non-existent schedule", async () => {
      expect(await schedMod.isDue(999)).to.equal(false);
    });
  });

  describe("pauseSchedule / resumeSchedule / cancelSchedule — not found", () => {
    it("pauseSchedule reverts on not found", async () => {
      await expect(schedMod.connect(alice).pauseSchedule(999))
        .to.be.revertedWithCustomError(schedMod, "ScheduleNotFound");
    });

    it("resumeSchedule reverts on not found", async () => {
      await expect(schedMod.connect(alice).resumeSchedule(999))
        .to.be.revertedWithCustomError(schedMod, "ScheduleNotFound");
    });

    it("cancelSchedule reverts on not found", async () => {
      await expect(schedMod.connect(alice).cancelSchedule(999))
        .to.be.revertedWithCustomError(schedMod, "ScheduleNotFound");
    });
  });

  describe("getOwnerSchedules", () => {
    it("returns empty array for new address", async () => {
      const schedules = await schedMod.getOwnerSchedules(alice.address);
      expect(schedules.length).to.equal(0);
    });
  });
});
