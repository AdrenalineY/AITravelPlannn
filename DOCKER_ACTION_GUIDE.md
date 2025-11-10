# AI 旅行规划师 - Docker 打包与阿里云部署行动指南

## 📋 项目架构总览

### 技术栈
- **前端框架**: Next.js 14 (React 18 + TypeScript)
- **UI 组件库**: Ant Design 5.27 + Tailwind CSS 3.4
- **状态管理**: Zustand 5.0
- **后端服务**: Supabase (数据库 + 认证)
- **地图服务**: Mapbox + 高德地图
- **图表组件**: Recharts 3.3

### Docker 策略
- **构建方式**: 多阶段构建(deps → builder → runner)
- **基础镜像**: Node.js 20 Alpine(轻量级)
- **输出模式**: Standalone(Next.js 优化)
- **镜像大小**: ~150-200MB
- **安全性**: 非 root 用户运行

---

## 🎯 行动检查清单

### ✅ 阶段一: 前置准备

- [ ] **1.1 安装 Docker Desktop**
  - 下载地址: https://www.docker.com/products/docker-desktop
  - 版本要求: 20.10+
  - 启动并验证: `docker --version`

- [ ] **1.2 注册阿里云容器镜像服务**
  - 访问: https://cr.console.aliyun.com/
  - 选择个人版实例(免费)
  - 设置 Registry 登录密码

- [ ] **1.3 创建命名空间和仓库**
  - 命名空间: `travel-planner`
  - 仓库名称: `ai-travel-planner`
  - 仓库类型: 私有
  - 记录仓库地址

- [ ] **1.4 准备环境配置**
  - 复制 `.env.production.example` 为 `.env.production`
  - 填入 Supabase 配置(URL + Anon Key)
  - 填入 Mapbox Token
  - 可选:高德地图配置

---

### ✅ 阶段二: 本地构建与测试

- [ ] **2.1 验证项目文件**
  ```powershell
  # 检查关键文件是否存在
  Test-Path Dockerfile              # 应返回 True
  Test-Path .dockerignore           # 应返回 True
  Test-Path next.config.js          # 应返回 True
  Test-Path .env.production         # 应返回 True
  ```

- [ ] **2.2 构建 Docker 镜像**
  ```powershell
  # 方式 A: 使用脚本(推荐)
  .\docker-build-push.ps1 -Version "v1.0.0" -SkipPush

  # 方式 B: 手动构建
  docker build -t ai-travel-planner:v1.0.0 .
  ```
  - 预计时间: 5-10 分钟
  - 成功标志: "Successfully built" 和 "Successfully tagged"

- [ ] **2.3 本地测试运行**
  ```powershell
  # 启动容器
  docker run -d --name test-app -p 3000:3000 --env-file .env.production ai-travel-planner:v1.0.0

  # 查看日志
  docker logs -f test-app

  # 访问测试
  # 浏览器打开: http://localhost:3000
  ```

- [ ] **2.4 功能验证**
  - [ ] 页面正常加载
  - [ ] 用户登录/注册功能
  - [ ] API 配置功能
  - [ ] 地图显示正常
  - [ ] AI 对话功能

- [ ] **2.5 清理测试容器**
  ```powershell
  docker stop test-app
  docker rm test-app
  ```

---

### ✅ 阶段三: 推送到阿里云

- [ ] **3.1 登录阿里云 Registry**
  ```powershell
  # 替换 [region] 为你的地域,如: cn-hangzhou
  docker login registry.cn-[region].aliyuncs.com
  
  # 输入用户名和密码
  ```
  - 成功标志: "Login Succeeded"

- [ ] **3.2 标记镜像**
  ```powershell
  # 使用脚本
  .\docker-build-push.ps1 -Version "v1.0.0" -Region "cn-hangzhou" -SkipBuild

  # 或手动标记
  docker tag ai-travel-planner:v1.0.0 registry.cn-hangzhou.aliyuncs.com/travel-planner/ai-travel-planner:v1.0.0
  docker tag ai-travel-planner:v1.0.0 registry.cn-hangzhou.aliyuncs.com/travel-planner/ai-travel-planner:latest
  ```

- [ ] **3.3 推送镜像**
  ```powershell
  # 推送指定版本
  docker push registry.cn-hangzhou.aliyuncs.com/travel-planner/ai-travel-planner:v1.0.0

  # 推送最新版本
  docker push registry.cn-hangzhou.aliyuncs.com/travel-planner/ai-travel-planner:latest
  ```
  - 预计时间: 2-5 分钟
  - 成功标志: "Pushed" 和摘要信息

- [ ] **3.4 验证推送成功**
  - 登录阿里云控制台
  - 进入容器镜像服务
  - 查看 `travel-planner/ai-travel-planner` 仓库
  - 确认版本列表中有 `v1.0.0` 和 `latest`

---

### ✅ 阶段四: 远程部署测试

- [ ] **4.1 在其他机器/服务器登录**
  ```powershell
  docker login registry.cn-hangzhou.aliyuncs.com
  ```

- [ ] **4.2 拉取镜像**
  ```powershell
  # 使用脚本
  .\docker-deploy.ps1 -Version "v1.0.0" -Region "cn-hangzhou"

  # 或手动拉取
  docker pull registry.cn-hangzhou.aliyuncs.com/travel-planner/ai-travel-planner:v1.0.0
  ```

- [ ] **4.3 准备环境配置**
  - 在部署机器上创建 `.env.production` 文件
  - 填入生产环境配置
  - 如果是公网部署,更新 `NEXT_PUBLIC_APP_URL`

