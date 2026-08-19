import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Prints the live state of a deployment with explorer links — contract addresses, registered
 * venues, recent executions and open positions.
 *
 *   npx hardhat run scripts/show-deployment.ts --network botTestnet
 *
 * Written for submissions and demos: everything a reviewer needs to check the deployment is real,
 * read straight off the chain rather than from the deployment file.
 */
async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`no deployment record at ${file}`);
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const explorer = (process.env.EXPLORER_URL || "https://scan.bohr.life").replace(/\/$/, "");
  const provider = ethers.provider;

  console.log(`\n${deployment.network} · chain ${deployment.chainId} · deployed ${deployment.deployedAt}`);
  console.log(`agent executor: ${deployment.agent}\n`);

  console.log("contracts");
  for (const [name, address] of Object.entries(deployment.contracts)) {
    const code = await provider.getCode(address as string);
    const status = code && code !== "0x" ? `${(code.length / 2 - 1).toLocaleString()} bytes` : "NO CODE";
    console.log(`  ${name.padEnd(17)} ${address}  ${status}`);
    console.log(`  ${"".padEnd(17)} ${explorer}/address/${address}`);
  }

  const registry = await ethers.getContractAt("StrategyRegistry", deployment.contracts.StrategyRegistry);
  const [ids, list] = await registry.getActiveStrategies();
  console.log(`\nregistered venues (${ids.length})`);
  for (const [i, id] of ids.entries()) {
    const s = list[i];
    console.log(
      `  id ${id}  ${s.name.padEnd(24)} ${s.protocolType.padEnd(8)} risk ${s.riskScore}/10  ` +
        `${Number(s.baseApyBps) / 100}% APY  ${s.protocol}`
    );
  }

  const vault = await ethers.getContractAt("IntentVault", deployment.contracts.IntentVault);
  const head = await provider.getBlockNumber();
  const from = Math.max(0, head - 2000);
  const executions = await vault.queryFilter(vault.filters.StrategyExecuted(), from, head);

  console.log(`\nexecutions in the last ${head - from} blocks (head ${head}): ${executions.length}`);
  const users = new Set<string>();
  for (const e of executions) {
    const [user, intentHash, strategyId, , amount] = e.args;
    users.add(user);
    console.log(
      `  block ${e.blockNumber}  ${ethers.formatEther(amount)} tokens into strategy ${strategyId}`
    );
    console.log(`    intent ${intentHash}`);
    console.log(`    ${explorer}/tx/${e.transactionHash}`);
  }

  for (const user of users) {
    const positions = await vault.getPositions(user);
    console.log(`\npositions for ${user}: ${positions.length}`);
    for (const [i, p] of positions.entries()) {
      console.log(
        `  #${i} strategy ${p.strategyId}  ${ethers.formatEther(p.amount)} tokens  ` +
          `active=${p.active}  opened ${new Date(Number(p.entryTimestamp) * 1000).toISOString()}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
