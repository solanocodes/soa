/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['knex', 'pg', 'bcryptjs', 'jsonwebtoken', 'openai', 'node-cron'],
  },
};

module.exports = nextConfig;
