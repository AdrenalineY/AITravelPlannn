# 纯前端 AI 旅行规划师开发环境配置指南

## 1. 环境概述

### 1.1 纯前端技术栈总览
- **前端框架**：Next.js 14 + React 18 + TypeScript + Tailwind CSS + Ant Design
- **地图渲染**：Mapbox GL JS 2.x
- **状态管理**：Zustand 4.x（轻量级状态管理）
- **音频处理**：Web Audio API + MediaRecorder API（浏览器原生）
- **数据存储**：Supabase (PostgreSQL + Auth + Storage + Realtime)
- **第三方 API**：阿里云百炼、科大讯飞 WebAPI、高德地图 API
- **部署平台**：Vercel / Netlify（静态站点托管）
- **环境管理**：Node.js + npm/yarn（无需后端服务器）

### 1.2 纯前端架构优势
- ✅ **部署简单**：无需后端服务器，直接部署到 CDN
- ✅ **成本可控**：只需支付静态站点托管费用
- ✅ **扩展性好**：利用云服务的自动扩展能力
- ✅ **用户可控**：API 密钥由用户掌控，隐私安全
- ✅ **开发效率**：专注前端开发，无需维护后端服务
- ✅ **快速迭代**：代码更新即时生效，无需服务器重启

### 1.3 开发环境要求
- **操作系统**：Windows 11、macOS、或 Linux
- **Node.js**：版本 18.x 或 20.x LTS
- **包管理器**：npm 或 yarn 或 pnpm
- **浏览器**：Chrome/Edge/Firefox（支持 Web Audio API）
- **内存**：建议 8GB 以上
- **磁盘空间**：至少 2GB 可用空间
- **网络**：稳定的网络连接（调用第三方 API）

## 2. Node.js 环境安装与配置

### 2.1 安装 Node.js

#### Windows 11 安装
```powershell
# 方法1：直接下载安装包（推荐）
# 访问：https://nodejs.org/
# 下载并安装 LTS 版本（20.x）

# 方法2：使用 Chocolatey
choco install nodejs

# 方法3：使用 winget
winget install OpenJS.NodeJS

# 验证安装
node --version
npm --version
```

#### macOS 安装
```bash
# 方法1：使用 Homebrew（推荐）
brew install node

# 方法2：使用 nvm（Node版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts

# 验证安装
node --version
npm --version
```

#### Linux 安装
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

### 2.2 配置 npm 镜像源（加速下载）

```powershell
# 配置淘宝镜像源（国内推荐）
npm config set registry https://registry.npmmirror.com/

# 验证配置
npm config get registry

# 如果需要恢复官方源
# npm config set registry https://registry.npmjs.org/
```

## 3. 项目环境搭建

### 3.1 克隆项目代码

```powershell
# 克隆项目代码
git clone <repository-url>
cd AITravelPlanner

# 检查项目结构
dir
```

### 3.2 快速开始（推荐）

使用我们提供的快速启动脚本：

```powershell
# Windows PowerShell
.\setup.ps1

# macOS/Linux
chmod +x setup.sh
./setup.sh
```

### 3.3 手动搭建步骤

#### 步骤 1：安装项目依赖
```powershell
# 安装前端依赖
npm install

# 验证安装成功
npm list --depth=0
```

#### 步骤 2：配置环境变量
```powershell
# 复制环境变量模板
copy .env.example .env.local

# 编辑环境变量文件
notepad .env.local
```

配置以下关键环境变量：
```env
# Supabase 配置（必需）
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Mapbox 配置（用于地图渲染）
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token

# 应用配置
NEXT_PUBLIC_APP_NAME=AI旅行规划师
NEXT_PUBLIC_APP_VERSION=1.0.0

# 开发环境配置
NODE_ENV=development
```

#### 步骤 3：设置 Supabase 项目

1. **创建 Supabase 项目**：
   ```bash
   # 访问 https://supabase.com/
   # 创建新项目，获取项目 URL 和 anon key
   ```

