require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

if (!SEPOLIA_RPC_URL || !PRIVATE_KEY) {
  console.warn("Warning: Missing required environment variables");
  console.warn("SEPOLIA_RPC_URL:", SEPOLIA_RPC_URL ? "✓ Set" : "✗ Not set");
  console.warn("PRIVATE_KEY:", PRIVATE_KEY ? "✓ Set" : "✗ Not set");
}

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY || "",
    },
  },
};
