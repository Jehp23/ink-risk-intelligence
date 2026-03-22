const axios = require('axios');

const PINATA_API_URL = 'https://api.pinata.cloud/pinning';
const PINATA_GATEWAY = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs';
const PINATA_JWT = process.env.PINATA_JWT;

const pinJsonToIpfs = async (jsonData, name = 'analysis-report.json') => {
  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT no está configurado en process.env');
  }

  const data = JSON.stringify(jsonData);

  try {
    const response = await axios.post(
      `${PINATA_API_URL}/pinJSONToIPFS`,
      {
        pinataContent: jsonData,
        pinataMetadata: {
          name: name,
          keyvalues: {
            type: 'analysis-report',
            timestamp: new Date().toISOString()
          }
        },
        pinataOptions: {
          cidVersion: 1
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_JWT}`
        },
        timeout: 30000
      }
    );

    return {
      cid: response.data.IpfsHash,
      size: response.data.PinSize,
      timestamp: response.data.Timestamp
    };
  } catch (error) {
    console.error('[IPFS] Error subiendo a Pinata:', error.message);
    if (error.response) {
      console.error('[IPFS] Pinata response:', error.response.data);
    }
    throw new Error(`Error subiendo a IPFS: ${error.message}`);
  }
};

const buildFullReport = (contractAddress, scoringResult, avalancheData, aiExplanation) => {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    contract: {
      address: contractAddress,
      chain: 'avalanche'
    },
    analysis: {
      score: scoringResult.score,
      level: scoringResult.level,
      warnings: scoringResult.warnings,
      activeSignals: scoringResult.activeSignals
    },
    signals: scoringResult.signals,
    dataSources: {
      snowtrace: avalancheData.snowtrace ? {
        verified: !!avalancheData.snowtrace.sourceCode,
        contractName: avalancheData.snowtrace.contractName,
        compilerVersion: avalancheData.snowtrace.compilerVersion,
        hasSourceCode: avalancheData.snowtrace.sourceCode.length > 0
      } : null,
      covalent: avalancheData.covalent ? {
        totalHolders: avalancheData.covalent.holders?.total_holders || 0,
        top1Concentration: avalancheData.covalent.holders?.holder_concentration_top1 || 0,
        top10Concentration: avalancheData.covalent.holders?.holder_concentration_top10 || 0
      } : null,
      contractState: avalancheData.contractState || null,
      errors: avalancheData.errors
    },
    aiExplanation: aiExplanation || null,
    riskAssessment: generateRiskSummary(scoringResult)
  };
};

const buildMetadata = (projectId, cid, contractAddress, scoringResult) => {
  return {
    version: '1.0',
    type: 'analysis-metadata',
    projectId: projectId,
    contractAddress: contractAddress,
    chain: 'avalanche',
    ipfsCid: cid,
    storedAt: new Date().toISOString(),
    summary: {
      score: scoringResult.score,
      level: scoringResult.level,
      riskCount: scoringResult.warnings.length,
      topRisks: scoringResult.warnings.slice(0, 3)
    }
  };
};

const generateRiskSummary = (scoringResult) => {
  const riskFactors = [];
  
  if (scoringResult.signals.holder_concentration_top1 > 30) {
    riskFactors.push('Alta concentración de tokens en pocos holders');
  }
  if (!scoringResult.signals.ownership_renounced) {
    riskFactors.push('Owner mantiene control administrativo');
  }
  if (!scoringResult.signals.contract_verified) {
    riskFactors.push('Contrato no verificado - código no auditable');
  }
  if (scoringResult.signals.has_mint_function) {
    riskFactors.push('Función de mint presente - tokens pueden ser acuñados');
  }
  if (scoringResult.signals.has_blacklist_function) {
    riskFactors.push('Función de blacklist - direcciones pueden ser bloqueadas');
  }
  if (scoringResult.signals.liquidity_pool_age_days !== null && scoringResult.signals.liquidity_pool_age_days < 7) {
    riskFactors.push('Pool de liquidez muy nuevo');
  }
  if (scoringResult.signals.liquidity_amount_usd !== null && scoringResult.signals.liquidity_amount_usd < 10000) {
    riskFactors.push('Baja liquidez en pool');
  }
  
  return {
    totalRiskFactors: riskFactors.length,
    riskFactors: riskFactors,
    recommendation: scoringResult.score > 60 ? 'ALTO RIESGO - No invertir' :
                    scoringResult.score > 30 ? 'RIESGO MODERADO - Investigar más' :
                    'BAJO RIESGO - Contrato estándar'
  };
};

const getFromIpfs = async (cid) => {
  try {
    const response = await axios.get(`${PINATA_GATEWAY}/${cid}`, {
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('[IPFS] Error recuperando de IPFS:', error.message);
    throw new Error(`Error leyendo de IPFS: ${error.message}`);
  }
};

const getGatewayUrl = (cid) => {
  return `${PINATA_GATEWAY}/${cid}`;
};

module.exports = {
  pinJsonToIpfs,
  buildFullReport,
  buildMetadata,
  getFromIpfs,
  getGatewayUrl,
  generateRiskSummary
};
