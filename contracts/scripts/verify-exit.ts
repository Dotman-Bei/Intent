import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Dust round-trip against one registered venue: deposit -> executeIntent -> closePosition ->
 * withdraw. Run it on every strategy before that strategy sees real money.
 *
 * Both legs are built on-chain from the venue's registry-declared shapes, so this verifies the
 * configuration itself, not just the venue. It exists because neither leg can be proven from
 * off-chain inspection: the venue's functions are state-changing, so they cannot be probed with a
 * staticcall, and a selector that merely *exists* still tells you nothing about whether the
 * vault's argument order is the one the venue expects. The only honest check is to push a trivial
 * amount all the way through and watch it come back — and to do that before the amounts stop
 * being trivial, because IntentVault has no rescue path once tokens have left for a protocol
 * that will not return them.
 *
 *   STRATEGY_ID=2 npx hardhat run scripts/verify-exit.ts --network botTestnet
 *
 * Env: STRATEGY_ID (required), AMOUNT (default 0.001), TOKEN (default the deployment's test token).
 */
async function main() {
  const strategyId = BigInt(process.env.STRATEGY_ID ?? "");
  const amount = ethers.parseEther(process.env.AMOUNT || "0.001");

  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8")
  );
  const [signer] = await ethers.getSigners();
  const tokenAddress = process.env.TOKEN || deployment.contracts.TestToken;

  const vault = await ethers.getContractAt("IntentVault", deployment.contracts.IntentVault, signer);
  const registry = await ethers.getContractAt(
    "StrategyRegistry",
    deployment.contracts.StrategyRegistry,
    signer
  );
  const gate = await ethers.getContractAt("ApprovalGate", deployment.contracts.ApprovalGate, signer);
  const token = await ethers.getContractAt("MockERC20", tokenAddress, signer);

  const strategy = await registry.getStrategy(strategyId);
  const layouts = ["f(token, amount)", "f(amount, token)", "f(amount)"];
  const shown = (selector: string, fallback: string) =>
    selector === "0x00000000" ? `${ethers.id(fallback).slice(0, 10)} (default)` : selector;

  console.log(`network:    ${network.name}`);
  console.log(`strategy:   #${strategyId} ${strategy.name} @ ${strategy.protocol}`);
  console.log(
    `entry call: selector ${shown(strategy.depositSelector, "deposit(address,uint256)")}, ` +
      `args ${layouts[Number(strategy.depositArgs)]}`
  );
  console.log(
    `exit call:  selector ${shown(strategy.withdrawSelector, "withdraw(address,uint256)")}, ` +
      `args ${layouts[Number(strategy.withdrawArgs)]}`
  );
  console.log(`amount:     ${ethers.formatEther(amount)}
`);

  if (!strategy.active) throw new Error(`strategy #${strategyId} is not active`);

  const walletStart = await token.balanceOf(signer.address);
  if (walletStart < amount) {
    await (await token.faucet()).wait();
    console.log("faucet: topped up");
  }

  const free = await vault.freeBalance(signer.address, tokenAddress);
  if (free < amount) {
    const shortfall = amount - free;
    await (await token.approve(await vault.getAddress(), shortfall)).wait();
    await (await vault.deposit(tokenAddress, shortfall)).wait();
    console.log(`deposited ${ethers.formatEther(shortfall)}`);
  }

  const intentHash = ethers.keccak256(
    ethers.toUtf8Bytes(`verify-exit:${network.name}:${strategyId}:${Date.now()}`)
  );
  if (await gate.requiresApproval(signer.address, amount)) {
    await (await gate.approveIntent(intentHash)).wait();
    console.log("approved the rehearsal intent");
  }

  try {
    await (
      await vault.executeIntent(signer.address, intentHash, strategyId, tokenAddress, amount)
    ).wait();
  } catch (error: any) {
    console.error(`
✗ ENTRY FAILED — strategy #${strategyId} is not reachable.`);
    console.error(`  ${error.shortMessage || error.message}`);
    console.error(`  Fix: registry.setDepositCall(${strategyId}, <selector>, <argLayout>)`);
    console.error("  Nothing left the vault, so no funds are at risk.");
    process.exitCode = 1;
    return;
  }
  const positionId = (await vault.positionCount(signer.address)) - 1n;
  console.log(`entered: position #${positionId}`);

  // The half that used to be impossible for any venue not shaped like the mocks.
  const freeBeforeExit = await vault.freeBalance(signer.address, tokenAddress);
  try {
    await (await vault.closePosition(signer.address, positionId)).wait();
  } catch (error: any) {
    console.error(`\n✗ EXIT FAILED — do not send real funds to strategy #${strategyId}.`);
    console.error(`  ${error.shortMessage || error.message}`);
    console.error(`  Fix: registry.setWithdrawCall(${strategyId}, <selector>, <argLayout>)`);
    console.error(`  The ${ethers.formatEther(amount)} in this rehearsal is now unrecoverable.`);
    process.exitCode = 1;
    return;
  }

  const returned = (await vault.freeBalance(signer.address, tokenAddress)) - freeBeforeExit;
  await (await vault.withdraw(tokenAddress, returned)).wait();

  console.log(`exited:  ${ethers.formatEther(returned)} returned to the free balance`);
  console.log(`withdrew to wallet; position active = ${(await vault.getPosition(signer.address, positionId)).active}`);

  if (returned < amount) {
    console.warn(`\n⚠ returned less than deposited (${ethers.formatEther(amount - returned)} short).`);
    console.warn("  Round-trips, but the venue does not return full principal — check fees or seeding.");
    return;
  }
  console.log(`\n✓ strategy #${strategyId} round-trips on both legs. Safe to route real funds.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