2. **设置数据库表结构**：
   ```sql
   -- 用户偏好表
   CREATE TABLE user_preferences (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     preferences JSONB NOT NULL DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- 行程表
   CREATE TABLE itineraries (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     destination TEXT NOT NULL,
     start_date DATE NOT NULL,
     end_date DATE NOT NULL,
     data JSONB NOT NULL DEFAULT '{}',
     status TEXT DEFAULT 'draft',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- 费用记录表
   CREATE TABLE expenses (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
     amount DECIMAL(10,2) NOT NULL,
     category TEXT NOT NULL,
     description TEXT,
     date DATE NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

3. **设置行级安全策略（RLS）**：
   ```sql
   -- 启用 RLS
   ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
   ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
   ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

   -- 用户只能访问自己的数据
   CREATE POLICY "Users can view own preferences" ON user_preferences
     FOR SELECT USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can update own preferences" ON user_preferences
     FOR INSERT WITH CHECK (auth.uid() = user_id);
   
   CREATE POLICY "Users can update own preferences" ON user_preferences
     FOR UPDATE USING (auth.uid() = user_id);

   -- 类似的策略应用到其他表...
   ```

#### 步骤 4：获取第三方 API 密钥

应用需要以下 API 密钥（用户在首次使用时配置）：

1. **阿里云百炼 API**：
   - 访问：https://dashscope.console.aliyun.com/
   - 创建应用并获取 API Key

2. **科大讯飞语音 API**：
   - 访问：https://console.xfyun.cn/
   - 创建应用获取 AppID、API Key、API Secret

3. **高德地图 API**：
   - 访问：https://console.amap.com/dev/key/app
   - 创建应用获取 API Key

4. **Mapbox Access Token**：
   - 访问：https://account.mapbox.com/access-tokens/
   - 获取访问令牌

## 4. 启动开发环境

### 4.1 启动开发服务器

```powershell
# 启动开发服务器
npm run dev

# 或者使用 yarn
yarn dev

# 或者使用 pnpm
pnpm dev
```

### 4.2 验证应用运行

1. **访问应用**：http://localhost:3000
2. **首次使用向导**：配置 API 密钥
3. **登录/注册**：使用 Supabase Auth 认证
4. **主界面测试**：验证地图和对话功能

### 4.3 开发服务器配置

Next.js 开发服务器默认配置：
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['api.mapbox.com', 'restapi.amap.com']
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // PWA 配置
  pwa: {
    dest: 'public',
    register: true,
    skipWaiting: true,
  }
}

module.exports = nextConfig
```

## 5. 开发工作流

### 5.1 日常开发流程

```powershell
# 1. 拉取最新代码
git pull origin main

# 2. 安装/更新依赖（如有变化）
npm install

# 3. 启动开发服务器
npm run dev

# 4. 开始开发...

# 5. 提交代码
git add .
git commit -m "feat: add new feature"
git push origin main
```

### 5.2 常用开发命令

```powershell
# 开发服务器
npm run dev                          # 启动开发服务器（端口 3000）
npm run build                        # 构建生产版本
npm run start                        # 启动生产服务器
npm run lint                         # ESLint 代码检查
npm run lint:fix                     # 自动修复 lint 错误
npm run type-check                   # TypeScript 类型检查

# 测试相关
npm run test                         # 运行单元测试
npm run test:watch                   # 监听模式运行测试
npm run test:coverage                # 生成测试覆盖率报告
npm run e2e                          # 运行端到端测试

# 代码格式化
npm run format                       # Prettier 格式化代码
npm run format:check                 # 检查代码格式

# 依赖管理
npm run deps:check                   # 检查过期依赖
npm run deps:update                  # 更新依赖版本
```

### 5.3 代码质量工具配置

项目集成了完整的代码质量工具链：

#### ESLint 配置
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'error',
    'no-console': 'warn'
  }
}
```

#### Prettier 配置
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

#### Husky Git Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ]
  }
}
```

## 6. 开发最佳实践

### 6.1 项目结构规范

```
AITravelPlanner/
├── public/                  # 静态资源
│   ├── icons/              # 应用图标
│   ├── images/             # 图片资源
│   └── manifest.json       # PWA 配置
├── src/
│   ├── components/         # 可复用组件
│   │   ├── common/        # 通用组件
│   │   ├── map/           # 地图相关组件
│   │   ├── chat/          # 对话相关组件
│   │   └── voice/         # 语音相关组件
│   ├── pages/             # Next.js 页面
│   │   ├── api/           # API 路由（客户端代理）
│   │   ├── auth/          # 认证页面
│   │   ├── dashboard/     # 主界面
│   │   └── settings/      # 设置页面
│   ├── hooks/             # 自定义 Hooks
│   ├── services/          # API 服务客户端
│   ├── stores/            # Zustand 状态管理
│   ├── types/             # TypeScript 类型定义
│   ├── utils/             # 工具函数
│   └── styles/            # 样式文件
├── docs/                  # 项目文档
├── tests/                 # 测试文件
└── package.json
```

### 6.2 环境变量管理

```powershell
# 开发环境 (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_dev_anon_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
NODE_ENV=development

# 生产环境 (.env.production)
NEXT_PUBLIC_SUPABASE_URL=your_prod_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_prod_anon_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
NODE_ENV=production
```

### 6.3 依赖管理

