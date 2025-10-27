# 纯前端 AI 旅行规划师技术设计方案（基于开发阶段编排）

## 1. 系统架构文字描述
- 前端应用使用 Next.js 14 构建单页面应用，所有业务逻辑、状态管理及 API 调用均在浏览器端完成。
- 状态管理层基于 Zustand 维护跨页面的认证状态、配置状态、行程数据及语音录制状态，结合 React Query 管理远程数据缓存与请求生命周期。
- 数据与身份相关能力完全由 Supabase 提供：Supabase Auth 负责登录注册、会话管理；Supabase Database/Storage 持久化用户、配置、行程及费用数据。
- 外部第三方服务通过前端直连方式调用：大语言模型（阿里云百炼/OpenAI 等）生成行程，语音服务（科大讯飞等）完成语音转写，地图服务（高德地图）提供地理能力，汇率服务负责货币转换。
- 浏览器原生能力（Web Crypto、IndexedDB、Web Audio、Service Worker）用于本地加密存储 API 密钥、离线缓存静态资源以及录音处理。
- 安全策略：所有敏感密钥仅存于本地加密存储，调用第三方 API 时通过 HTTPS 直接请求，对关键请求增加重试与降级策略。

## 2. 模块划分与依赖关系（按开发阶段）
### 第一阶段（P0）
- **M1 用户认证模块**：依赖 Supabase Auth；为后续模块提供 `userSession`、`userProfile`、`configStatus` 等上下文。
- **M6 API 配置模块**：依赖 M1 提供的用户身份；写入 Supabase `user_configs` 表及本地加密存储；其他业务模块在运行前需先检查配置完整性。
- **用户流程集成**：Next.js 中间件与 `AuthGuard` 组件依赖 M1/M6 状态，控制路由跳转与访问权限。

### 第二阶段（P1）
- **M4 地图导航模块**：依赖 M6（地图 API 密钥）；为 M2 行程规划提供 POI、路线数据及地图渲染能力。
- **M2 行程规划模块**：依赖 M1（用户）、M6（LLM 配置）、M4（位置信息）；负责行程生成、编辑与持久化。
- **主界面布局集成**：Dashboard 将 M2、M4 UI 组合，依赖认证守卫判定访问权限。

### 第三阶段（P2）
- **M3 语音交互模块**：依赖 M6（语音 API 密钥）、M2（行程上下文），向 M2、M5 提供语音转写与意图数据。
- **M5 费用管理模块**：依赖 M1（用户）、M2（行程 ID）、M3（语音记账入口）和汇率 API；负责预算与费用分析。
- **功能完善**：离线缓存、导入导出、错误处理等横切能力依赖前述所有模块的状态。

### 第四阶段（P3）
- **测试与部署**：端到端测试覆盖上述模块；性能优化依赖 Next.js 构建工具链；部署以 Vercel 为首选平台。

## 3. 数据库与数据存储设计
### 3.1 Supabase 数据表
| 表名 | 关键字段 | 描述 |
| --- | --- | --- |
| `profiles` | `id (uuid, PK)`, `email`, `display_name`, `avatar_url`, `locale`, `currency`, `created_at`, `updated_at` | 用户扩展资料，`id` 与 Supabase `auth.users` 对应 |
| `user_configs` | `user_id (FK)`, `llm_provider`, `llm_api_key_encrypted`, `speech_provider`, `speech_api_key_encrypted`, `map_provider`, `map_api_key`, `has_completed_setup`, `updated_at` | API 配置存储，密钥字段使用 AES-GCM 加密后存储 |
| `preferences` | `user_id (FK)`, `travel_style`, `companions`, `budget_min`, `budget_max`, `interest_tags[]`, `updated_at` | 偏好设置 |
| `itineraries` | `id (uuid PK)`, `user_id (FK)`, `title`, `destination`, `start_date`, `end_date`, `travelers`, `budget`, `status`, `created_at`, `updated_at` | 行程基本信息 |
| `itinerary_days` | `id (uuid PK)`, `itinerary_id (FK)`, `date`, `summary`, `total_cost`, `created_at` | 行程日程汇总 |
| `itinerary_activities` | `id (uuid PK)`, `day_id (FK)`, `order`, `time`, `poi_id`, `poi_name`, `address`, `notes`, `cost` | 活动安排 |
| `expenses` | `id (uuid PK)`, `itinerary_id (FK)`, `category`, `amount`, `currency`, `description`, `occurred_at`, `location`, `receipt_url` | 费用记录 |
| `voice_logs` | `id (uuid PK)`, `user_id`, `itinerary_id`, `action`, `transcript`, `confidence`, `audio_url`, `created_at` | 语音交互日志 |

### 3.2 本地存储
- **IndexedDB `ai-travel-planner`**：缓存行程列表、地图离线瓦片、最近的聊天上下文，提升离线体验。
- **localStorage (加密封装)**：存放对称加密密钥的密文、UI 偏好（主题、布局比例）。
- **Service Worker Cache**：缓存静态资源与 Mapbox 样式文件，实现 PWA 功能。

