require("dotenv").config();
const hre = require("hardhat");

const NETWORKS = {
  fuji: {
    name: "Avalanche Fuji Testnet",
    faucet: "https://faucet.avax.network"
  },
  mainnet: {
    name: "Avalanche C-Chain Mainnet",
    faucet: null
  }
};

async function main() {
  const network = hre.network.name;
  const config = NETWORKS[network];

  console.log("=".repeat(50));
  console.log("  CHECK BALANCE");
  console.log("=".repeat(50));
  console.log(`\n🌐 Red: ${config.name}`);

  const accounts = await hre.ethers.getSigners();
  const deployer = accounts[0];

  console.log("\n📋 Wallet:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceAvax = Number(hre.ethers.formatEther(balance)).toFixed(4);
  
  console.log(`\n💰 Balance: ${balanceAvax} AVAX`);
  
  if (parseFloat(balanceAvax) < 0.01) {
    console.log("\n⚠️  Balance bajo. Necesitas al menos 0.01 AVAX para deploy.");
    if (config.faucet) {
      console.log(`\n📍 Faucet: ${config.faucet}`);
    }
  } else {
    console.log("\n✅ Balance suficiente para deploy!");
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`\n💡 Para desplegar:`);
  console.log(`   npm run deploy:${network}`);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
