import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Drives the cheapest real IntentVault round trip from each wallet in .interaction-wallets.json:
 * wrap a dust amount of BOT, approve it, vault.deposit, vault.withdraw. Two vault calls per wallet.
 *
 *   npx ts-node scripts/proof-of-interaction.ts
 *
 * Steps already done are skipped (allowance present, balance already withdrawn), so a rerun after
 * a failure picks up where it stopped. Hashes are appended to .interaction-log.json.
 */
const RPC = process.env.BOT_MAINNET_RPC || "https://rpc.botchain.ai";
const VAULT = "0xdcc0A561Ae8a5ecA99E2e0C13effC561547A24d1";
const WBOT = "0xD5452816194a3784dBa983426cCe7c122F4abd30";
const AMOUNT = ethers.parseEther("0.0001");
const EXPLORER = "https://scan.botchain.ai/tx/";

const wbotAbi = [
  "function deposit() payable",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const vaultAbi = [
  "function deposit(address,uint256)",
  "function withdraw(address,uint256)",
  "function freeBalance(address,address) view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallets = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", ".interaction-wallets.json"), "utf8"),
  ) as { address: string; privateKey: string }[];
  const logPath = path.join(__dirname, "..", ".interaction-log.json");
  const log: Record<string, string>[] = fs.existsSync(logPath)
    ? JSON.parse(fs.readFileSync(logPath, "utf8"))
    : [];

  // Legacy pricing at the node's current gas price: the floor the chain accepts, no priority tip.
  const gasPrice = (await provider.getFeeData()).gasPrice!;
  const overrides = { gasPrice, type: 0 };

  for (const { address, privateKey } of wallets) {
    const signer = new ethers.Wallet(privateKey, provider);
    const wbot = new ethers.Contract(WBOT, wbotAbi, signer);
    const vault = new ethers.Contract(VAULT, vaultAbi, signer);
    const send = async (label: string, tx: Promise<ethers.TransactionResponse>) => {
      const r = await (await tx).wait();
      console.log(`  ${label.padEnd(14)} ${EXPLORER}${r!.hash}`);
      log.push({ wallet: address, step: label, hash: r!.hash, gasUsed: r!.gasUsed.toString() });
      fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    };

    console.log(`${address}  ${ethers.formatEther(await provider.getBalance(address))} BOT`);
    if (log.some((e) => e.wallet === address && e.step === "vault.withdraw")) {
      console.log("  done already");
      continue;
    }
    if ((await wbot.balanceOf(address)) < AMOUNT && (await vault.freeBalance(address, WBOT)) < AMOUNT)
      await send("wrap", wbot.deposit({ ...overrides, value: AMOUNT }));
    if ((await vault.freeBalance(address, WBOT)) < AMOUNT) {
      if ((await wbot.allowance(address, VAULT)) < AMOUNT)
        await send("approve", wbot.approve(VAULT, AMOUNT, overrides));
      await send("vault.deposit", vault.deposit(WBOT, AMOUNT, overrides));
    }
    await send("vault.withdraw", vault.withdraw(WBOT, AMOUNT, overrides));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
