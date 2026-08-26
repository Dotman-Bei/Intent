import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Runs an execution plan exactly as the frontend would: same intent hash, same calldata, same
 * contract call — just signed by a local key instead of a browser wallet.
 *
 * Use it to validate the whole pipeline without a browser:
 *   curl -s localhost:8000/intent -H 'Content-Type: application/json' \
 *     -d '{"user_input":"earn yield on 50 BOT low risk","user_address":"0x..."}' \
 *     | python -c "import json,sys; print(json.dumps(json.load(sys.stdin)['execution_plan']))" > plan.json
 *   PLAN_FILE=plan.json npx hardhat run scripts/execute-plan.ts --network localhost
 */
type Plan = {
  intent_hash: string;
  vault_address: string;
  args: string[];
  token_address: string;
  amount_wei: string;
  requires_approval: boolean;
  approval_gate_address: string;
};

async function main() {
  const planFile = process.env.PLAN_FILE || "plan.json";
  const plan: Plan = JSON.parse(fs.readFileSync(path.resolve(planFile), "utf8"));

  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const signers = await ethers.getSigners();
  const user = signers.find(
    (s) => s.address.toLowerCase() === plan.args[0].toLowerCase()
  );
  if (!user) throw new Error(`no local signer for plan user ${plan.args[0]}`);

  const token = await ethers.getContractAt("MockERC20", plan.token_address, user);
  const vault = await ethers.getContractAt("IntentVault", plan.vault_address, user);
  const gate = await ethers.getContractAt("ApprovalGate", plan.approval_gate_address, user);

  const amount = BigInt(plan.amount_wei);
  const strategyId = BigInt(plan.args[2]);

  // 1. make sure the user holds tokens and the vault holds enough of them
  const walletBalance = await token.balanceOf(user.address);
  if (walletBalance < amount) {
    await (await token.faucet()).wait();
    console.log("faucet: +1000 tokens");
  }

  const free = await vault.freeBalance(user.address, plan.token_address);
  if (free < amount) {
    const shortfall = amount - free;
    await (await token.approve(plan.vault_address, shortfall)).wait();
    await (await vault.deposit(plan.token_address, shortfall)).wait();
    console.log(`deposited ${ethers.formatEther(shortfall)} into the vault`);
  }

  // 2. human-in-the-loop, when the plan says the amount is over the threshold
  if (plan.requires_approval) {
    await (await gate.approveIntent(plan.intent_hash)).wait();
    console.log(`approved intent ${plan.intent_hash.slice(0, 12)}…`);
  }

  // 3. execute the plan verbatim
  const tx = await vault.executeIntent(
    plan.args[0],
    plan.intent_hash,
    strategyId,
    plan.token_address,
    amount
  );
  const receipt = await tx.wait();
  console.log(`executed in block ${receipt?.blockNumber}, gas ${receipt?.gasUsed}`);

  const positions = await vault.getPositions(user.address);
  const latest = positions[positions.length - 1];
  console.log(
    `position #${positions.length - 1}: strategy ${latest.strategyId}, ` +
      `${ethers.formatEther(latest.amount)} tokens, active=${latest.active}`
  );

  const protocol = deployment.contracts.MockDEX;
  if (protocol && strategyId === 0n) {
    const dex = await ethers.getContractAt("MockDEX", protocol);
    const held = await dex.balanceOfDepositor(plan.vault_address, plan.token_address);
    console.log(`venue now holds ${ethers.formatEther(held)} for the vault`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