### 3.3 加密策略
1. 使用 Web Crypto `crypto.subtle.generateKey` 生成 per-user 对称密钥，并以用户密码派生密钥 (PBKDF2) 加密后存储在 localStorage。
2. API 密钥字段先本地加密再写入 `user_configs` 表，读取时在客户端解密。

## 4. 细粒度 API 接口定义（按模块）
### 4.1 M1 用户认证模块
| 接口 | 方法 | 请求体 | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| `POST https://{project}.supabase.co/auth/v1/signup` | POST | `{ email, password, data: { display_name } }` | `{ user, session }` | Supabase 原生注册接口 |
| `POST https://{project}.supabase.co/auth/v1/token?grant_type=password` | POST | `{ email, password }` | `{ access_token, refresh_token, user }` | 邮箱密码登录 |
| `POST https://{project}.supabase.co/auth/v1/token?grant_type=refresh_token` | POST | `{ refresh_token }` | `{ access_token, refresh_token }` | 刷新令牌 |
| `POST https://{project}.supabase.co/auth/v1/recover` | POST | `{ email }` | `204 No Content` | 发送重置邮件 |
| `GET https://{project}.supabase.co/rest/v1/user_configs?select=is_complete&user_id=eq.{uid}` | GET | Header: `apikey`, `Authorization: Bearer {token}` | `[ { is_complete } ]` | 登录后检查配置状态 |

### 4.2 M6 API 配置模块
| 接口 | 方法 | 请求体 | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| `PATCH https://{project}.supabase.co/rest/v1/user_configs?user_id=eq.{uid}` | PATCH | `{ llm_provider, llm_api_key_encrypted, ... }` | `[ { updated_at } ]` | 保存配置 |
| `GET https://{project}.supabase.co/rest/v1/user_configs?user_id=eq.{uid}` | GET | - | `[ { ...config } ]` | 读取配置 |
| `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation` | POST | `{ model, input }` | `{ output, usage }` | 验证 LLM 密钥（示例使用阿里云百炼） |
| `GET https://restapi.amap.com/v3/config/district?key={key}&keywords=beijing` | GET | - | `{ status, info }` | 验证地图密钥 |
| `POST https://iat-api.xfyun.cn/v2/iat` | POST | 音频/签名 | `{ code, data }` | 验证语音密钥 |

### 4.3 M4 地图导航模块
| 接口 | 方法 | 请求体 | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| `GET https://restapi.amap.com/v3/place/text` | GET | `keywords`, `city`, `key` | `{ pois[] }` | POI 搜索 |
| `GET https://restapi.amap.com/v3/direction/driving` | GET | `origin`, `destination`, `strategy`, `key` | `{ route: { paths[] } }` | 路线规划 |
| `GET https://api.mapbox.com/styles/v1/{style}/tiles/{z}/{x}/{y}?access_token={token}` | GET | - | 瓦片图像 | 地图渲染资源 |

### 4.4 M2 行程规划模块
| 接口 | 方法 | 请求体 | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| `POST https://{project}.supabase.co/rest/v1/itineraries` | POST | `{ user_id, title, ... }` | `{ id, created_at }` | 创建行程 |
| `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation` | POST | `{ model, input: { prompt, context } }` | `{ output, usage }` | 生成行程草案 |
| `PATCH https://{project}.supabase.co/rest/v1/itinerary_days?id=eq.{dayId}` | PATCH | `{ total_cost, summary }` | `[ { ... } ]` | 更新日程 |
| `POST https://{project}.supabase.co/storage/v1/object/itinerary/{id}/exports` | POST | 二进制文件 | `{ Key }` | 导出行程 PDF/JSON 上传 |

### 4.5 M3 语音交互模块
| 接口 | 方法 | 请求体 | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| `POST https://iat-api.xfyun.cn/v2/iat` | POST | 音频数据 + 鉴权头 | `{ data: { result: transcript } }` | 语音转写 |
| `POST https://{project}.supabase.co/storage/v1/object/voice/{uuid}.webm` | POST | WebM 音频 | `{ Key, url }` | 上传语音记录 |
| `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-multimodal` | POST | `{ prompt, attachments }` | `{ output }` | 语音指令二次理解（可选） |

### 4.6 M5 费用管理模块
| 接口 | 方法 | 请求体 | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| `POST https://{project}.supabase.co/rest/v1/expenses` | POST | `{ itinerary_id, category, amount, currency, ... }` | `{ id }` | 创建费用 |
| `GET https://{project}.supabase.co/rest/v1/expenses?itinerary_id=eq.{id}` | GET | - | `[ { ... } ]` | 查询费用 |
| `GET https://v6.exchangerate-api.com/v6/{key}/pair/{from}/{to}/{amount}` | GET | - | `{ conversion_result }` | 汇率转换 |
| `GET https://{project}.supabase.co/rest/v1/rpc/get_expense_analytics` | POST | `{ itinerary_id }` | `{ totals_by_category, daily_spend }` | 费用统计（Supabase RPC） |

