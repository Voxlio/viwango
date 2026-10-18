import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The API route reads process.env at request time, so nothing here needs
  // to be exposed to the browser bundle.
};

export default nextConfig;
