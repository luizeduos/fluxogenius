/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config: { resolve: { fallback: any; }; }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false, // não deixa cair no client
    };
    return config;
  },
};

module.exports = nextConfig;
