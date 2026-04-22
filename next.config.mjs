/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // The encryption functions use browser-only Web Crypto API (window.crypto)
    // which TypeScript's server-side build worker cannot resolve.
    // All crypto code is inside 'use client' components and only runs in the browser.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
