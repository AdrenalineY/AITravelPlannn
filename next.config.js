/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 standalone 输出模式(Docker 优化)
  output: 'standalone',
  
  images: {
    domains: ['api.mapbox.com', 'restapi.amap.com'],
  },
  
  // 在 Docker 构建时跳过 ESLint 检查(加快构建速度)
  eslint: {
    // 警告:这会在生产构建时忽略 ESLint 错误
    ignoreDuringBuilds: true,
  },
  
  // 在 Docker 构建时跳过 TypeScript 类型检查(可选)
  typescript: {
    // 警告:这会在生产构建时忽略类型错误
    ignoreBuildErrors: true, // Docker 构建时忽略类型错误
  },
}

module.exports = nextConfig
