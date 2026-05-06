import axios from 'axios';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

export const binanceService = {
  async getPrice(symbol: string): Promise<number> {
    try {
      const response = await axios.get<{ price: string }>(`${BINANCE_BASE}/ticker/price`, {
        params: { symbol: symbol.toUpperCase() },
        timeout: 5000,
      });
      return parseFloat(response.data.price);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number }; message: string };
      if (axiosErr.response?.status === 400) {
        throw new Error(`Invalid symbol: ${symbol}`);
      }
      throw new Error(`Binance price fetch failed for ${symbol}: ${axiosErr.message}`);
    }
  },

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    if (symbols.length === 0) return {};

    const results = await Promise.allSettled(
      symbols.map((symbol) =>
        this.getPrice(symbol).then((price) => ({ symbol: symbol.toUpperCase(), price }))
      )
    );

    const priceMap: Record<string, number> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        priceMap[result.value.symbol] = result.value.price;
      } else {
        console.warn('Could not fetch price:', (result.reason as Error)?.message);
      }
    }
    return priceMap;
  },
};
