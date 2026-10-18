/**
 * Curated instrument list.
 *
 * Add an entry here and it appears in the search box automatically — nothing
 * else in the app needs to change. `dataSource` decides which fetcher is used:
 *
 *   'twelve-data' -> needs TWELVE_DATA_KEY (metals, forex, stocks)
 *   'crypto'      -> Kraken public OHLC with Coinbase Exchange as fallback,
 *                    no API key needed
 *
 * `pricePrecision` is how many decimals the market quotes in; it only affects
 * display.
 */

export type DataSource = 'twelve-data' | 'crypto';
export type AssetKind = 'metal' | 'forex' | 'crypto' | 'stock';

export interface SymbolConfig {
  /** Canonical symbol used in URLs and API calls, e.g. "XAUUSD". */
  symbol: string;
  /** Human label shown in the search box, e.g. "Gold / US Dollar". */
  name: string;
  kind: AssetKind;
  dataSource: DataSource;
  /** Ticker as understood by the upstream provider, when it differs. */
  providerSymbol?: string;
  pricePrecision: number;
}

export const SYMBOLS: readonly SymbolConfig[] = [
  {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    kind: 'metal',
    dataSource: 'twelve-data',
    pricePrecision: 2,
  },
  {
    symbol: 'XAGUSD',
    name: 'Silver / US Dollar',
    kind: 'metal',
    dataSource: 'twelve-data',
    pricePrecision: 3,
  },
  {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    kind: 'forex',
    dataSource: 'twelve-data',
    pricePrecision: 5,
  },
  {
    symbol: 'GBPUSD',
    name: 'British Pound / US Dollar',
    kind: 'forex',
    dataSource: 'twelve-data',
    pricePrecision: 5,
  },
  {
    symbol: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    kind: 'forex',
    dataSource: 'twelve-data',
    pricePrecision: 3,
  },
  {
    symbol: 'BTCUSD',
    name: 'Bitcoin / US Dollar',
    kind: 'crypto',
    dataSource: 'crypto',
    // Kraken and Coinbase both quote bitcoin as XBTUSD.
    providerSymbol: 'XBTUSD',
    pricePrecision: 2,
  },
  {
    symbol: 'ETHUSD',
    name: 'Ethereum / US Dollar',
    kind: 'crypto',
    dataSource: 'crypto',
    pricePrecision: 2,
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    kind: 'stock',
    dataSource: 'twelve-data',
    pricePrecision: 2,
  },
  {
    symbol: 'TSLA',
    name: 'Tesla Inc.',
    kind: 'stock',
    dataSource: 'twelve-data',
    pricePrecision: 2,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    kind: 'stock',
    dataSource: 'twelve-data',
    pricePrecision: 2,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    kind: 'stock',
    dataSource: 'twelve-data',
    pricePrecision: 2,
  },
  { symbol: 'SOLUSD', name: 'Solana / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 2 },
  { symbol: 'LTCUSD', name: 'Litecoin / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 2 },
  { symbol: 'XRPUSD', name: 'XRP / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 4 },
  { symbol: 'ADAUSD', name: 'Cardano / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 4 },
  { symbol: 'LINKUSD', name: 'Chainlink / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 3 },
  { symbol: 'AVAXUSD', name: 'Avalanche / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 2 },
  { symbol: 'DOTUSD', name: 'Polkadot / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 3 },
  { symbol: 'BCHUSD', name: 'Bitcoin Cash / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 2 },
  { symbol: 'ATOMUSD', name: 'Cosmos / US Dollar', kind: 'crypto', dataSource: 'crypto', pricePrecision: 3 },
] as const;

/** Case-insensitive lookup by canonical symbol. */
export function findSymbol(input: string): SymbolConfig | undefined {
  const needle = input.trim().toUpperCase();
  return SYMBOLS.find((s) => s.symbol === needle);
}

/**
 * Autocomplete over ticker and display name. Prefix matches on the ticker rank
 * above substring matches, which is what people expect when they type "BT".
 */
export function searchSymbols(query: string, limit = 8): SymbolConfig[] {
  const q = query.trim().toUpperCase();
  if (!q) return SYMBOLS.slice(0, limit);

  const scored = SYMBOLS.map((entry) => {
    const ticker = entry.symbol;
    const name = entry.name.toUpperCase();
    let score = -1;
    if (ticker === q) score = 0;
    else if (ticker.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (ticker.includes(q)) score = 3;
    else if (name.includes(q)) score = 4;
    return { entry, score };
  }).filter((row) => row.score >= 0);

  scored.sort((a, b) => a.score - b.score || a.entry.symbol.localeCompare(b.entry.symbol));
  return scored.slice(0, limit).map((row) => row.entry);
}
