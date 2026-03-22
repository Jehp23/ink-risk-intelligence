const axios = require('axios');
const { ethers } = require('ethers');
const { fetchCovalentData } = require('./covalentService');

const SNOWTRACE_BASE_URL = process.env.SNOWTRACE_BASE_URL || 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan';
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY;
const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL || process.env.AVALANCHE_RPC || 'https://api.avax.network/ext/bc/C/rpc';

const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const isValidEvmAddress = (address) => {
  return EVM_ADDRESS_REGEX.test(address);
};

const serializeBigInt = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }));
};

const fetchSourceCodeAndAbi = async (contractAddress) => {
  const url = `${SNOWTRACE_BASE_URL}/api`;
  const params = {
    module: 'contract',
    action: 'getsourcecode',
    address: contractAddress
  };

  if (SNOWTRACE_API_KEY) {
    params.apikey = SNOWTRACE_API_KEY;
  }

  const response = await axios.get(url, { params, timeout: 15000 });
  const data = response.data;

  if (data.status !== '1' || !data.result || data.result.length === 0) {
    throw new Error(`Snowtrace API error: ${data.message || 'No se encontró el contrato'}`);
  }

  const contractData = Array.isArray(data.result) ? data.result[0] : data.result;

  return {
    sourceCode: contractData.SourceCode || '',
    abi: contractData.ABI || '[]',
    contractName: contractData.ContractName || 'Unknown',
    compilerVersion: contractData.CompilerVersion || null,
    optimizationUsed: contractData.OptimizationUsed === '1'
  };
};

const fetchContractState = async (contractAddress, abiJson) => {
  const provider = new ethers.JsonRpcProvider(AVALANCHE_RPC_URL);

  try {
    const contract = new ethers.Contract(contractAddress, abiJson, provider);
    const results = {};

    if (abiJson.includes('"name":"owner"') || abiJson.includes('"stateMutability":"nonpayable"')) {
      try {
        const owner = await contract.owner();
        results.owner = owner;
      } catch (ownerError) {
        results.owner = null;
      }
    }

    if (abiJson.includes('"name":"name"')) {
      try {
        const name = await contract.name();
        results.name = name;
      } catch (nameError) {
        results.name = null;
      }
    }

    if (abiJson.includes('"name":"symbol"')) {
      try {
        const symbol = await contract.symbol();
        results.symbol = symbol;
      } catch (symbolError) {
        results.symbol = null;
      }
    }

    if (abiJson.includes('"name":"totalSupply"')) {
      try {
        const totalSupply = await contract.totalSupply();
        results.totalSupply = totalSupply.toString();
      } catch (supplyError) {
        results.totalSupply = null;
      }
    }

    return results;

  } catch (error) {
    throw new Error(`Error al conectar con RPC de Avalanche: ${error.message}`);
  }
};

const analyzeContract = async (contractAddress) => {
  const result = {
    address: contractAddress.toLowerCase(),
    chain: 'avalanche',
    covalent: null,
    snowtrace: null,
    contractState: null,
    errors: []
  };

  if (!isValidEvmAddress(contractAddress)) {
    throw new Error(`Dirección EVM inválida: ${contractAddress}`);
  }

  const validatedAddress = contractAddress.toLowerCase();

  // Etapa 1: Covalent API (holders y metadata)
  try {
    const covalentData = await fetchCovalentData(validatedAddress);
    result.covalent = covalentData;
  } catch (covalentError) {
    result.errors.push({
      stage: 'covalent',
      message: covalentError.message
    });
  }

  // Etapa 2: Snowtrace API
  try {
    const snowtraceData = await fetchSourceCodeAndAbi(validatedAddress);
    result.snowtrace = snowtraceData;
  } catch (snowtraceError) {
    result.errors.push({
      stage: 'snowtrace',
      message: snowtraceError.message
    });
  }

  // Etapa 3: RPC + ethers.js
  if (result.snowtrace && result.snowtrace.abi && result.snowtrace.abi !== '[]' && result.snowtrace.abi !== '') {
    try {
      const abiJson = result.snowtrace.abi;
      JSON.parse(abiJson); // validate it's parseable before passing to ethers
      const stateData = await fetchContractState(validatedAddress, abiJson);
      result.contractState = serializeBigInt(stateData);
    } catch (stateError) {
      result.errors.push({
        stage: 'contractState',
        message: stateError.message
      });
    }
  } else {
    result.errors.push({
      stage: 'contractState',
      message: 'No se pudo obtener el ABI para instanciar el contrato'
    });
  }

  return result;
};

module.exports = {
  analyzeContract,
  isValidEvmAddress,
  serializeBigInt,
  fetchSourceCodeAndAbi,
  fetchContractState
};