```powershell
# 检查过期依赖
npm outdated

# 安全审计
npm audit
npm audit fix

# 清理依赖
npm prune

# 锁定依赖版本
npm ci  # 使用 package-lock.json 精确安装
```

### 6.4 故障排除

#### 常见问题解决方案

1. **端口占用**：
```powershell
# 查找占用端口的进程
netstat -ano | findstr :3000

# 强制结束进程
taskkill /PID <进程ID> /F
```

2. **依赖安装失败**：
```powershell
# 清理缓存重新安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

3. **TypeScript 错误**：
```powershell
# 重新生成类型定义
npm run type-check
```

4. **浏览器缓存问题**：
```powershell
# 硬刷新：Ctrl + Shift + R
# 或在开发者工具中禁用缓存
```

5. **API 调用失败**：
- 检查网络连接
- 验证 API 密钥是否正确
- 查看浏览器开发者工具的网络面板

## 7. 高级配置

### 7.1 IDE 集成配置

#### VS Code 配置
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact",
    "typescript": "typescriptreact"
  }
}

// .vscode/extensions.json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### 7.2 构建优化

#### Next.js 配置优化
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 SWC 编译器
  swcMinify: true,
  
  // 启用 React 严格模式
  reactStrictMode: true,
  
  // 图片优化配置
  images: {
    domains: [
      'api.mapbox.com',
      'restapi.amap.com',
      'your-supabase-project.supabase.co'
    ],
    formats: ['image/webp', 'image/avif']
  },
  
  // 压缩配置
  compress: true,
  
  // 实验性功能
  experimental: {
    // 启用应用目录
    appDir: false, // 暂时使用 pages router
    
    // 优化打包
    optimizeCss: true,
    
    // 启用 Turbopack（开发模式）
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js'
        }
      }
    }
  },
  
  // Webpack 配置
  webpack: (config, { dev, isServer }) => {
    // 优化打包大小
    if (!dev && !isServer) {
      config.optimization.splitChunks.chunks = 'all';
    }
    
    return config;
  },
  
  // PWA 配置
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export',
    trailingSlash: true,
    images: {
      unoptimized: true
    }
  })
}

module.exports = nextConfig
```

### 7.3 性能监控

#### Web Vitals 监控
```typescript
// pages/_app.tsx
import { AppProps } from 'next/app';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function reportWebVitals(metric: any) {
  // 发送到分析服务
  console.log(metric);
  
  // 或发送到外部监控服务
  if (process.env.NODE_ENV === 'production') {
    // analytics.track('Web Vital', metric);
  }
}

export function reportWebVitals(metric: any) {
  reportWebVitals(metric);
}

export default function App({ Component, pageProps }: AppProps) {
  // 监控 Web Vitals
  if (typeof window !== 'undefined') {
    getCLS(reportWebVitals);
    getFID(reportWebVitals);
    getFCP(reportWebVitals);
    getLCP(reportWebVitals);
    getTTFB(reportWebVitals);
  }
  
  return <Component {...pageProps} />;
}
```

## 8. 部署配置

### 8.1 Vercel 部署（推荐）

#### 自动部署
```powershell
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录 Vercel
vercel login

# 3. 部署项目
vercel

# 4. 生产环境部署
vercel --prod
```

#### Vercel 环境变量配置
在 Vercel Dashboard 中设置环境变量：
```env
NEXT_PUBLIC_SUPABASE_URL=your_prod_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_prod_anon_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

### 8.2 Netlify 部署

#### 构建配置
```toml
# netlify.toml
[build]
  command = "npm run build && npm run export"
  publish = "out"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### 8.3 Docker 化部署

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### 8.4 GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run linting
        run: npm run lint
      
      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: ${{ secrets.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN }}
      
      - name: Deploy to Vercel
        uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 📋 快速开始清单

✅ **纯前端项目环境搭建流程**：

1. **安装 Node.js**（18.x 或 20.x LTS）
2. **克隆项目代码**：`git clone <repo-url>`
3. **安装依赖**：`npm install`
4. **配置环境变量**：编辑 `.env.local` 文件
5. **设置 Supabase**：创建项目并配置数据库
6. **启动开发**：`npm run dev`
7. **配置 API 密钥**：在应用首次使用向导中设置

🎯 **纯前端架构优势**：
- � **部署简单**：无需后端服务器维护
- � **成本节省**：只需支付 CDN 和云服务费用
- � **快速迭代**：代码更新即时生效
- � **用户隐私**：API 密钥由用户自主管理
- � **PWA 支持**：离线缓存和原生应用体验
- 🌍 **全球访问**：CDN 加速，全球快速访问

纯前端 AI 旅行规划师确保了部署的简单性和运行的高效性！