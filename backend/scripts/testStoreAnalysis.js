require("dotenv").config();
const hre = require("hardhat");

async function main() {
  console.log("========================================");
  console.log("  TEST DIRECTO: storeAnalysis");
  console.log("========================================\n");

  const contractAddress = process.env.ANALYSIS_REGISTRY_CONTRACT_ADDRESS;
  const privateKey = process.env.AVALANCHE_WALLET_PRIVATE_KEY;

  console.log("1. Verificando configuración...");
  console.log("   Contract Address:", contractAddress);
  console.log("   Private Key set:", !!privateKey);
  console.log("   Private Key length:", privateKey ? privateKey.length : 0);
  console.log("   Wallet address:", privateKey ? new hre.ethers.Wallet(privateKey).address : "N/A");

  if (!contractAddress || !privateKey) {
    console.log("\n❌ ERROR: Faltan variables de entorno!");
    console.log("   ANALYSIS_REGISTRY_CONTRACT_ADDRESS:", contractAddress ? "OK" : "FALTA");
    console.log("   AVALANCHE_WALLET_PRIVATE_KEY:", privateKey ? "OK" : "FALTA");
    process.exit(1);
  }

  console.log("\n2. Conectando al contrato...");
  const provider = new hre.ethers.JsonRpcProvider(
    process.env.AVALANCHE_FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc"
  );

  const wallet = new hre.ethers.Wallet(privateKey, provider);
  console.log("   Wallet:", wallet.address);
  console.log("   Balance:", hre.ethers.formatEther(await provider.getBalance(wallet.address)), "AVAX");

  const CONTRACT_ABI = [
    "function storeAnalysis(string calldata cid, string calldata metadata, string calldata contractAddress) external returns (uint256)",
    "function getAnalysis(uint256 id) external view returns (uint256 _projectId, string memory _cid, string memory _metadata, uint256 _timestamp, string memory _contractAddress)",
    "function getAnalysisCount() external view returns (uint256)"
  ];

  const contract = new hre.ethers.Contract(contractAddress, CONTRACT_ABI, wallet);

  console.log("\n3. Verificando estado actual del contrato...");
  const currentCount = await contract.getAnalysisCount();
  console.log("   Análisis existentes:", currentCount.toString());

  console.log("\n4. Ejecutando storeAnalysis...");
  const testCID = "QmTestCID" + Date.now();
  const testMetadata = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
  const testContractAddress = "0x1234567890123456789012345678901234567890";

  console.log("   CID:", testCID);
  console.log("   Metadata:", testMetadata);
  console.log("   Contract Address:", testContractAddress);

  try {
    console.log("\n5. Enviando transacción...");
    const tx = await contract.storeAnalysis(testCID, testMetadata, testContractAddress);
    console.log("   TX Hash:", tx.hash);
    console.log("   Esperando confirmación...");
    
    const receipt = await tx.wait(1);
    console.log("   ✅ TX CONFIRMADA!");
    console.log("   Block Number:", receipt.blockNumber);
    console.log("   Gas Used:", receipt.gasUsed.toString());

    console.log("\n6. Verificando resultado...");
    const newCount = await contract.getAnalysisCount();
    console.log("   Nuevo conteo:", newCount.toString());

    if (newCount > currentCount) {
      const latestAnalysis = await contract.getAnalysis(newCount);
      console.log("\n   📋 Análisis #" + newCount.toString() + ":");
      console.log("   CID:", latestAnalysis[1]);
      console.log("   Contract:", latestAnalysis[4]);
      console.log("   Timestamp:", new Date(Number(latestAnalysis[3]) * 1000).toISOString());
    }

    console.log("\n========================================");
    console.log("✅ TEST COMPLETADO EXITOSAMENTE");
    console.log("========================================\n");
  } catch (error) {
    console.error("\n❌ ERROR:");
    console.error("   Message:", error.message);
    console.error("   Code:", error.code);
    console.error("   Reason:", error.reason);
    console.error("   Data:", error.data);
    
    if (error.reason === "No autorizado") {
      console.error("\n💡 El contrato fue desplegado con otra wallet.");
      console.error("   Wallet actual:", wallet.address);
      console.error("   La wallet del deploy es la única autorizada.");
    }
    
    console.log("\n========================================\n");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
  });
