/** @type {import('next').NextConfig} */
const nextConfig = {
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
