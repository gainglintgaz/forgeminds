interface SeedEntity {
  name: string;
  symbol: string;
  type: "stock" | "crypto" | "index" | "commodity";
  aliases: string[];
}

export const SEED_ENTITIES: SeedEntity[] = [
  // Major indices
  { symbol: "SPX", name: "S&P 500", type: "index", aliases: ["s&p 500", "s&p", "sp 500", "sp500", "spy"] },
  { symbol: "NDX", name: "NASDAQ-100", type: "index", aliases: ["nasdaq 100", "nasdaq", "nasdaq composite", "qqq"] },
  { symbol: "DJI", name: "Dow Jones", type: "index", aliases: ["dow jones", "dow", "djia", "dia"] },
  { symbol: "RUT", name: "Russell 2000", type: "index", aliases: ["russell 2000", "russell", "iwm"] },

  // Mega-cap stocks
  { symbol: "AAPL", name: "Apple Inc.", type: "stock", aliases: ["apple"] },
  { symbol: "MSFT", name: "Microsoft", type: "stock", aliases: ["microsoft"] },
  { symbol: "GOOG", name: "Alphabet Inc.", type: "stock", aliases: ["google", "alphabet"] },
  { symbol: "AMZN", name: "Amazon", type: "stock", aliases: ["amazon"] },
  { symbol: "NVDA", name: "Nvidia", type: "stock", aliases: ["nvidia"] },
  { symbol: "META", name: "Meta Platforms", type: "stock", aliases: ["meta", "facebook"] },
  { symbol: "TSLA", name: "Tesla Inc.", type: "stock", aliases: ["tesla"] },
  { symbol: "JPM", name: "JPMorgan Chase", type: "stock", aliases: ["jpmorgan", "jp morgan", "chase"] },
  { symbol: "V", name: "Visa Inc.", type: "stock", aliases: ["visa"] },
  { symbol: "WMT", name: "Walmart", type: "stock", aliases: ["walmart"] },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "stock", aliases: ["johnson & johnson", "j&j"] },
  { symbol: "UNH", name: "UnitedHealth", type: "stock", aliases: ["unitedhealth", "united health"] },
  { symbol: "CRM", name: "Salesforce", type: "stock", aliases: ["salesforce"] },
  { symbol: "AMD", name: "AMD", type: "stock", aliases: ["advanced micro devices"] },
  { symbol: "INTC", name: "Intel", type: "stock", aliases: ["intel"] },
  { symbol: "DIS", name: "Walt Disney", type: "stock", aliases: ["disney", "walt disney"] },
  { symbol: "NFLX", name: "Netflix", type: "stock", aliases: ["netflix"] },
  { symbol: "BA", name: "Boeing", type: "stock", aliases: ["boeing"] },
  { symbol: "GS", name: "Goldman Sachs", type: "stock", aliases: ["goldman sachs", "goldman"] },
  { symbol: "COIN", name: "Coinbase", type: "stock", aliases: ["coinbase"] },
  { symbol: "PLTR", name: "Palantir", type: "stock", aliases: ["palantir"] },
  { symbol: "MRNA", name: "Moderna", type: "stock", aliases: ["moderna"] },
  { symbol: "PYPL", name: "PayPal", type: "stock", aliases: ["paypal"] },
  { symbol: "SQ", name: "Block Inc.", type: "stock", aliases: ["block", "square"] },
  { symbol: "UBER", name: "Uber", type: "stock", aliases: ["uber"] },
  { symbol: "ABNB", name: "Airbnb", type: "stock", aliases: ["airbnb"] },
  { symbol: "SNAP", name: "Snap Inc.", type: "stock", aliases: ["snap", "snapchat"] },
  { symbol: "SHOP", name: "Shopify", type: "stock", aliases: ["shopify"] },
  { symbol: "ROKU", name: "Roku", type: "stock", aliases: ["roku"] },
  { symbol: "ZM", name: "Zoom", type: "stock", aliases: ["zoom"] },
  { symbol: "RIVN", name: "Rivian", type: "stock", aliases: ["rivian"] },
  { symbol: "LCID", name: "Lucid Motors", type: "stock", aliases: ["lucid", "lucid motors"] },
  { symbol: "F", name: "Ford", type: "stock", aliases: ["ford"] },
  { symbol: "GM", name: "General Motors", type: "stock", aliases: ["general motors", "gm"] },
  { symbol: "XOM", name: "Exxon Mobil", type: "stock", aliases: ["exxon", "exxon mobil", "exxonmobil"] },
  { symbol: "CVX", name: "Chevron", type: "stock", aliases: ["chevron"] },

  // Additional S&P 500 stocks (to reach 50+)
  { symbol: "BRK.B", name: "Berkshire Hathaway", type: "stock", aliases: ["berkshire hathaway", "berkshire", "warren buffett"] },
  { symbol: "LLY", name: "Eli Lilly", type: "stock", aliases: ["eli lilly", "lilly"] },
  { symbol: "AVGO", name: "Broadcom", type: "stock", aliases: ["broadcom"] },
  { symbol: "MA", name: "Mastercard", type: "stock", aliases: ["mastercard"] },
  { symbol: "PG", name: "Procter & Gamble", type: "stock", aliases: ["procter & gamble", "procter and gamble", "p&g"] },
  { symbol: "HD", name: "Home Depot", type: "stock", aliases: ["home depot"] },
  { symbol: "COST", name: "Costco", type: "stock", aliases: ["costco"] },
  { symbol: "ABBV", name: "AbbVie", type: "stock", aliases: ["abbvie"] },
  { symbol: "KO", name: "Coca-Cola", type: "stock", aliases: ["coca-cola", "coca cola", "coke"] },
  { symbol: "PEP", name: "PepsiCo", type: "stock", aliases: ["pepsico", "pepsi"] },
  { symbol: "MRK", name: "Merck", type: "stock", aliases: ["merck"] },
  { symbol: "CSCO", name: "Cisco", type: "stock", aliases: ["cisco"] },
  { symbol: "ORCL", name: "Oracle", type: "stock", aliases: ["oracle"] },
  { symbol: "ACN", name: "Accenture", type: "stock", aliases: ["accenture"] },
  { symbol: "ADBE", name: "Adobe", type: "stock", aliases: ["adobe"] },
  { symbol: "TMO", name: "Thermo Fisher", type: "stock", aliases: ["thermo fisher"] },
  { symbol: "MCD", name: "McDonald's", type: "stock", aliases: ["mcdonalds", "mcdonald's"] },
  { symbol: "NKE", name: "Nike", type: "stock", aliases: ["nike"] },
  { symbol: "T", name: "AT&T", type: "stock", aliases: ["at&t", "att"] },

  // Crypto
  { symbol: "BTC", name: "Bitcoin", type: "crypto", aliases: ["bitcoin", "btc"] },
  { symbol: "ETH", name: "Ethereum", type: "crypto", aliases: ["ethereum", "ether", "eth"] },
  { symbol: "SOL", name: "Solana", type: "crypto", aliases: ["solana"] },
  { symbol: "XRP", name: "XRP", type: "crypto", aliases: ["ripple", "xrp"] },
  { symbol: "DOGE", name: "Dogecoin", type: "crypto", aliases: ["dogecoin", "doge"] },
  { symbol: "ADA", name: "Cardano", type: "crypto", aliases: ["cardano"] },
  { symbol: "BNB", name: "BNB", type: "crypto", aliases: ["binance coin", "bnb"] },
  { symbol: "AVAX", name: "Avalanche", type: "crypto", aliases: ["avalanche"] },
  { symbol: "DOT", name: "Polkadot", type: "crypto", aliases: ["polkadot"] },
  { symbol: "LINK", name: "Chainlink", type: "crypto", aliases: ["chainlink"] },
  { symbol: "SHIB", name: "Shiba Inu", type: "crypto", aliases: ["shiba inu", "shib"] },
  { symbol: "MATIC", name: "Polygon", type: "crypto", aliases: ["polygon", "matic"] },
  { symbol: "TRX", name: "Tron", type: "crypto", aliases: ["tron"] },
  { symbol: "UNI", name: "Uniswap", type: "crypto", aliases: ["uniswap"] },
  { symbol: "APT", name: "Aptos", type: "crypto", aliases: ["aptos"] },

  // Commodities
  { symbol: "GC", name: "Gold", type: "commodity", aliases: ["gold", "gold prices"] },
  { symbol: "SI", name: "Silver", type: "commodity", aliases: ["silver", "silver prices"] },
  { symbol: "CL", name: "Crude Oil", type: "commodity", aliases: ["crude oil", "oil prices", "wti", "brent", "crude"] },
  { symbol: "NG", name: "Natural Gas", type: "commodity", aliases: ["natural gas", "nat gas"] },
];

// Words that should never match as entity names
export const ENTITY_BLACKLIST = new Set([
  "the", "a", "an", "is", "of", "to", "in", "it", "on", "he", "she", "as", "for", "with",
  "by", "at", "but", "not", "so", "be", "all", "its", "are", "has", "now", "and", "or",
  "key", "day", "open", "fast", "de", "eu", "pm", "uk", "us", "vs", "ai", "ceo", "ipo",
  "buy", "sell", "long", "short", "deal", "gain", "down", "over", "than", "from", "that",
  "news", "etfs", "defi", "web3", "nft", "spot", "gdp", "sec", "fed",
]);
