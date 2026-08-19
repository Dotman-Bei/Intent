/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // RainbowKit pulls in @wagmi/connectors -> @base-org/account -> @coinbase/cdp-sdk, which
    // imports x402 payment packages that ship as optional peers. None of them are reachable from
    // the connectors this app uses, so they resolve to empty modules instead of failing the build.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/svm": false,
    };
    // Optional logger/storage backends the WalletConnect stack probes for at runtime.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
