require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    fuji: {
      url: process.env.AVALANCHE_FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc",
      accounts: [process.env.AVALANCHE_WALLET_PRIVATE_KEY],
      chainId: 43113,
    },
    mainnet: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      accounts: [process.env.AVALANCHE_WALLET_PRIVATE_KEY],
      chainId: 43114,
    }
  }
};
