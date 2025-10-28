# AI 旅行规划师 - 项目结构与开发进度概述

> **更新时间**: 2025年10月28日  
> **项目版本**: v2.1.0 (纯高德地图架构)  
> **技术栈**: Next.js 14 + React 18 + TypeScript + Supabase + Ant Design

---

## 📊 整体开发进度

### 🟢 已完成模块 (95%)
- ✅ 用户认证系统
- ✅ API 配置管理（含三 Key 架构）
- ✅ 地图服务集成（纯高德方案）
- ✅ 数据库设计与 RLS 安全策略
- ✅ 状态管理（Zustand）
- ✅ 加密存储系统
- ✅ 基础 UI 组件

### 🟡 开发中模块 (50%)
- 🔄 AI 行程规划服务
- 🔄 行程管理功能
- 🔄 聊天交互界面

### 🔴 待开发模块 (0%)
- ❌ 语音交互功能
- ❌ 费用管理模块
- ❌ 数据可视化组件

---

## 📁 目录结构详解

### 1. `/app` - Next.js 应用目录

```
app/
├── globals.css          # 全局样式
├── layout.tsx          # 根布局组件
├── page.tsx            # 首页
├── api/                # API 路由
│   └── validate/       # 验证接口
│       ├── llm/        # LLM API 验证
│       ├── map/        # 地图 API 验证
│       └── speech/     # 语音 API 验证
├── auth/               # 认证页面
│   └── login/          # 登录页面
├── dashboard/          # 主应用页面
│   └── page.tsx        # 仪表板
└── setup/              # 配置向导
    └── api-config/     # API 配置页面
        └── page.tsx
```

#### API 接口详情

| 接口路径 | 方法 | 功能 | 状态 |
|---------|------|------|------|
| `/api/validate/llm` | POST | 验证 LLM API 密钥有效性 | ✅ 完成 |
| `/api/validate/map` | POST | 验证地图 API 密钥有效性 | ✅ 完成 |
| `/api/validate/speech` | POST | 验证语音 API 密钥有效性 | ✅ 完成 |

**接口规格示例** (`/api/validate/map`):
```typescript
// 请求体
{
  provider: 'amap' | 'baidu',
  apiKey: string
}

// 响应体
{
  success: boolean,
  error?: string,
  errorCode?: string
}
```

### 2. `/components` - React 组件库

```
components/
├── chat/               # 聊天相关组件
│   ├── MessageInput.tsx    # 消息输入框
│   ├── MessageList.tsx     # 消息列表
│   └── QuickActions.tsx    # 快捷操作
├── itinerary/          # 行程相关组件
│   ├── DayPlanCard.tsx     # 日程卡片
│   └── ItineraryViewer.tsx # 行程查看器
└── map/                # 地图相关组件
    ├── MapContainer.tsx    # 地图容器
    └── POISearch.tsx       # POI 搜索
```

#### 组件开发状态

| 组件名 | 功能描述 | 开发状态 | 依赖状态 |
|--------|----------|----------|----------|
| `MapContainer` | 高德地图集成，支持安全密钥 | ✅ 完成 | 依赖配置服务 |
| `POISearch` | POI 搜索和标记 | 🔄 开发中 | 依赖地图服务 |
| `MessageInput` | 聊天输入组件 | 🔄 开发中 | 依赖 AI 服务 |
| `MessageList` | 消息展示列表 | 🔄 开发中 | 依赖聊天状态 |
| `DayPlanCard` | 单日行程卡片 | 🔄 开发中 | 依赖行程服务 |
| `ItineraryViewer` | 完整行程查看器 | 🔄 开发中 | 依赖行程服务 |

### 3. `/services` - 业务逻辑层

```
services/
├── aiService.ts         # AI 对话和行程生成
├── authService.ts       # 用户认证服务
├── configService.ts     # 配置管理服务
├── itineraryService.ts  # 行程管理服务
└── mapService.ts        # 地图服务集成
```

#### 服务接口详情

##### `ConfigService` - 配置管理 ✅
| 方法 | 功能 | 状态 |
|------|------|------|
| `saveConfig(userId, config)` | 保存用户 API 配置 | ✅ |
| `loadConfig(userId)` | 加载用户配置 | ✅ |
| `validateConfig(config)` | 验证配置完整性 | ✅ |
| `getConfigProgress(userId)` | 获取配置进度 | ✅ |

**特色功能**:
- 🔐 AES 加密存储所有 API 密钥
- 🔧 支持高德地图三 Key 架构 (webServiceKey + jsApiKey + securityCode)
- ✅ 实时验证 API 密钥有效性

##### `MapService` - 地图服务 🔄
| 方法 | 功能 | 状态 |
|------|------|------|
| `searchPOI(query, location?, city?)` | POI 搜索 | 🔄 |
| `getPOIDetail(id)` | 获取 POI 详情 | 🔄 |
| `planRoute(from, to, mode)` | 路线规划 | 🔄 |
| `geocode(address, city?)` | 地理编码 | 🔄 |
| `reverseGeocode(location)` | 逆地理编码 | 🔄 |

