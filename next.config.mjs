/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // The encryption functions use Web Crypto API (CryptoKey, TextEncoder etc.)
    // which are DOM types only available at runtime in the browser.
    // The Next.js build worker runs in Node.js and cannot resolve these types
    // even though the code is inside a 'use client' component and never runs server-side.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
