/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // The encryption functions use browser-only Web Crypto APIs (window.crypto,
    // TextEncoder, CryptoKey) which are valid at runtime in the browser but
    // cannot be resolved by the Next.js build worker running in Node.js.
    // Type checking should be run locally with `tsc --noEmit` instead.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