## 5. 前端组件结构
### 第一阶段
- **页面 `pages/auth/login.tsx`**
  - 表单字段：`email`, `password`
  - Zustand 状态：`auth.isLoading`, `auth.error`
  - 副作用：成功登录后触发 `redirectAfterAuth`
- **组件 `components/AuthGuard.tsx`**
  - Props：`requiredConfig?: boolean`
  - 状态来源：`useAuthStore`
  - 逻辑：检查会话与配置状态，必要时重定向
- **页面 `pages/setup/api-config.tsx`**
  - 表单步骤：admin -> LLM -> Speech -> Map
  - 字段：`llm.provider`, `llm.apiKey`, `speech.provider`, `speech.apiKey`, `map.apiKey`
  - 本地状态：`currentStep`, `validationResult`
  - 持久化：提交时调用 Supabase + Web Crypto

### 第二阶段
- **页面 `pages/dashboard/index.tsx`**
  - 状态：`layout.mapWidth`, `selectedItinerary`, `chatSessions`
  - 组件树：
    - `MapPanel`（依赖 `useMapStore`）
    - `ChatPanel`（依赖 `useChatStore`）
    - `ResizableDivider`
- **组件 `MapPanel`**
  - 子组件：`MapContainer`, `ItineraryRouteLayer`, `POISearchBar`, `TimelineFloatingPanel`
  - 状态：`map.zoom`, `map.center`, `map.selectedPOI`
- **组件 `ChatPanel`**
  - 子组件：`ChatHistory`, `MessageComposer`, `QuickActions`, `ItineraryCard`
  - 状态：`chat.messages`, `chat.isStreaming`, `chat.audioMode`

### 第三阶段
- **组件 `VoiceRecorder`**
  - 状态：`voice.isRecording`, `voice.levelMeter`
  - 行为：开始录音 -> `MediaRecorder` -> 保存 Blob -> 调用语音 API
- **组件 `ExpenseRecorder`**
  - 字段：`amount`, `category`, `currency`, `description`, `occurredAt`
  - 状态：`expenseForm.isSubmitting`, `expenseForm.errors`
  - 语音入口：`VoiceCommandSheet`
- **组件 `PreferenceModal`**（`components/PreferenceModal.tsx`）
  - 字段：`travelStyle`, `companions`, `budgetRange`, `interests` (Tag selector)
  - 状态：`preferencesStore.draft`, `preferencesStore.isSaving`

### 第四阶段
- **页面 `pages/settings/system-check.tsx`**（可选）
  - 功能：设备兼容检查、缓存清理、日志上传
  - 状态：`systemCheck.results`

## 6. 验收标准（量化条件）
### M1 用户认证
- 输入有效邮箱/密码注册后，`profiles` 表能在 2s 内生成对应记录。
- 用户首次登录后，若 `user_configs.has_completed_setup=false`，在 1s 内跳转 `pages/setup/api-config`。
- 会话过期后刷新页面，系统在 3s 内自动刷新令牌或跳转登录。

### M6 API 配置
- 用户在配置向导中填写已启用的 LLM API 密钥，点击“验证”后 5s 内返回状态且 UI 显示成功/失败。
- 完成全部步骤并保存后，`user_configs.has_completed_setup` 更新为 true，Dashboard 再次访问时不再出现配置提示。
- 本地刷新页面后，配置向导能在 500ms 内从 Supabase 拉取配置并解密填充表单。

### M4 地图导航
- 在 Dashboard 搜索“北京故宫”，POI 列表需在 3s 内出现至少 5 条结果。
- 选择任意两个 POI 请求驾车路线，路线应在 2s 内绘制且包含距离与时长信息。
- 离线模式（断网）下再次进入地图，缓存瓦片能在 1s 内加载最近查看的地图区域。

### M2 行程规划
- 用户输入“5 月 1 日上海三日游”请求生成行程，系统需在 10s 内返回包含至少 3 天活动的草案。
- 编辑任一行程活动，保存后 `itinerary_activities` 表对应记录在 1s 内更新且 UI 同步。
- 导出行程 PDF 后，Supabase Storage 中生成文件大小不超过 5MB，下载链接可在 30 分钟内访问。

### M3 语音交互
- 点击录音 15 秒内上传识别，识别结果需在 7s 内返回文本，准确率达 90%（与预先标注对比）。
- 语音指令“为当前行程添加 200 元餐饮费用”触发后，系统需在 5s 内转写并自动打开费用表单带入字段。
- 每次语音交互均生成 `voice_logs` 记录，字段完整率 100%。

### M5 费用管理
- 添加费用后，总费用统计图表需在 1s 内更新当前类别的累计金额。
- 输入金额 100 USD，选择转换为 CNY，接口返回结果与第三方汇率误差不超过 2%。
- 当行程总费用超过预算 10% 时，系统需在 Dashboard 首页显示红色警告提示。

### 测试与部署
- Lighthouse PWA 分数 ≥ 85，性能分数 ≥ 80。
- 单元测试/组件测试覆盖率：语音模块 ≥ 70%，核心模块总体 ≥ 60%。
- Vercel 部署成功后，冷启动首屏加载（首次访问）时间 ≤ 4s（网络：4G）。
