const { ethers } = require('ethers');

const CONTRACT_ADDRESS = process.env.ANALYSIS_REGISTRY_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.AVALANCHE_WALLET_PRIVATE_KEY;
const FUJI_RPC = process.env.AVALANCHE_FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';
const MAINNET_RPC = process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc';

const CONTRACT_ABI = [
  "function storeAnalysis(string calldata cid, string calldata metadata, string calldata contractAddress) external returns (uint256)",
  "function getAnalysis(uint256 id) external view returns (uint256 projectId, string memory cid, string memory metadata, uint256 timestamp, string memory contractAddress)",
  "function getLatestAnalysis() external view returns (uint256 projectId, string memory cid, string memory metadata, uint256 timestamp, string memory contractAddress)",
  "function getAnalysisCount() external view returns (uint256)",
  "function projectCount() external view returns (uint256)",
  "function cidExistsCheck(string calldata cid) external view returns (bool)",
  "function authorizeContract(address _contract) external",
  "event AnalysisStored(uint256 indexed projectId, string cid, address indexed storedBy, uint256 timestamp)"
];

let provider;
let wallet;
let contract;

const getProvider = (network = 'fuji') => {
  const rpcUrl = network === 'mainnet' ? MAINNET_RPC : FUJI_RPC;
  return new ethers.JsonRpcProvider(rpcUrl);
};

const getContract = (network = 'fuji') => {
  const prov = getProvider(network);
  
  if (PRIVATE_KEY) {
    const w = new ethers.Wallet(PRIVATE_KEY, prov);
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, w);
  }
  
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, prov);
};

const storeOnBlockchain = async (cid, metadata, contractAddress, network = 'fuji') => {
  if (!CONTRACT_ADDRESS) {
    throw new Error('ANALYSIS_REGISTRY_CONTRACT_ADDRESS no está configurado');
  }
  
  if (!PRIVATE_KEY) {
    throw new Error('AVALANCHE_WALLET_PRIVATE_KEY no está configurado');
  }
  
  const prov = getProvider(network);
  const w = new ethers.Wallet(PRIVATE_KEY, prov);
  const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, w);
  
  try {
    console.log(`[Blockchain] Almacenando en ${network}...`);
    
    const tx = await contractInstance.storeAnalysis(cid, metadata, contractAddress);
    console.log(`[Blockchain] TX enviada, esperando confirmación... Hash: ${tx.hash}`);
    
    const receipt = await tx.wait(1);
    
    const event = receipt.logs.find(log => {
      try {
        const parsed = contractInstance.interface.parseLog(log);
        return parsed?.name === 'AnalysisStored';
      } catch {
        return false;
      }
    });
    
    let projectId = null;
    if (event) {
      const parsed = contractInstance.interface.parseLog(event);
      projectId = parsed.args.projectId.toString();
    }
    
    console.log(`[Blockchain] Almacenado exitosamente! ProjectId: ${projectId}`);
    
    return {
      success: true,
      projectId: projectId,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      network: network
    };
  } catch (error) {
    console.error('[Blockchain] Error almacenando:', error.message);
    throw error;
  }
};

const getAnalysisFromBlockchain = async (projectId, network = 'fuji') => {
  if (!CONTRACT_ADDRESS) {
    throw new Error('ANALYSIS_REGISTRY_CONTRACT_ADDRESS no está configurado');
  }
  
  const contractInstance = getContract(network);
  
  try {
    const analysis = await contractInstance.getAnalysis(projectId);
    
    return {
      projectId: analysis[0].toString(),
      cid: analysis[1],
      metadata: JSON.parse(analysis[2]),
      timestamp: new Date(Number(analysis[3]) * 1000).toISOString(),
      contractAddress: analysis[4]
    };
  } catch (error) {
    console.error('[Blockchain] Error obteniendo análisis:', error.message);
    throw error;
  }
};

const getLatestAnalysis = async (network = 'fuji') => {
  if (!CONTRACT_ADDRESS) {
    throw new Error('ANALYSIS_REGISTRY_CONTRACT_ADDRESS no está configurado');
  }
  
  const contractInstance = getContract(network);
  
  try {
    const analysis = await contractInstance.getLatestAnalysis();
    
    return {
      projectId: analysis[0].toString(),
      cid: analysis[1],
      metadata: JSON.parse(analysis[2]),
      timestamp: new Date(Number(analysis[3]) * 1000).toISOString(),
      contractAddress: analysis[4]
    };
  } catch (error) {
    console.error('[Blockchain] Error obteniendo último análisis:', error.message);
    throw error;
  }
};

const getAnalysisCount = async (network = 'fuji') => {
  if (!CONTRACT_ADDRESS) {
    throw new Error('ANALYSIS_REGISTRY_CONTRACT_ADDRESS no está configurado');
  }
  
  const contractInstance = getContract(network);
  
  try {
    const count = await contractInstance.getAnalysisCount();
    return count.toString();
  } catch (error) {
    console.error('[Blockchain] Error obteniendo conteo:', error.message);
    throw error;
  }
};

const checkCidExists = async (cid, network = 'fuji') => {
  if (!CONTRACT_ADDRESS) {
    throw new Error('ANALYSIS_REGISTRY_CONTRACT_ADDRESS no está configurado');
  }
  
  const contractInstance = getContract(network);
  
  try {
    return await contractInstance.cidExistsCheck(cid);
  } catch (error) {
    console.error('[Blockchain] Error verificando CID:', error.message);
    throw error;
  }
};

const isBlockchainConfigured = () => {
  return !!(CONTRACT_ADDRESS && PRIVATE_KEY);
};

module.exports = {
  storeOnBlockchain,
  getAnalysisFromBlockchain,
  getLatestAnalysis,
  getAnalysisCount,
  checkCidExists,
  isBlockchainConfigured,
  getContract,
  CONTRACT_ABI
};
