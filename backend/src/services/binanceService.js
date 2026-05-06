const axios = require('axios');

const BINANCE_BASE = 'https://api.binance.com/api/v3';

const binanceService = {
  /**
   * Fetch the current price for a single symbol.
   * @param {string} symbol  e.g. "BTCUSDT"
   * @returns {Promise<number>}
   */
  async getPrice(symbol) {
    try {
      const response = await axios.get(`${BINANCE_BASE}/ticker/price`, {
        params: { symbol: symbol.toUpperCase() },
        timeout: 5000,
      });
      return parseFloat(response.data.price);
    } catch (err) {
      if (err.response?.status === 400) {
        throw new Error(`Invalid symbol: ${symbol}`);
      }
      throw new Error(`Binance price fetch failed for ${symbol}: ${err.message}`);
    }
  },

  /**
   * Fetch prices for multiple symbols in parallel.
   * Returns a map of { SYMBOL: price }.
   * Symbols that fail are omitted from the result.
   * @param {string[]} symbols
   * @returns {Promise<Record<string, number>>}
   */
  async getPrices(symbols) {
    if (symbols.length === 0) return {};

    const results = await Promise.allSettled(
      symbols.map((symbol) =>
        this.getPrice(symbol).then((price) => ({ symbol: symbol.toUpperCase(), price }))
      )
    );

    const priceMap = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        priceMap[result.value.symbol] = result.value.price;
      } else {
        console.warn('Could not fetch price:', result.reason?.message);
      }
    }
    return priceMap;
  },
};

module.exports = binanceService;
