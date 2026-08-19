import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * BOT Chain network parameters, from the official developer docs
 * (https://dev-docs.botchain.ai/docs/Developers/quick-guide/) and verified live on 2026-08-19.
 *
 *   Testnet  chain 968  https://rpc.bohr.life     explorer https://scan.bohr.life
 *   Mainnet  chain 677  https://rpc.botchain.ai   explorer https://scan.botchain.ai
 *
 * Note the testnet lives on a different domain (bohr.life), which is why every *.botchain.ai
 * testnet hostname fails to resolve. Both endpoints implement eth_feeHistory, so EIP-1559 fee
 * estimation works and no legacy-gas workaround is needed.
 */
const TESTNET_CHAIN_ID = Number(process.env.BOT_TESTNET_CHAIN_ID || 968);
const MAINNET_CHAIN_ID = Number(process.env.BOT_MAINNET_CHAIN_ID || 677);
const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545" },
    botTestnet: {
      url: process.env.BOT_TESTNET_RPC || "https://rpc.bohr.life",
      chainId: TESTNET_CHAIN_ID,
      accounts,
    },
    botMainnet: {
      url: process.env.BOT_MAINNET_RPC || "https://rpc.botchain.ai",
      chainId: MAINNET_CHAIN_ID,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      botTestnet: process.env.BOTSCAN_API_KEY || "",
      botMainnet: process.env.BOTSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "botTestnet",
        chainId: TESTNET_CHAIN_ID,
        urls: {
          apiURL: "https://scan.bohr.life/api",
          browserURL: "https://scan.bohr.life",
        },
      },
      {
        network: "botMainnet",
        chainId: MAINNET_CHAIN_ID,
        urls: {
          apiURL: "https://scan.botchain.ai/api",
          browserURL: "https://scan.botchain.ai",
        },
      },
    ],
  },
};

export default config;
