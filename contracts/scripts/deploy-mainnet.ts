import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Mainnet deployment. No mocks: every strategy must be a real BOT Chain protocol address supplied
 * through MAINNET_STRATEGIES, and the agent must be a dedicated funded EOA (not the deployer).
 *
 * MAINNET_STRATEGIES format (JSON array, in .env):
 *   [{"protocol":"0x..","name":"BOTSwap","protocolType":"DEX","riskScore":3,"baseApyBps":850}]
 */
type StrategySeed = {
  protocol: string;
  name: string;
  protocolType: string;
  riskScore: number;
  baseApyBps: number;
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const agent = process.env.AGENT_ADDRESS;

  if (!agent || !ethers.isAddress(agent)) {
    throw new Error("AGENT_ADDRESS must be set to the funded agent EOA before mainnet deploy");
  }
  if (agent.toLowerCase() === deployer.address.toLowerCase()) {
    console.warn("WARNING: agent EOA is the deployer. Use a separate hot wallet in production.");
  }

  const seeds: StrategySeed[] = JSON.parse(process.env.MAINNET_STRATEGIES || "[]");
  if (seeds.length === 0) {
    throw new Error("MAINNET_STRATEGIES is empty — refusing to ship a vault with no venues");
  }

  console.log(`network:  ${network.name}`);
  console.log(`deployer: ${deployer.address}`);
  console.log(`agent:    ${agent}`);

  const Registry = await ethers.getContractFactory("StrategyRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  console.log("StrategyRegistry:", await registry.getAddress());

  const ApprovalGate = await ethers.getContractFactory("ApprovalGate");
  const approvalGate = await ApprovalGate.deploy();
  await approvalGate.waitForDeployment();
  console.log("ApprovalGate:    ", await approvalGate.getAddress());

  const IntentVault = await ethers.getContractFactory("IntentVault");
  const vault = await IntentVault.deploy(
    await registry.getAddress(),
    await approvalGate.getAddress(),
    agent
  );
  await vault.waitForDeployment();
  console.log("IntentVault:     ", await vault.getAddress());

  for (const s of seeds) {
    await (
      await registry.addStrategy(s.protocol, s.name, s.protocolType, s.riskScore, s.baseApyBps)
    ).wait();
    console.log(`registered: ${s.name} (${s.protocol})`);
  }

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    agent,
    contracts: {
      StrategyRegistry: await registry.getAddress(),
      ApprovalGate: await approvalGate.getAddress(),
      IntentVault: await vault.getAddress(),
    },
    strategies: seeds,
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(deployment, null, 2));
  console.log(`\nwrote deployments/${network.name}.json`);

  if (process.env.BOTSCAN_API_KEY) {
    console.log("\nverifying...");
    const verify = async (address: string, constructorArguments: unknown[]) => {
      try {
        await run("verify:verify", { address, constructorArguments });
      } catch (e) {
        console.warn(`verify failed for ${address}:`, (e as Error).message);
      }
    };
    await verify(await registry.getAddress(), []);
    await verify(await approvalGate.getAddress(), []);
    await verify(await vault.getAddress(), [
      await registry.getAddress(),
      await approvalGate.getAddress(),
      agent,
    ]);
  } else {
    console.log("\nBOTSCAN_API_KEY unset — skipping verification");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
