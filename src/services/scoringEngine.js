const RISK_WEIGHTS = {
  holder_concentration_top1: { threshold: 30, score: 20, weight: 20 },
  holder_concentration_top10: { threshold: 60, score: 15, weight: 15 },
  ownership_renounced: { score: 20, inverted: true, weight: 20 },
  contract_verified: { score: 15, inverted: true, weight: 15 },
  has_mint_function: { score: 10, weight: 10 },
  has_blacklist_function: { score: 10, weight: 10 },
  has_pause_function: { score: 5, weight: 5 },
  has_transfer_restrictions: { score: 10, weight: 10 },
  liquidity_pool_age_days: { threshold: 7, score: 10, weight: 10 },
  liquidity_amount_usd: { threshold: 10000, score: 10, inverted: true, weight: 10 },
  is_proxy: { score: 5, weight: 5 }
};

const computeScore = (signals, language = 'en') => {
  const es = language === 'es';
  let score = 0;
  const warnings = [];
  const activeSignals = [];

  const signalChecks = [
    {
      key: 'holder_concentration_top1',
      condition: signals.holder_concentration_top1 > 30,
      warning: es
        ? `El mayor holder controla el ${signals.holder_concentration_top1}% del supply`
        : `Top holder controls ${signals.holder_concentration_top1}% of supply`,
    },
    {
      key: 'holder_concentration_top10',
      condition: signals.holder_concentration_top10 > 60,
      warning: es
        ? `Los top 10 holders controlan el ${signals.holder_concentration_top10}% del supply`
        : `Top 10 holders control ${signals.holder_concentration_top10}% of supply`,
    },
    {
      key: 'ownership_renounced',
      condition: signals.ownership_renounced === false,
      warning: es
        ? 'El owner no ha renunciado al control del contrato'
        : 'Owner has not renounced ownership',
    },
    {
      key: 'contract_verified',
      condition: signals.contract_verified === false,
      warning: es
        ? 'El contrato no está verificado en Snowtrace'
        : 'Contract is not verified on Snowtrace',
    },
    {
      key: 'has_mint_function',
      condition: signals.has_mint_function === true,
      warning: es
        ? 'El contrato tiene función de minting (puede acuñar tokens adicionales)'
        : 'Contract includes a mint function (unlimited token creation possible)',
    },
    {
      key: 'has_blacklist_function',
      condition: signals.has_blacklist_function === true,
      warning: es
        ? 'El contrato tiene función de blacklist (puede bloquear direcciones)'
        : 'Contract includes a blacklist function (your wallet could be blocked)',
    },
    {
      key: 'has_pause_function',
      condition: signals.has_pause_function === true,
      warning: es
        ? 'El contrato tiene función de pausa (puede detener transferencias)'
        : 'Contract includes a pause function (transfers can be frozen)',
    },
    {
      key: 'has_transfer_restrictions',
      condition: signals.has_transfer_restrictions === true,
      warning: es
        ? 'El contrato tiene restricciones de transferencia'
        : 'Contract has transfer restrictions',
    },
    {
      key: 'liquidity_pool_age_days',
      condition: signals.liquidity_pool_age_days !== null && signals.liquidity_pool_age_days < 7,
      warning: es
        ? `Pool de liquidez creado hace ${signals.liquidity_pool_age_days} días (menos de 7 días es sospechoso)`
        : `Liquidity pool was created only ${signals.liquidity_pool_age_days} day(s) ago`,
    },
    {
      key: 'liquidity_amount_usd',
      condition: signals.liquidity_amount_usd !== null && signals.liquidity_amount_usd < 10000,
      warning: es
        ? `Liquidez muy baja: $${signals.liquidity_amount_usd?.toLocaleString() || 0} USD`
        : `Very low liquidity ($${signals.liquidity_amount_usd?.toLocaleString() || 0})`,
    },
    {
      key: 'is_proxy',
      condition: signals.is_proxy === true,
      warning: es
        ? 'El contrato es un proxy (verificar implementación)'
        : 'Contract is a proxy (verify the implementation)',
    },
  ];

  for (const check of signalChecks) {
    const weightConfig = RISK_WEIGHTS[check.key];
    if (!weightConfig) continue;

    if (check.condition) {
      activeSignals.push(check.key);
      score += weightConfig.score;
      warnings.push(check.warning);
    }
  }

  score = Math.max(0, Math.min(100, score));

  let level;
  if (score <= 30) {
    level = 'Low';
  } else if (score <= 60) {
    level = 'Medium';
  } else {
    level = 'High';
  }

  return { score, level, warnings, activeSignals };
};

const extractSignals = (contractData) => {
  const signals = {
    contract_verified: false,
    has_mint_function: false,
    has_blacklist_function: false,
    has_pause_function: false,
    ownership_renounced: false,
    has_transfer_restrictions: false,
    holder_concentration_top1: 0,
    holder_concentration_top10: 0,
    liquidity_pool_age_days: null,
    liquidity_amount_usd: null,
    is_proxy: false
  };

  if (contractData.snowtrace) {
    const sourceCode = (contractData.snowtrace.sourceCode || '').toLowerCase();
    const abi = (contractData.snowtrace.abi || '[]').toLowerCase();

    signals.contract_verified = sourceCode.length > 0;

    signals.has_mint_function = [
      'function mint', 'function _mint', 'function safemint',
      'function mintto', 'function mint(', 'function _mintee'
    ].some(pattern => sourceCode.includes(pattern));

    signals.has_blacklist_function = [
      'blacklist', 'blocklist', 'isblacklisted', 'isblocked',
      'function ban', 'function block', 'function exclude'
    ].some(pattern => sourceCode.includes(pattern));

    signals.has_pause_function = [
      'function pause', 'function pause()', 'whenpaused',
      'pausable', '_pause', 'pause()'
    ].some(pattern => sourceCode.includes(pattern));

    signals.has_transfer_restrictions = [
      'transferlocked', 'cannottransfer', 'transferrestrictions',
      'notransfer', 'locktransfer'
    ].some(pattern => sourceCode.includes(pattern));

    signals.is_proxy = sourceCode.includes('proxy') || 
                        sourceCode.includes('upgrades') ||
                        abi.includes('implementation') ||
                        sourceCode.includes('delegatecall');
  }

  if (contractData.contractState && contractData.contractState.owner) {
    signals.ownership_renounced = 
      contractData.contractState.owner.toLowerCase() === '0x0000000000000000000000000000000000000000';
  }

  if (contractData.covalent && contractData.covalent.holders) {
    signals.holder_concentration_top1 = contractData.covalent.holders.holder_concentration_top1 || 0;
    signals.holder_concentration_top10 = contractData.covalent.holders.holder_concentration_top10 || 0;
  }

  if (contractData.covalent && contractData.covalent.liquidity) {
    signals.liquidity_amount_usd   = contractData.covalent.liquidity.liquidity_amount_usd;
    signals.liquidity_pool_age_days = contractData.covalent.liquidity.liquidity_pool_age_days;
  }

  return signals;
};

module.exports = { computeScore, extractSignals, RISK_WEIGHTS };
