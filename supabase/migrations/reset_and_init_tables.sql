-- ============================================
-- 重置并初始化所有表
-- ⚠️ 警告: 此脚本会删除所有现有数据!
-- 执行前请确保已备份重要数据
-- 执行时间: 2025-10-27
-- ============================================

-- ============================================
-- 步骤 1: 删除现有表 (按依赖关系倒序删除)
-- ============================================

-- 删除 user_configs 表 (依赖于 auth.users)
DROP TABLE IF EXISTS user_configs CASCADE;

-- 删除 profiles 表 (依赖于 auth.users)
DROP TABLE IF EXISTS profiles CASCADE;

-- 注意: auth.users 表由 Supabase Auth 管理,不要删除!

-- ============================================
-- 步骤 2: 创建 profiles 表
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE profiles IS '用户基本信息表';
COMMENT ON COLUMN profiles.id IS '用户ID,关联到 auth.users';
COMMENT ON COLUMN profiles.email IS '用户邮箱';
COMMENT ON COLUMN profiles.full_name IS '用户全名';
COMMENT ON COLUMN profiles.avatar_url IS '头像URL';

-- ============================================
-- 步骤 3: 创建 user_configs 表
-- ============================================

CREATE TABLE user_configs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- LLM 配置
  llm_provider TEXT,
  llm_api_key_encrypted TEXT,
  llm_base_url TEXT,
  llm_model TEXT,
  -- 语音配置
  speech_provider TEXT,
  speech_api_key_encrypted TEXT,
  speech_app_id TEXT,
  speech_api_secret TEXT,
  -- 地图配置
  map_provider TEXT,
  map_api_key TEXT,
  -- 配置状态
  has_completed_setup BOOLEAN DEFAULT FALSE,
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE user_configs IS '用户API配置表,存储加密后的API密钥';
COMMENT ON COLUMN user_configs.user_id IS '用户ID,关联到 auth.users';
COMMENT ON COLUMN user_configs.llm_provider IS 'LLM提供商: aliyun, openai';
COMMENT ON COLUMN user_configs.llm_api_key_encrypted IS '加密后的LLM API密钥';
COMMENT ON COLUMN user_configs.llm_base_url IS 'LLM API基础URL';
COMMENT ON COLUMN user_configs.llm_model IS 'LLM模型名称';
COMMENT ON COLUMN user_configs.speech_provider IS '语音提供商: xunfei, aliyun';
COMMENT ON COLUMN user_configs.speech_api_key_encrypted IS '加密后的语音API密钥';
COMMENT ON COLUMN user_configs.speech_app_id IS '语音应用ID';
COMMENT ON COLUMN user_configs.speech_api_secret IS '语音API Secret';
COMMENT ON COLUMN user_configs.map_provider IS '地图提供商: amap, baidu';
COMMENT ON COLUMN user_configs.map_api_key IS '地图API密钥';
COMMENT ON COLUMN user_configs.has_completed_setup IS '是否已完成初始配置';
COMMENT ON COLUMN user_configs.created_at IS '创建时间';
COMMENT ON COLUMN user_configs.updated_at IS '最后更新时间';

-- ============================================
-- 步骤 4: 创建索引
-- ============================================

-- profiles 表索引
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- user_configs 表索引
CREATE INDEX IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_configs_completed ON user_configs(has_completed_setup);

-- ============================================
-- 步骤 5: 启用 Row Level Security (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 步骤 6: 创建 RLS 策略
-- ============================================

-- profiles 表策略
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- user_configs 表策略
CREATE POLICY "Users can view their own config"
  ON user_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config"
  ON user_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON user_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own config"
  ON user_configs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 步骤 7: 创建触发器函数 (自动更新 updated_at)
-- ============================================

-- 创建或替换触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 profiles 表添加触发器
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 user_configs 表添加触发器
DROP TRIGGER IF EXISTS update_user_configs_updated_at ON user_configs;
CREATE TRIGGER update_user_configs_updated_at
  BEFORE UPDATE ON user_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 步骤 8: 刷新 Schema Cache
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- 完成! 
-- ============================================
-- 执行以下查询验证表结构:
-- SELECT * FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM information_schema.columns WHERE table_name IN ('profiles', 'user_configs');
