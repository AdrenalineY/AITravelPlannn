# CORS 错误修复说明

## 问题描述

在 API 配置向导中填写阿里云 DashScope API Key 后验证失败,浏览器报错:

```
OPTIONS https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
Status: 403 Forbidden
```

## 根本原因

**CORS(跨域资源共享)策略限制**

1. 浏览器的同源策略阻止从 `http://localhost:3000` 直接访问 `https://dashscope.aliyuncs.com`
2. 第三方 API(阿里云、高德地图等)通常不允许直接从浏览器调用,出于安全考虑
3. 浏览器会先发送 OPTIONS 预检请求,但阿里云返回 403,导致实际的 POST 请求被阻止

## 解决方案

### 架构调整: 使用 Next.js API Routes 作为后端代理

```
Before (直接调用,CORS 错误):
浏览器 ──❌──> 阿里云 API
       (CORS Blocked)

After (通过后端代理):
浏览器 ──✅──> Next.js API Route ──✅──> 阿里云 API
       (同源)        (服务端请求,无CORS限制)
```

### 实施的修复

#### 1. 创建 API 验证代理端点

- **`/app/api/validate/llm/route.ts`**: LLM API 验证(阿里云、OpenAI)
- **`/app/api/validate/speech/route.ts`**: 语音 API 验证(讯飞、阿里云)
- **`/app/api/validate/map/route.ts`**: 地图 API 验证(高德、Mapbox)

#### 2. 修改 configService.ts

将直接调用第三方 API 改为调用本地 API Routes:

```typescript
// 修改前:直接调用第三方 API (CORS 错误)
const response = await fetch('https://dashscope.aliyuncs.com/...', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  ...
})

// 修改后:调用本地 API Route (无 CORS 问题)
const response = await fetch('/api/validate/llm', {
  method: 'POST',
  body: JSON.stringify({ provider, apiKey, baseUrl, model }),
})
```

## 技术细节

### API Route 实现特点

1. **服务端执行**: Next.js API Routes 运行在 Node.js 服务器,不受浏览器 CORS 限制
2. **统一错误处理**: 标准化返回格式 `{ success: boolean, message?: string, error?: string }`
3. **安全性**: API Key 通过 POST body 传递,不暴露在 URL 中
4. **多提供商支持**: 同时支持阿里云、OpenAI、高德、Mapbox 等多个服务商

### 阿里云 DashScope 验证逻辑

```typescript
// 发送测试请求
const response = await fetch('https://dashscope.aliyuncs.com/...', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: testModel,
    input: { messages: [{ role: 'user', content: 'test' }] },
    parameters: { max_tokens: 10 },
  }),
})

// 判断结果
if (response.ok || data.output) {
  return { success: true }
} else if (response.status === 429) {
  return { success: true, message: '限流但密钥有效' }
} else if (response.status === 401 || 403) {
  return { success: false, error: 'API Key 无效' }
}
```

## 测试步骤

1. **重启开发服务器**
   ```powershell
   npm run dev
   ```

2. **访问配置向导**
   - 浏览器访问 http://localhost:3000/setup/api-config
   - 或从登录页注册新用户自动跳转

3. **填写大语言模型配置**
   - **提供商**: 阿里云百炼
   - **API Key**: 你的 DashScope API Key
   - **Base URL**: `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation`
   - **模型**: `qwen-turbo` 或 `qwen-plus`

4. **点击验证**
   - ✅ 应该看到 "验证中..." 提示
   - ✅ 成功后显示绿色勾号和 "验证成功"
   - ✅ 浏览器控制台输出: `✅ LLM API 验证成功: 验证成功`
   - ❌ 如果失败,会显示具体错误原因

## 预期结果

### 成功场景

- ✅ 无 CORS 错误
- ✅ Network 标签中看到:
  ```
  POST /api/validate/llm 200 OK
  ```
- ✅ 验证通过后可以进行下一步配置

### 失败场景及处理

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| "API Key 无效或已过期" | 密钥错误 | 检查阿里云控制台,重新复制密钥 |
| "API 限流但密钥有效" | 请求过于频繁 | 正常现象,密钥有效,可继续 |
| "网络请求失败" | 服务器网络问题 | 检查网络连接,或稍后重试 |
| "模型不存在" | 模型名称错误 | 使用 `qwen-turbo` 或查看阿里云文档 |

## 相关文件

```
AITravelPlanner/
├── app/api/validate/
│   ├── llm/route.ts          # LLM 验证 API
│   ├── speech/route.ts        # 语音验证 API
│   └── map/route.ts           # 地图验证 API
├── services/
│   └── configService.ts       # 配置服务(已修改)
└── docs/
    ├── CORS_FIX.md            # 本文档
    └── SUPABASE_SETUP.md      # Supabase 配置指南
```

## 后续优化建议

1. **缓存验证结果**: 避免重复验证相同的 API Key
2. **速率限制**: 防止恶意验证尝试
3. **详细错误日志**: 记录验证失败的详细信息
4. **Mock 模式**: 提供离线测试模式

## 常见问题

### Q: 为什么高德地图验证没有 CORS 问题?

A: 高德地图的部分 API(如 /v3/config/district)允许跨域请求,但为了统一架构和安全性,我们仍然通过后端代理。

### Q: 能否绕过验证直接保存配置?

A: 技术上可以,但不推荐。验证可以:
- 提前发现配置错误
- 避免保存无效密钥
- 提升用户体验

### Q: API Route 会增加延迟吗?

A: 会有微小延迟(通常 <50ms),但相比直接调用的好处:
- 解决 CORS 问题
- 统一错误处理
- 保护 API Key 安全
- 可以添加日志和监控

---

**修复完成时间**: 2025年10月27日  
**影响范围**: API 配置向导的所有验证功能  
**测试状态**: ✅ 待验证
