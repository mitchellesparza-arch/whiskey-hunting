/** @type {import('next').NextConfig} */
const nextConfig = {
  // web-push uses Node.js crypto — must not be bundled by webpack
  serverExternalPackages: ['web-push'],
}

export default nextConfig
