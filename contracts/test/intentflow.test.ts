import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const ONE = ethers.parseEther("1");

async function deployFixture() {
  const [deployer, agent, user, other] = await ethers.getSigners();

  const registry = await (await ethers.getContractFactory("StrategyRegistry")).deploy();
  const gate = await (await ethers.getContractFactory("ApprovalGate")).deploy();
  const token = await (
    await ethers.getContractFactory("MockERC20")
  ).deploy("Wrapped BOT", "wBOT", 18, ethers.parseEther("1000000"));
  const dex = await (
    await ethers.getContractFactory("MockDEX")
  ).deploy("BOTSwap Stable Pool", 850);
  const lending = await (
    await ethers.getContractFactory("MockLendingPool")
  ).deploy(1240, 6800);
  const vault = await (
    await ethers.getContractFactory("IntentVault")
  ).deploy(await registry.getAddress(), await gate.getAddress(), agent.address);

  await registry.addStrategy(await dex.getAddress(), "BOTSwap Stable Pool", "DEX", 3, 850);
  await registry.addStrategy(
    await lending.getAddress(),
    "BOTLend Supply Market",
    "Lending",
    5,
    1240
  );

  // Fund the pools so the yield leg of a withdrawal is payable, and the demo user.
  await token.transfer(await dex.getAddress(), ethers.parseEther("10000"));
  await token.transfer(await lending.getAddress(), ethers.parseEther("10000"));
  await token.transfer(user.address, ethers.parseEther("1000"));

  return { deployer, agent, user, other, registry, gate, token, dex, lending, vault };
}

