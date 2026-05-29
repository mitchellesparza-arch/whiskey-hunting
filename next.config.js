/** @type {import('next').NextConfig} */
const nextConfig = {
  // web-push uses Node.js crypto — must not be bundled by webpack
  serverExternalPackages: ['web-push'],

}

module.exports = nextConfig
