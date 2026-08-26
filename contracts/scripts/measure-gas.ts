import { ethers } from "hardhat";

/**
 * Measures the gas of the full user journey and prices it at a given gas price.
 *
 * The projection the agent shows subtracts a gas constant, so that constant needs a provenance:
 * run this, and put the executeIntent figure in backend GAS_ESTIMATE_BOT.
 *
 *   GAS_PRICE_GWEI=20 npx hardhat run scripts/measure-gas.ts
 *
 * Gas *units* are chain-independent for the same bytecode; the price is not. Re-run with the
 * target network's eth_gasPrice before quoting a cost anywhere user-facing.
 */
async function main() {
  const gwei = Number(process.env.GAS_PRICE_GWEI || 20);
  const price = ethers.parseUnits(gwei.toString(), "gwei");

  const [deployer, agent, user] = await ethers.getSigners();

  const registry = await (await ethers.getContractFactory("StrategyRegistry")).deploy();
  const gate = await (await ethers.getContractFactory("ApprovalGate")).deploy();
  const token = await (
    await ethers.getContractFactory("MockERC20")
  ).deploy("Wrapped BOT", "wBOT", 18, ethers.parseEther("1000000"));
  const dex = await (await ethers.getContractFactory("MockDEX")).deploy("Pool", 850);
  const vault = await (
    await ethers.getContractFactory("IntentVault")
  ).deploy(await registry.getAddress(), await gate.getAddress(), agent.address);

  await registry.addStrategy(await dex.getAddress(), "BOTSwap Stable Pool", "DEX", 3, 850);
  await token.transfer(await dex.getAddress(), ethers.parseEther("10000"));
  await token.transfer(user.address, ethers.parseEther("1000"));

  const amount = ethers.parseEther("50");
  const tokenAddress = await token.getAddress();
  const vaultAddress = await vault.getAddress();
  const hash = ethers.keccak256(ethers.toUtf8Bytes("gas-measurement"));

  const steps: { label: string; gas: bigint }[] = [];
  const record = async (label: string, run: Promise<{ wait: () => Promise<any> }>) => {
    const receipt = await (await run).wait();
    steps.push({ label, gas: receipt.gasUsed });
  };

  await record("ERC20 approve", token.connect(user).approve(vaultAddress, amount) as any);
  await record("vault deposit", vault.connect(user).deposit(tokenAddress, amount) as any);
  await record("approveIntent (HITL)", gate.connect(user).approveIntent(hash) as any);
  await record(
    "executeIntent",
    vault
      .connect(agent)
      .executeIntent(user.address, hash, 0, tokenAddress, amount) as any
  );
  await record("closePosition", vault.connect(user).closePosition(user.address, 0) as any);
  await record("withdraw", vault.connect(user).withdraw(tokenAddress, amount) as any);

  console.log(`\ngas measured on the in-process hardhat network, priced at ${gwei} gwei\n`);
  console.log("step                     gas        cost (BOT)");
  console.log("-------------------------------------------------");
  let total = 0n;
  for (const step of steps) {
    total += step.gas;
    console.log(
      `${step.label.padEnd(24)} ${step.gas.toString().padStart(8)}   ${ethers.formatEther(
        step.gas * price
      )}`
    );
  }
  console.log("-------------------------------------------------");
  console.log(
    `${"full journey".padEnd(24)} ${total.toString().padStart(8)}   ${ethers.formatEther(
      total * price
    )}`
  );

  const execute = steps.find((s) => s.label === "executeIntent")!;
  console.log(
    `\nGAS_ESTIMATE_BOT (executeIntent only): ${ethers.formatEther(execute.gas * price)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