function intentHash(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

async function depositToVault(
  vault: any,
  token: any,
  user: HardhatEthersSigner,
  amount: bigint
) {
  await token.connect(user).approve(await vault.getAddress(), amount);
  await vault.connect(user).deposit(await token.getAddress(), amount);
}

describe("StrategyRegistry", () => {
  it("registers strategies and returns them with their ids", async () => {
    const { registry } = await deployFixture();
    const [ids, list] = await registry.getActiveStrategies();

    expect(ids.map(Number)).to.deep.equal([0, 1]);
    expect(list[0].name).to.equal("BOTSwap Stable Pool");
    expect(list[1].riskScore).to.equal(5n);
  });

  it("filters out paused strategies", async () => {
    const { registry } = await deployFixture();
    await registry.setStrategyActive(0, false);

    const [ids, list] = await registry.getActiveStrategies();
    expect(ids.map(Number)).to.deep.equal([1]);
    expect(list).to.have.length(1);
    expect(await registry.isActive(0)).to.equal(false);
  });

  it("rejects non-owner writes and out-of-range risk scores", async () => {
    const { registry, other, dex } = await deployFixture();
    await expect(
      registry.connect(other).addStrategy(await dex.getAddress(), "x", "DEX", 3, 100)
    ).to.be.revertedWithCustomError(registry, "NotOwner");
    await expect(
      registry.addStrategy(await dex.getAddress(), "x", "DEX", 11, 100)
    ).to.be.revertedWithCustomError(registry, "InvalidRisk");
  });
});

describe("ApprovalGate", () => {
  it("requires approval by default, and for anything above the threshold", async () => {
    const { gate, user } = await deployFixture();
    expect(await gate.requiresApproval(user.address, ONE)).to.equal(true);

    await gate.connect(user).setConfig(ethers.parseEther("100"));
    expect(await gate.requiresApproval(user.address, ethers.parseEther("50"))).to.equal(false);
    expect(await gate.requiresApproval(user.address, ethers.parseEther("150"))).to.equal(true);
  });

  it("lets the user approve one specific intent, and expires it", async () => {
    const { gate, user } = await deployFixture();
    const hash = intentHash("intent-1");
    await gate.connect(user).setConfig(ethers.parseEther("100"));

    expect(await gate.canExecute(user.address, hash, ethers.parseEther("150"))).to.equal(false);
    await gate.connect(user).approveIntent(hash);
    expect(await gate.canExecute(user.address, hash, ethers.parseEther("150"))).to.equal(true);

    await time.increase(31 * 60);
    expect(await gate.canExecute(user.address, hash, ethers.parseEther("150"))).to.equal(false);
  });

  it("scopes approval to the exact intent hash", async () => {
    const { gate, user } = await deployFixture();
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await gate.connect(user).approveIntent(intentHash("intent-1"));

    expect(
      await gate.canExecute(user.address, intentHash("intent-2"), ethers.parseEther("150"))
    ).to.equal(false);
  });
});

describe("IntentVault", () => {
  it("credits a deposit to the free balance", async () => {
    const { vault, token, user } = await deployFixture();
    await depositToVault(vault, token, user, ethers.parseEther("100"));

    expect(await vault.freeBalance(user.address, await token.getAddress())).to.equal(
      ethers.parseEther("100")
    );
  });

  it("executes an under-threshold intent and opens a position", async () => {
    const { vault, token, gate, user, agent } = await deployFixture();
    const amount = ethers.parseEther("50");
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await depositToVault(vault, token, user, amount);

    await expect(
      vault
        .connect(agent)
        .executeIntent(
          user.address,
          intentHash("yield-50"),
          0,
          await token.getAddress(),
          amount
        )
    ).to.emit(vault, "StrategyExecuted");

    const positions = await vault.getPositions(user.address);
    expect(positions).to.have.length(1);
    expect(positions[0].amount).to.equal(amount);
    expect(positions[0].active).to.equal(true);
    expect(await vault.freeBalance(user.address, await token.getAddress())).to.equal(0n);
    expect(await vault.deployedBalance(user.address, await token.getAddress())).to.equal(amount);
  });

  it("blocks an over-threshold intent until the user approves that exact hash", async () => {
    const { vault, token, gate, user, agent } = await deployFixture();
    const amount = ethers.parseEther("150");
    const hash = intentHash("yield-150");
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await depositToVault(vault, token, user, amount);

    const call = async () =>
      vault
        .connect(agent)
        .executeIntent(
          user.address,
          hash,
          0,
          await token.getAddress(),
          amount
        );

    await expect(call()).to.be.revertedWithCustomError(vault, "ApprovalRequired");

    await gate.connect(user).approveIntent(hash);
    await expect(call()).to.emit(vault, "StrategyExecuted");
  });

  it("requires approval for any amount when the user has never set a threshold", async () => {
    // ApprovalGate's default posture is "ask me": an unconfigured user needs a signature even for
    // dust. Anything upstream that assumes a default ceiling will produce a reverting transaction.
    const { vault, token, gate, user, agent } = await deployFixture();
    const amount = ethers.parseEther("1");
    const hash = intentHash("unconfigured-user");
    await depositToVault(vault, token, user, amount);

    const call = async () =>
      vault
        .connect(agent)
        .executeIntent(
          user.address,
          hash,
          0,
          await token.getAddress(),
          amount
        );

    await expect(call()).to.be.revertedWithCustomError(vault, "ApprovalRequired");

    await gate.connect(user).approveIntent(hash);
    await expect(call()).to.emit(vault, "StrategyExecuted");
  });

  it("lets the user execute their own intent without the agent", async () => {
    const { vault, token, gate, user } = await deployFixture();
    const amount = ethers.parseEther("10");
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await depositToVault(vault, token, user, amount);

    await expect(
      vault
        .connect(user)
        .executeIntent(
          user.address,
          intentHash("self-exec"),
          0,
          await token.getAddress(),
          amount
        )
    ).to.emit(vault, "StrategyExecuted");
  });

  it("rejects execution by an unrelated address", async () => {
    const { vault, token, gate, user, other } = await deployFixture();
    const amount = ethers.parseEther("10");
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await depositToVault(vault, token, user, amount);

    await expect(
      vault
        .connect(other)
        .executeIntent(
          user.address,
          intentHash("steal"),
          0,
          await token.getAddress(),
          amount
        )
    ).to.be.revertedWithCustomError(vault, "NotAuthorized");
  });

  it("reverts on a replayed intent hash", async () => {
    const { vault, token, gate, user, agent } = await deployFixture();
    const amount = ethers.parseEther("10");
    const hash = intentHash("replay");
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await depositToVault(vault, token, user, ethers.parseEther("20"));

    const call = async () =>
      vault
        .connect(agent)
        .executeIntent(
          user.address,
          hash,
          0,
          await token.getAddress(),
          amount
        );

    await call();
    await expect(call()).to.be.revertedWithCustomError(vault, "IntentAlreadyExecuted");
  });

  it("reverts when the strategy has been paused", async () => {
    const { vault, token, gate, registry, user, agent } = await deployFixture();
    const amount = ethers.parseEther("10");
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await depositToVault(vault, token, user, amount);
    await registry.setStrategyActive(0, false);

    await expect(
      vault
        .connect(agent)
        .executeIntent(
          user.address,
          intentHash("paused"),
          0,
          await token.getAddress(),
          amount
        )
    ).to.be.revertedWithCustomError(vault, "StrategyInactive");
  });

  it("reverts when the intent is larger than the deposited balance", async () => {
    const { vault, token, gate, user, agent } = await deployFixture();
    await gate.connect(user).setConfig(ethers.parseEther("1000"));
    await depositToVault(vault, token, user, ethers.parseEther("10"));

    await expect(
      vault
        .connect(agent)
        .executeIntent(
          user.address,
          intentHash("too-big"),
          0,
          await token.getAddress(),
          ethers.parseEther("100")
        )
    ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
  });

  it("closes a position and returns principal plus accrued yield", async () => {
    const { vault, token, gate, user, agent } = await deployFixture();
    const amount = ethers.parseEther("100");
    await gate.connect(user).setConfig(ethers.parseEther("1000"));
    await depositToVault(vault, token, user, amount);
    await vault
      .connect(agent)
      .executeIntent(
        user.address,
        intentHash("close-me"),
        0,
        await token.getAddress(),
        amount
      );

    await time.increase(365 * 24 * 60 * 60); // one year at 8.5%
    await expect(vault.connect(user).closePosition(user.address, 0)).to.emit(
      vault,
      "PositionClosed"
    );

    const free = await vault.freeBalance(user.address, await token.getAddress());
    expect(free).to.be.greaterThan(amount);
    expect(free).to.be.closeTo(ethers.parseEther("108.5"), ethers.parseEther("0.01"));

    const position = await vault.getPosition(user.address, 0);
    expect(position.active).to.equal(false);
  });

  it("only pays out a free balance the caller actually owns", async () => {
    const { vault, token, user, other } = await deployFixture();
    await depositToVault(vault, token, user, ethers.parseEther("100"));

    await expect(
      vault.connect(other).withdraw(await token.getAddress(), ethers.parseEther("100"))
    ).to.be.revertedWithCustomError(vault, "InsufficientBalance");

    await vault.connect(user).withdraw(await token.getAddress(), ethers.parseEther("100"));
    expect(await vault.freeBalance(user.address, await token.getAddress())).to.equal(0n);
  });

  it("leaves no standing allowance on the protocol after execution", async () => {
    const { vault, token, gate, dex, user, agent } = await deployFixture();
    const amount = ethers.parseEther("25");
    await gate.connect(user).setConfig(ethers.parseEther("100"));
    await depositToVault(vault, token, user, amount);
    await vault
      .connect(agent)
      .executeIntent(
        user.address,
        intentHash("allowance"),
        0,
        await token.getAddress(),
        amount
      );

    expect(await token.allowance(await vault.getAddress(), await dex.getAddress())).to.equal(0n);
  });

  it("restricts agent rotation to the owner", async () => {
    const { vault, other, deployer } = await deployFixture();
    await expect(vault.connect(other).updateAgent(other.address)).to.be.revertedWithCustomError(
      vault,
      "NotOwner"
    );
    await expect(vault.connect(deployer).updateAgent(other.address)).to.emit(
      vault,
      "AgentUpdated"
    );
  });
});

describe("IntentVault — venues that do not speak the default deposit/withdraw shapes", () => {
  const ODD_APY = 700;

  /** Registers MockOddVenue, whose exit is `redeem(uint256,address)`. */
  async function withOddVenue() {
    const base = await deployFixture();
    const odd = await (await ethers.getContractFactory("MockOddVenue")).deploy();
    const id = 2n;
    await base.registry.addStrategy(
      await odd.getAddress(),
      "OddSwap Vault",
      "DEX",
      3,
      ODD_APY
    );
    return { ...base, odd, id };
  }

  const SUPPLY = ethers.id("supply(address,uint256)").slice(0, 10);
  const REDEEM = ethers.id("redeem(uint256,address)").slice(0, 10);

  /** Declare the venue's real entry shape, so executeIntent can reach it at all. */
  async function declareEntry(f: any) {
    await f.registry.setDepositCall(f.id, SUPPLY, 0 /* TokenThenAmount */);
  }

  async function openPosition(f: any, amount: bigint, label: string) {
    await depositToVault(f.vault, f.token, f.user, amount);
    await f.gate.connect(f.user).setConfig(amount * 2n);
    await f.vault
      .connect(f.agent)
      .executeIntent(
        f.user.address,
        intentHash(label),
        f.id,
        await f.token.getAddress(),
        amount
      );
  }

  it("cannot enter until the owner declares the venue's deposit shape", async () => {
    const f = await withOddVenue();
    await depositToVault(f.vault, f.token, f.user, ONE * 50n);
    await f.gate.connect(f.user).setConfig(ONE * 100n);

    // The vault emits deposit(address,uint256); MockOddVenue only has supply(...). Reverting here
    // is the safe direction — the tokens never leave the vault.
    await expect(
      f.vault
        .connect(f.agent)
        .executeIntent(
          f.user.address,
          intentHash("odd-no-entry"),
          f.id,
          await f.token.getAddress(),
          ONE * 50n
        )
    ).to.be.revertedWithCustomError(f.vault, "StrategyCallFailed");

    expect(await f.vault.freeBalance(f.user.address, await f.token.getAddress())).to.equal(
      ONE * 50n
    );
  });

  it("enters once the owner declares the venue's deposit shape", async () => {
    const f = await withOddVenue();
    await declareEntry(f);
    await openPosition(f, ONE * 50n, "odd-entry");

    expect(
      await f.odd.balanceOfDepositor(await f.vault.getAddress(), await f.token.getAddress())
    ).to.equal(ONE * 50n);
  });

  it("refuses caller-chosen protocol calldata — executeIntent takes no such parameter", async () => {
    const f = await withOddVenue();
    // Guards the fix for the drain: a 1-token position could once carry the venue's *withdraw*
    // calldata and pull every other user's principal out of the pooled balance.
    const fragment = f.vault.interface.getFunction("executeIntent");
    expect(fragment.inputs.map((i: any) => i.type)).to.deep.equal([
      "address",
      "bytes32",
      "uint256",
      "address",
      "uint256",
    ]);
  });

  it("cannot exit while the registry still claims the default withdraw signature", async () => {
    const f = await withOddVenue();
    await declareEntry(f);
    await openPosition(f, ONE * 50n, "odd-stuck");

    // This is the pre-fix behaviour, and the reason the fix exists: the vault emits
    // withdraw(address,uint256), MockOddVenue has no such function, the call reverts, and the
    // position can never be closed. There is no rescue path, so the tokens are simply gone.
    await expect(f.vault.connect(f.user).closePosition(f.user.address, 0))
      .to.be.revertedWithCustomError(f.vault, "StrategyExitFailed")
      .withArgs(0, await f.odd.getAddress());
  });

  it("exits cleanly once the owner declares the venue's real withdraw shape", async () => {
    const f = await withOddVenue();
    await declareEntry(f);
    await openPosition(f, ONE * 50n, "odd-exit");

    await f.registry.setWithdrawCall(f.id, REDEEM, 1 /* AmountThenToken */);

    await expect(f.vault.connect(f.user).closePosition(f.user.address, 0)).to.not.be.reverted;

    expect(await f.vault.freeBalance(f.user.address, await f.token.getAddress())).to.equal(
      ONE * 50n
    );
    const position = await f.vault.getPosition(f.user.address, 0);
    expect(position.active).to.equal(false);
  });

  it("keeps the withdraw amount vault-controlled, so a caller cannot drain the pool", async () => {
    const f = await withOddVenue();
    await declareEntry(f);
    const tokenAddress = await f.token.getAddress();

    // Two users supply into the same venue; the venue sees one depositor — the vault.
    await openPosition(f, ONE * 50n, "odd-victim-a");
    await f.token.transfer(f.other.address, ONE * 100n);
    await depositToVault(f.vault, f.token, f.other, ONE * 100n);
    await f.gate.connect(f.other).setConfig(ONE * 1000n);
    await f.vault
      .connect(f.other)
      .executeIntent(
        f.other.address,
        intentHash("odd-victim-b"),
        f.id,
        tokenAddress,
        ONE * 100n
      );

    expect(await f.odd.balanceOfDepositor(await f.vault.getAddress(), tokenAddress)).to.equal(
      ONE * 150n
    );

    await f.registry.setWithdrawCall(f.id, REDEEM, 1);

    // closePosition takes no amount from the caller — it is read from the position — so the
    // first user can only ever pull their own 50 back out of the pooled 150.
    await f.vault.connect(f.user).closePosition(f.user.address, 0);
    expect(await f.vault.freeBalance(f.user.address, tokenAddress)).to.equal(ONE * 50n);
    expect(await f.odd.balanceOfDepositor(await f.vault.getAddress(), tokenAddress)).to.equal(
      ONE * 100n
    );
  });
});
