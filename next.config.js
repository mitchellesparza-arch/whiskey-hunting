/** @type {import('next').NextConfig} */
const nextConfig = {
  // web-push uses Node.js crypto — must not be bundled by webpack
  serverExternalPackages: ['web-push'],

  // Allow fetching from Binny's domain
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
