const axios = require('axios');

const ROUTESCAN_BASE_URL = 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api';

const fetchTotalSupply = async (address) => {
  try {
    const response = await axios.get(ROUTESCAN_BASE_URL, {
      params: { module: 'stats', action: 'tokensupply', contractaddress: address },
      timeout: 10000
    });
    if (response.data.status === '1' && response.data.result) {
      return BigInt(response.data.result);
    }
    return null;
  } catch {
    return null;
  }
};

const fetchTokenHolders = async (address) => {
  try {
    const [holdersRes, totalSupply] = await Promise.all([
      axios.get(ROUTESCAN_BASE_URL, {
        params: {
          module: 'token',
          action: 'tokenholderlist',
          contractaddress: address,
          page: 1,
          offset: 100
        },
        timeout: 15000
      }),
      fetchTotalSupply(address)
    ]);

    const data = holdersRes.data;
    if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) {
      return null;
    }

    if (!totalSupply || totalSupply === BigInt(0)) return null;

    const holders = data.result.map(item => ({
      address: item.TokenHolderAddress,
      balance: BigInt(item.TokenHolderQuantity)
    }));

    // Routescan returns holders sorted by balance descending
    const top1Pct = Number((holders[0].balance * BigInt(10000)) / totalSupply) / 100;

    let top10Balance = BigInt(0);
    for (let i = 0; i < Math.min(10, holders.length); i++) {
      top10Balance += holders[i].balance;
    }
    const top10Pct = Number((top10Balance * BigInt(10000)) / totalSupply) / 100;

    return {
      holder_concentration_top1:  Math.round(top1Pct  * 100) / 100,
      holder_concentration_top10: Math.round(top10Pct * 100) / 100,
      total_holders: holders.length,
    };
  } catch (error) {
    console.error('Error fetching token holders:', error.message);
    return null;
  }
};

const fetchLiquidityData = async (address) => {
  try {
    const response = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { timeout: 10000 }
    );
    const pairs = response.data?.pairs;
    if (!pairs || pairs.length === 0) return null;

    // Pick the Avalanche pair with the highest liquidity
    const avaxPairs = pairs.filter(p => p.chainId === 'avalanche');
    const pool = avaxPairs.length > 0
      ? avaxPairs.reduce((best, p) => ((p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best), avaxPairs[0])
      : pairs.reduce((best, p) => ((p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best), pairs[0]);

    const liquidityUsd = pool.liquidity?.usd ?? null;
    const pairCreatedAt = pool.pairCreatedAt ?? null;

    let ageDays = null;
    if (pairCreatedAt) {
      ageDays = Math.floor((Date.now() - pairCreatedAt) / (1000 * 60 * 60 * 24));
    }

    return {
      liquidity_amount_usd: typeof liquidityUsd === 'number' ? Math.round(liquidityUsd) : null,
      liquidity_pool_age_days: ageDays,
    };
  } catch {
    return null;
  }
};

const fetchCovalentData = async (address) => {
  const [holders, liquidity] = await Promise.all([
    fetchTokenHolders(address),
    fetchLiquidityData(address),
  ]);
  return { holders, liquidity, metadata: null };
};

module.exports = { fetchCovalentData, fetchTokenHolders };