##### `AIService` - AI 服务 🔄
| 方法 | 功能 | 状态 |
|------|------|------|
| `generateItinerary(requirements)` | AI 生成行程 | 🔄 |
| `optimizeItinerary(itinerary, feedback)` | 优化行程 | 🔄 |
| `chatWithAI(message, context)` | AI 对话 | 🔄 |

**支持的 AI 提供商**:
- 阿里云百炼 (通义千问)
- OpenAI (GPT 系列)

##### `ItineraryService` - 行程管理 🔄
| 方法 | 功能 | 状态 |
|------|------|------|
| `saveItinerary(itinerary)` | 保存行程 | 🔄 |
| `loadItineraries(userId)` | 加载用户行程列表 | 🔄 |
| `loadItinerary(itineraryId)` | 加载单个行程 | 🔄 |
| `updateItinerary(id, updates)` | 更新行程 | 🔄 |
| `deleteItinerary(id)` | 删除行程 | 🔄 |
| `addActivity(dayId, activity)` | 添加活动 | 🔄 |
| `updateActivity(id, updates)` | 更新活动 | 🔄 |
| `deleteActivity(id)` | 删除活动 | 🔄 |

##### `AuthService` - 认证服务 ✅
基于 Supabase Auth，支持邮箱密码认证和会话管理。

### 4. `/store` - 状态管理 (Zustand)

```
store/
├── authStore.ts         # 用户认证状态
├── configStore.ts       # 配置状态管理
├── itineraryStore.ts    # 行程状态管理
└── mapStore.ts          # 地图状态管理
```

#### 状态管理详情

| Store | 主要状态 | 功能 | 状态 |
|-------|----------|------|------|
| `authStore` | `user`, `isAuthenticated` | 用户登录状态管理 | ✅ |
| `configStore` | `config`, `progress`, `validationResults` | API 配置状态管理 | ✅ |
| `itineraryStore` | `itineraries`, `currentItinerary` | 行程状态管理 | 🔄 |
| `mapStore` | `center`, `zoom`, `markers` | 地图状态管理 | 🔄 |

### 5. `/types` - TypeScript 类型定义

```typescript
// 核心数据类型
export interface APIConfig {
  llm: {
    provider: 'aliyun' | 'openai' | 'baidu'
    apiKey: string
    baseUrl?: string
    model?: string
  }
  speech: {
    provider: 'xunfei' | 'baidu' | 'aliyun'
    apiKey: string
    appId?: string
    apiSecret?: string
  }
  map: {
    provider: 'amap' | 'baidu'
    webServiceKey: string     // Web服务 API Key
    jsApiKey: string          // JS API Key
    securityCode?: string     // 安全密钥 (可选)
  }
}

export interface Itinerary {
  id: string
  userId: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  days: DayPlan[]
  status: 'draft' | 'confirmed' | 'completed'
}
```

**完整类型定义** (245 行):
- ✅ 用户相关类型 (User, UserProfile)
- ✅ API 配置类型 (APIConfig, ConfigStatus)
- ✅ 行程相关类型 (Itinerary, DayPlan, Activity)
- ✅ 地图相关类型 (POI, Location, Route)
- ✅ 语音相关类型 (TranscriptionResult, VoiceIntent)
- ✅ 费用相关类型 (Budget, Expense, ExpenseAnalytics)

### 6. `/lib` - 工具库

```
lib/
├── crypto.ts            # 加密解密工具
└── supabase/           # Supabase 客户端
    ├── client.ts        # 浏览器端客户端
    └── server.ts        # 服务端客户端
```

#### 核心工具功能

##### `crypto.ts` - 加密工具 ✅
- **AES-GCM 加密**: 使用 Web Crypto API
- **密钥派生**: PBKDF2 + SHA-256
- **简单加密接口**: `simpleEncrypt()`, `simpleDecrypt()`
- **安全性**: 100,000 次迭代 + 随机盐

##### `supabase/client.ts` - 数据库客户端 ✅
- **自动错误检测**: 未配置 Supabase 时友好提示
- **环境变量验证**: 检测占位符配置
- **SSR 支持**: 兼容服务端渲染

### 7. `/supabase` - 数据库

```
supabase/migrations/
├── 02_itinerary_tables.sql      # 行程表结构
├── 03_update_map_keys.sql       # 地图密钥更新
├── init_user_configs_table.sql  # 用户配置表
├── reset_and_init_all_tables.sql # 完整重置脚本 ⭐
└── ...其他迁移文件
```

#### 数据库架构 ✅

##### 核心表结构

**`user_configs`** - 用户配置表:
```sql
- user_id (UUID, 主键)
- llm_provider, llm_api_key_encrypted
- speech_provider, speech_api_key_encrypted  
- map_provider, map_web_service_key_encrypted
- map_js_api_key_encrypted, map_security_code_encrypted
- has_completed_setup (BOOLEAN)
```

**`itineraries`** - 行程主表:
```sql
- id (UUID, 主键)
- user_id, title, destination
- start_date, end_date, travelers, budget
- status ('draft' | 'confirmed' | 'completed')
```

**`itinerary_days`** - 日程表:
```sql
- id (UUID, 主键)  
- itinerary_id, date, summary, total_cost
```