- [ ] **4.4 运行容器**
  ```powershell
  docker run -d \
    --name ai-travel-planner \
    -p 3000:3000 \
    --env-file .env.production \
    --restart unless-stopped \
    registry.cn-hangzhou.aliyuncs.com/travel-planner/ai-travel-planner:v1.0.0
  ```

- [ ] **4.5 验证部署**
  ```powershell
  # 检查容器状态
  docker ps

  # 查看日志
  docker logs -f ai-travel-planner

  # 访问应用
  # http://localhost:3000 或 http://服务器IP:3000
  ```

---

## 📊 各阶段预计时间

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| **阶段一** | 前置准备 | 30-60 分钟 |
| **阶段二** | 本地构建与测试 | 15-30 分钟 |
| **阶段三** | 推送到阿里云 | 5-10 分钟 |
| **阶段四** | 远程部署测试 | 10-20 分钟 |
| **总计** | | **60-120 分钟** |

---

## 🚀 快速执行路径

如果你已经熟悉 Docker 和阿里云,可以使用以下快速命令:

```powershell
# === 完整流程(一次性执行) ===

# 1. 准备环境
Copy-Item .env.production.example .env.production
# (编辑 .env.production 填入配置)

# 2. 构建并推送(杭州地域)
.\docker-build-push.ps1 -Version "v1.0.0" -Region "cn-hangzhou"

# 3. 部署运行
.\docker-deploy.ps1 -Version "v1.0.0" -Region "cn-hangzhou"

# 4. 访问应用
# http://localhost:3000
```

---

## 📁 项目文件清单

已创建的 Docker 相关文件:

```
AITravelPlanner/
├── Dockerfile                          # Docker 镜像构建文件
├── .dockerignore                       # Docker 构建忽略文件
├── docker-compose.yml                  # Docker Compose 配置
├── .env.production.example             # 生产环境配置模板
├── docker-build-push.ps1               # 自动化构建推送脚本
├── docker-deploy.ps1                   # 自动化部署脚本
├── DOCKER_DEPLOYMENT_GUIDE.md          # 详细部署指南
├── DOCKER_QUICKSTART.md                # 快速上手文档
├── DOCKER_ACTION_GUIDE.md              # 本文件(行动指南)
└── app/api/health/route.ts             # 健康检查端点
```

---

## 🔧 常用命令速查

### Docker 基础命令
```powershell
# 查看镜像
docker images

# 查看容器
docker ps -a

# 查看日志
docker logs -f [容器名]

# 停止容器
docker stop [容器名]

# 删除容器
docker rm [容器名]

# 删除镜像
docker rmi [镜像名:标签]

# 清理无用资源
docker system prune -a
```

### 阿里云命令
```powershell
# 登录
docker login registry.cn-[region].aliyuncs.com

# 标记镜像
docker tag [本地镜像] registry.cn-[region].aliyuncs.com/[命名空间]/[仓库]:[标签]

# 推送镜像
docker push registry.cn-[region].aliyuncs.com/[命名空间]/[仓库]:[标签]

# 拉取镜像
docker pull registry.cn-[region].aliyuncs.com/[命名空间]/[仓库]:[标签]
```

### Docker Compose 命令
```powershell
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart
```

---

## ⚠️ 注意事项

### 安全提醒
1. **不要提交敏感信息**
   - `.env` 文件已在 `.gitignore` 中
   - 不要将密钥硬编码在代码中
   - 使用环境变量管理配置

2. **使用私有仓库**
   - 阿里云镜像仓库设为私有
   - 定期更换 Registry 密码
   - 不要分享登录凭证

3. **镜像版本管理**
   - 使用语义化版本号(v1.0.0)
   - 保留多个历史版本便于回滚
   - `latest` 标签指向最新稳定版本

### 性能优化
1. **使用多阶段构建**: 减小镜像体积
2. **配置 .dockerignore**: 排除不必要的文件
3. **启用 Next.js standalone**: 优化运行时
4. **使用 Alpine 镜像**: 基础镜像更小

### 故障排查
1. **构建失败**: 检查网络连接,考虑使用镜像加速
2. **推送失败**: 验证登录状态和仓库权限
3. **容器启动失败**: 查看日志,验证环境变量
4. **应用无法访问**: 检查端口映射和防火墙规则

---

## 📚 参考文档

### 项目文档
- **详细部署指南**: `DOCKER_DEPLOYMENT_GUIDE.md`
- **快速上手**: `DOCKER_QUICKSTART.md`
- **项目 README**: `README.md`

### 官方文档
- **Docker**: https://docs.docker.com/
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **阿里云容器镜像服务**: https://help.aliyun.com/product/60716.html

### 在线工具
- **Docker Hub**: https://hub.docker.com/
- **阿里云控制台**: https://cr.console.aliyun.com/
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Mapbox Account**: https://account.mapbox.com/

---

## 🎉 完成标志

当你完成所有步骤后,应该达到:

✅ 本地可以成功构建 Docker 镜像  
✅ 镜像已推送到阿里云容器镜像服务  
✅ 可以从阿里云拉取并运行镜像  
✅ 应用在容器中正常运行  
✅ 所有功能正常可用  

---

## 💡 下一步建议

完成 Docker 部署后,你可以:

1. **持续集成/部署(CI/CD)**
   - 使用 GitHub Actions 自动构建
   - 配置自动推送到阿里云
   - 实现自动化测试

2. **生产环境优化**
   - 配置 Nginx 反向代理
   - 启用 HTTPS
   - 配置域名解析
   - 设置监控告警

3. **扩展部署**
   - 使用 Kubernetes 编排
   - 配置负载均衡
   - 实现水平扩展
   - 多区域部署

---

**祝你部署顺利! 🚀**

如有问题,请查阅 `DOCKER_DEPLOYMENT_GUIDE.md` 中的常见问题章节。
