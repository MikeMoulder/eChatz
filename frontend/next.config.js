/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Proxy all Zama relayer requests through Next.js server to avoid browser CORS.
   * Browser calls /api/relayer/v2/... → Next.js server fetches relayer.testnet.zama.org/v2/...
   */
  async rewrites() {
    return [
      {
        source: "/api/relayer/:path*",
        destination: "https://relayer.testnet.zama.org/:path*",
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Required for ethers.js / wagmi compatibility in Next.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // Suppress missing optional peer deps pulled in by MetaMask SDK / WalletConnect
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    if (isServer) {
      // relayer-sdk/web references the browser global `self` at module init time.
      // Alias it to an empty module on the server to prevent SSR crashes.
      config.resolve.alias["@zama-fhe/relayer-sdk/web"] = false;
    }
    // Suppress circular-dependency warning from relayer-sdk worker chunks
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      /Circular dependency between chunks with runtime/,
    ];
    return config;
  },
};

module.exports = nextConfig;
