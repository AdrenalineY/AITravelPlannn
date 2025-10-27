# Supabase 配置指南

## 📋 前置条件

在开始之前,请确保已经:
- ✅ 安装了 Node.js 和 npm
- ✅ 完成了项目依赖安装 (`npm install`)

## 🚀 快速配置步骤

### 第一步: 创建 Supabase 项目

1. 访问 [Supabase 官网](https://supabase.com/)
2. 点击 "Start your project" 注册/登录账号
3. 点击 "New Project" 创建新项目
4. 填写项目信息:
   - **Name**: `AITravelPlanner` (或你喜欢的名字)
   - **Database Password**: 设置一个强密码(务必保存!)
   - **Region**: 选择 `Northeast Asia (Tokyo)` 或离你最近的区域
   - **Pricing Plan**: 选择 `Free` 计划(足够开发使用)
5. 点击 "Create new project",等待 1-2 分钟初始化完成

### 第二步: 获取 API 凭证

1. 项目创建完成后,进入项目主页
2. 点击左侧菜单栏的 **⚙️ Settings** (设置)
3. 选择 **API** 选项卡
4. 在 "Project API keys" 部分找到:
   - **Project URL**: 类似 `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public**: 一长串公钥(以 `eyJ` 开头)

### 第三步: 配置环境变量

1. 打开项目根目录的 `.env.local` 文件
2. 替换占位符为你的实际值:

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co  # 👈 替换这里
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...你的完整密钥...  # 👈 替换这里

# Mapbox Token (暂时可以先不配置,地图功能在 Phase 2)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token
```

**⚠️ 注意事项:**
- 不要在 `.env.local` 文件中加引号
- 确保密钥完整复制,不要有多余空格
- `.env.local` 文件已在 `.gitignore` 中,不会被提交到 Git

### 第四步: 创建数据库表

1. 在 Supabase 项目主页,点击左侧 **🗄️ SQL Editor**
2. 点击 "New query" 创建新查询
3. 复制以下 SQL 脚本并执行:

```sql
-- 创建用户配置表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 创建 API 配置表
CREATE TABLE IF NOT EXISTS user_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  llm_provider TEXT,
  llm_api_key TEXT,
  llm_model TEXT,
  speech_provider TEXT,
  speech_api_key TEXT,
  speech_app_id TEXT,
  map_provider TEXT,
  map_api_key TEXT,
  config_status TEXT DEFAULT 'incomplete',
  encrypted_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id)
);

-- 创建行级安全策略 (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- Profiles 表的 RLS 策略
CREATE POLICY "用户可以查看自己的资料" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "用户可以更新自己的资料" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "用户可以插入自己的资料" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User Configs 表的 RLS 策略
CREATE POLICY "用户可以查看自己的配置" ON user_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的配置" ON user_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "用户可以插入自己的配置" ON user_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为两个表添加自动更新时间戳触发器
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_configs_updated_at
  BEFORE UPDATE ON user_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

4. 点击 "Run" 执行脚本
5. 确认输出显示 "Success. No rows returned"

### 第五步: 配置邮箱认证 (可选但推荐)

**默认配置 (仅用于开发测试):**
- Supabase 免费计划默认使用 `@supabase.co` 邮箱发送验证邮件
- 可能会被邮件服务商标记为垃圾邮件
- 适合本地开发测试

**自定义邮箱配置 (生产环境推荐):**
1. 进入 Supabase 项目 **⚙️ Settings** → **Authentication**
2. 在 "SMTP Settings" 部分配置你的邮箱服务器
3. 可以使用 Gmail、QQ 邮箱、阿里云邮件推送等服务

**临时方案 - 关闭邮箱验证 (仅开发环境):**
1. 进入 **⚙️ Settings** → **Authentication**
2. 找到 "Email Auth" 部分
3. 关闭 "Confirm email" 选项
4. 这样注册后无需验证邮箱即可登录

## 🧪 测试配置

### 1. 重启开发服务器

```powershell
# 如果服务器正在运行,先停止 (Ctrl+C)
# 然后重新启动
conda activate aitravelplanner
npm run dev
```

### 2. 验证环境变量加载

服务器启动后,检查终端输出:
- ✅ 不应该看到 "Supabase 未配置" 错误
- ✅ 应该显示 "Ready in X.Xs"

### 3. 测试用户注册

1. 打开浏览器访问 http://localhost:3000
2. 应该自动重定向到 `/auth/login`
3. 切换到 "注册" 标签页
4. 填写注册信息:
   - **邮箱**: 使用真实邮箱(如果开启了邮箱验证)
   - **密码**: 至少 6 位
   - **用户名**: 任意昵称
5. 点击 "注册"
6. 如果配置正确,应该:
   - ✅ 无报错
   - ✅ 自动跳转到 `/setup/api-config` 配置向导页面

### 4. 在 Supabase 后台验证

1. 进入 Supabase 项目主页
2. 点击 **👥 Authentication** (左侧菜单)
3. 在 "Users" 标签页应该看到刚注册的用户
4. 点击 **🗄️ Table Editor**
5. 查看 `profiles` 和 `user_configs` 表,应该有对应的数据记录

## ❌ 常见问题排查

### 问题 1: "Invalid API key" 错误

**原因**: API 密钥复制不完整或有多余字符

**解决方案**:
1. 重新复制 Supabase 后台的 anon key (点击复制按钮确保完整)
2. 检查 `.env.local` 文件,确保密钥前后无空格
3. 重启开发服务器

### 问题 2: "Failed to fetch" 网络错误

**原因**: Supabase 项目 URL 错误或网络连接问题

**解决方案**:
1. 检查 `NEXT_PUBLIC_SUPABASE_URL` 是否正确
2. 确保 URL 格式为 `https://xxxx.supabase.co` (无结尾斜杠)
3. 测试网络连接: 在浏览器访问该 URL + `/rest/v1/`

### 问题 3: "Row level security policy violation" 错误

**原因**: 数据库 RLS 策略未正确配置

**解决方案**:
1. 重新执行第四步的 SQL 脚本
2. 在 Supabase 后台 **Table Editor** → 选择表 → **RLS policies** 检查策略是否存在
3. 确保 `auth.uid()` 函数可用 (Supabase 自带)

### 问题 4: 注册后未收到验证邮件

**解决方案**:
1. 检查垃圾邮件文件夹
2. 使用 Supabase 默认邮箱时,可能延迟 1-5 分钟
3. 临时方案: 关闭邮箱验证(见第五步)
4. 在 Supabase 后台手动验证用户:
   - **Authentication** → **Users** → 选择用户
   - 点击 "..." 菜单 → "Verify email"

### 问题 5: 开发服务器无法读取 .env.local

**解决方案**:
1. 确认 `.env.local` 文件在项目根目录 (与 `package.json` 同级)
2. 文件名正确 (不是 `.env.local.txt` 或其他)
3. **必须重启开发服务器** (Next.js 只在启动时读取环境变量)
4. 检查文件编码为 UTF-8

## 📚 相关文档

- [Supabase 官方文档](https://supabase.com/docs)
- [Next.js 环境变量配置](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [项目快速启动指南](./QUICK_START.md)

## 🎉 配置完成!

配置成功后,你就可以:
- ✅ 完整测试用户注册、登录、密码重置流程
- ✅ 测试 API 配置向导功能
- ✅ 开始 Phase 2 开发 (地图导航和行程规划模块)

如有问题,请参考 [常见问题排查](#-常见问题排查) 或查看终端错误日志。
