const { getAiExplanation } = require('./llmService');

const DEFAULT_AI_RESPONSE = {
  riskScore: 50,
  level: 'Medium',
  status: 'ai_service_unavailable',
  message: 'No se pudo contactar al motor de IA',
  explanation: 'Análisis disponible sin explicación IA'
};

const getAiPrediction = async (avalancheData, scoringResult, language = 'en') => {
  try {
    const explanation = await getAiExplanation(
      avalancheData.address,
      scoringResult.score,
      scoringResult.level,
      scoringResult.warnings,
      scoringResult.signals,
      language
    );

    return {
      riskScore: scoringResult.score,
      level: scoringResult.level,
      status: 'success',
      explanation: explanation || 'Análisis disponible sin explicación IA',
      warnings: scoringResult.warnings,
      activeSignals: scoringResult.activeSignals
    };
  } catch (error) {
    console.error('Error en getAiPrediction:', error.message);
    return DEFAULT_AI_RESPONSE;
  }
};

module.exports = { getAiPrediction };