**`itinerary_activities`** - 活动表:
```sql
- id (UUID, 主键)
- day_id, order, time, poi_name
- location_lng, location_lat, cost
```

##### 安全特性 ✅
- **RLS (行级安全)**: 用户只能访问自己的数据
- **级联删除**: 保证数据一致性
- **加密存储**: 所有 API 密钥 AES 加密
- **自动时间戳**: 创建和更新时间自动维护

### 8. `/docs` - 项目文档

```
docs/
├── requirement_specification.md     # 需求规格书
├── technical_design_specification.md # 技术设计
├── frontend_interface_specification.md # UI 规格
├── SUPABASE_SETUP.md               # 数据库配置指南
├── MAP_MIGRATION_GUIDE.md          # 地图迁移指南
├── MAP_KEY_VALIDATION_STRATEGY.md  # 密钥验证策略
├── AMAP_SECURITY_CODE_GUIDE.md     # 安全密钥指南
└── ...其他技术文档
```

### 9. `/scripts` - 自动化脚本

```
scripts/
└── install-phase2-deps.ps1         # Phase 2 依赖安装脚本
```

---

## 🔧 技术架构

### 前端技术栈
- **框架**: Next.js 14 (App Router)
- **UI 库**: React 18 + Ant Design 5 + Tailwind CSS
- **语言**: TypeScript 5.9
- **状态管理**: Zustand 5.0
- **构建工具**: 内置 Turbopack

### 后端服务
- **数据库**: Supabase (PostgreSQL 14+)
- **认证**: Supabase Auth
- **存储**: Supabase Storage (未使用)
- **实时**: Supabase Realtime (计划中)

### 第三方集成
- **地图服务**: 高德地图 (纯方案)
  - Web服务 API: POI 搜索、路线规划、地理编码
  - JS API: 前端地图显示、交互
  - 安全密钥: API 防盗用
- **AI 服务**: 阿里云百炼 / OpenAI
- **语音服务**: 科大讯飞 / 阿里云 (计划中)

---

## 📈 开发里程碑

### Phase 1: 基础架构 ✅ (已完成)
- [x] 项目初始化和技术栈配置
- [x] 用户认证系统 (Supabase Auth)
- [x] API 配置管理 (加密存储)
- [x] 基础 UI 组件和路由
- [x] 数据库设计和 RLS 策略

### Phase 2: 地图集成 ✅ (已完成) 
- [x] 高德地图集成 (双 Key → 三 Key 架构)
- [x] POI 搜索和地理编码服务
- [x] 地图组件和交互功能
- [x] 配置验证策略优化
- [x] 安全密钥支持

### Phase 3: AI 与行程 🔄 (开发中)
- [ ] AI 服务集成 (LLM 对话)
- [ ] 行程生成和优化算法
- [ ] 聊天界面和交互逻辑
- [ ] 行程管理 CRUD 操作
- [ ] 数据可视化组件

### Phase 4: 语音与高级功能 ❌ (计划中)
- [ ] 语音识别和合成集成
- [ ] 语音指令处理
- [ ] 费用管理和记账功能
- [ ] 数据分析和报表
- [ ] 离线功能和 PWA

---

## 🚀 快速启动

### 环境要求
- Node.js 18+
- npm 或 yarn
- Supabase 项目

### 启动步骤
```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量 (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 3. 运行数据库迁移
# 在 Supabase Dashboard 中执行 reset_and_init_all_tables.sql

# 4. 启动开发服务器
npm run dev
```

### 首次使用
1. 访问 http://localhost:3000
2. 注册/登录用户账号
3. 完成 API 配置向导 (/setup/api-config)
4. 开始使用旅行规划功能

---

## ⚠️ 已知问题与注意事项

### 配置相关
- **地图 Key 验证**: JS API Key 无法在后端验证，仅在前端地图加载时验证
- **安全密钥**: 可选但推荐配置，需与高德控制台设置保持一致
- **API 配额**: 注意各服务提供商的免费配额限制

### 开发相关
- **Supabase 配置**: 必须正确配置环境变量，否则应用无法启动
- **数据库迁移**: 建议使用 `reset_and_init_all_tables.sql` 进行完整重置
- **类型安全**: 严格的 TypeScript 类型检查，确保数据一致性

### 部署相关
- **环境变量**: 生产环境需配置完整的环境变量
- **HTTPS**: 地图和语音服务要求 HTTPS 环境
- **CORS**: 确保 API 域名在各服务提供商白名单中

---

## 📞 技术支持

### 文档参考
- [需求规格书](./requirement_specification.md) - 完整功能需求
- [技术设计](./technical_design_specification.md) - 架构设计详情
- [UI 规格](./frontend_interface_specification.md) - 界面设计规范

### 配置指南
- [Supabase 配置](./SUPABASE_SETUP.md) - 数据库配置步骤
- [地图配置](./AMAP_SECURITY_CODE_GUIDE.md) - 高德地图配置详解
- [密钥验证策略](./MAP_KEY_VALIDATION_STRATEGY.md) - API 验证机制

---

*最后更新: 2025年10月28日*