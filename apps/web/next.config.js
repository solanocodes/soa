/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    // Boots src/instrumentation.ts on server start (daily recap scheduler).
    instrumentationHook: true,
    serverComponentsExternalPackages: ['knex', 'pg', 'bcryptjs', 'jsonwebtoken', 'openai', '@anthropic-ai/sdk', 'node-cron'],
  },
};

module.exports = nextConfig;
