require("dotenv").config();
const hre = require("hardhat");

const NETWORKS = {
  fuji: {
    name: "Avalanche Fuji Testnet",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    faucet: "https://faucet.avax.network"
  },
  mainnet: {
    name: "Avalanche C-Chain Mainnet",
    chainId: 43114,
    explorer: "https://snowtrace.io"
  }
};

async function main() {
  const network = hre.network.name;
  const config = NETWORKS[network];

  if (!config) {
    console.error(`❌ Red desconocida: ${network}`);
    console.log("Redes disponibles: fuji, mainnet");
    process.exit(1);
  }

  console.log("=".repeat(50));
  console.log("  DEPLOYMENT - AnalysisRegistry.sol");
  console.log("=".repeat(50));
  console.log(`\n🌐 Red: ${config.name} (${config.chainId})`);

  const [deployer] = await hre.ethers.getSigners();
  
  console.log("\n📋 Cuenta deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceAvax = Number(hre.ethers.formatEther(balance)).toFixed(4);
  console.log(`💰 Balance: ${balanceAvax} AVAX`);

  if (balanceAvax === "0.0") {
    console.error("\n❌ ERROR: No tienes AVAX en esta wallet!");
    if (network === "fuji") {
      console.log(`\n📍 Obtén AVAX de test aquí: ${config.faucet}`);
    }
    process.exit(1);
  }

  console.log("\n🚀 Desplegando AnalysisRegistry...");

  const AnalysisRegistry = await hre.ethers.getContractFactory("AnalysisRegistry");
  const contract = await AnalysisRegistry.deploy();
  
  console.log("⏳ Esperando confirmación...");
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  const txHash = contract.deploymentTransaction().hash;

  console.log("\n" + "=".repeat(50));
  console.log("✅ CONTRATO DESPLIEGADO EXITOSAMENTE!");
  console.log("=".repeat(50));
  console.log(`\n📍 Contract Address: ${contractAddress}`);
  console.log(`🔗 TX Hash: ${txHash}`);
  if (config.explorer) {
    console.log(`🔍 Explorer: ${config.explorer}/tx/${txHash}`);
    console.log(`   Contrato: ${config.explorer}/address/${contractAddress}`);
  }
  
  console.log("\n" + "-".repeat(50));
  console.log("📝 PRÓXIMOS PASOS:");
  console.log("-".repeat(50));
  console.log(`\n1. Agregar al .env:`);
  console.log(`   ANALYSIS_REGISTRY_CONTRACT_ADDRESS=${contractAddress}`);
  
  if (network === "fuji") {
    console.log(`\n2. Verificar contrato en explorer:`);
    console.log(`   npx hardhat verify ${contractAddress} --network fuji`);
  }

  console.log("\n" + "=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ ERROR EN DEPLOYMENT:");
    console.error(error.message);
    if (error.message.includes("insufficient funds")) {
      console.error("\n💡 Solución: Obtén AVAX de test del faucet: https://faucet.avax.network");
    }
    process.exit(1);
  });
