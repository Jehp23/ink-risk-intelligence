const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const MODEL = 'llama-3.3-70b-versatile';
const TEMPERATURE = 0.3;
const MAX_TOKENS = 300;

const SYSTEM_PROMPT = `Eres un analista de seguridad blockchain. Tu trabajo es explicar el riesgo de contratos inteligentes a usuarios no técnicos en lenguaje simple y directo. Evita jerga técnica. Nunca inventes señales que no fueron proporcionadas.`;

const getAiExplanation = async (address, score, level, warnings, signals, language = 'en') => {
  console.log('🔍 [LLM] Iniciando consulta a Groq...');
  console.log('🔍 [LLM] API Key presente:', !!GROQ_API_KEY);

  if (!GROQ_API_KEY) {
    console.warn('GROQ_API_KEY no está configurada en process.env');
    return null;
  }

  const signalsList = Object.entries(signals)
    .filter(([key, value]) => value !== false && value !== null && value !== 0)
    .map(([key, value]) => {
      if (typeof value === 'number') {
        return `- ${key}: ${value}%`;
      }
      return `- ${key}: ${value}`;
    })
    .join('\n');

  const langInstruction = language === 'es' ? 'Respond in Spanish.' : 'Respond in English.';

  const userPrompt = `Analiza el siguiente smart contract risk data y explícalo claramente. ${langInstruction}

Contract address: ${address}
Risk score: ${score}/100
Risk level: ${level}

Detected signals:
${signalsList || 'No se detectaron señales específicas.'}

Your response must include:
1. A 2-3 sentence plain-language explanation of why this contract is risky (or not).
2. The most important warnings, phrased so a non-technical user understands the real-world implication.
3. A one-sentence bottom line.

Do not repeat the raw signal names. Translate them into consequences the user cares about.`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return response.data.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('❌ [LLM] Error en Groq API:', error.message);
    if (error.response) {
      console.error('❌ [LLM] Response data:', error.response.data);
      console.error('❌ [LLM] Response status:', error.response.status);
    }
    if (error.code) {
      console.error('❌ [LLM] Error code:', error.code);
    }
    return null;
  }
};

module.exports = { getAiExplanation };
