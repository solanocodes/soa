/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['knex', 'pg', 'bcryptjs', 'jsonwebtoken', 'openai', '@anthropic-ai/sdk', 'node-cron'],
  },
};

module.exports = nextConfig;
