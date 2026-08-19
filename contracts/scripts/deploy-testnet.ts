import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Testnet deployment: registry + gate + vault, two mock venues, one mock token with a faucet.
 * Writes deployments/<network>.json, which the ABI exporter and the app env files read from.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const agent = process.env.AGENT_ADDRESS || deployer.address;

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

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const wbot = await MockERC20.deploy("Wrapped BOT", "wBOT", 18, ethers.parseEther("1000000"));
  await wbot.waitForDeployment();
  console.log("wBOT (test):     ", await wbot.getAddress());

  const MockDEX = await ethers.getContractFactory("MockDEX");
  const dex = await MockDEX.deploy("BOTSwap Stable Pool", 850);
  await dex.waitForDeployment();
  console.log("MockDEX:         ", await dex.getAddress());

  const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
  const lending = await MockLendingPool.deploy(1240, 6800);
  await lending.waitForDeployment();
  console.log("MockLendingPool: ", await lending.getAddress());

  const IntentVault = await ethers.getContractFactory("IntentVault");
  const vault = await IntentVault.deploy(
    await registry.getAddress(),
    await approvalGate.getAddress(),
    agent
  );
  await vault.waitForDeployment();
  console.log("IntentVault:     ", await vault.getAddress());

  // Whitelist the venues. Order matters: the id is what executeIntent takes.
  await (
    await registry.addStrategy(await dex.getAddress(), "BOTSwap Stable Pool", "DEX", 3, 850)
  ).wait();
  await (
    await registry.addStrategy(
      await lending.getAddress(),
      "BOTLend Supply Market",
      "Lending",
      5,
      1240
    )
  ).wait();
  console.log("strategies registered: 2");

  // Seed the venues so the yield leg of a withdrawal is actually payable on testnet.
  await (await wbot.transfer(await dex.getAddress(), ethers.parseEther("10000"))).wait();
  await (await wbot.transfer(await lending.getAddress(), ethers.parseEther("10000"))).wait();

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
      MockDEX: await dex.getAddress(),
      MockLendingPool: await lending.getAddress(),
      TestToken: await wbot.getAddress(),
    },
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(deployment, null, 2));
  console.log(`\nwrote deployments/${network.name}.json`);

  console.log("\n--- frontend/.env.local ---");
  console.log(`NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`);
  console.log(`NEXT_PUBLIC_INTENT_VAULT=${deployment.contracts.IntentVault}`);
  console.log(`NEXT_PUBLIC_STRATEGY_REGISTRY=${deployment.contracts.StrategyRegistry}`);
  console.log(`NEXT_PUBLIC_APPROVAL_GATE=${deployment.contracts.ApprovalGate}`);
  console.log(`NEXT_PUBLIC_TEST_TOKEN=${deployment.contracts.TestToken}`);
  console.log("\n--- backend/.env ---");
  console.log(`INTENT_VAULT_ADDRESS=${deployment.contracts.IntentVault}`);
  console.log(`STRATEGY_REGISTRY_ADDRESS=${deployment.contracts.StrategyRegistry}`);
  console.log(`APPROVAL_GATE_ADDRESS=${deployment.contracts.ApprovalGate}`);
  console.log(`TEST_TOKEN_ADDRESS=${deployment.contracts.TestToken}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
