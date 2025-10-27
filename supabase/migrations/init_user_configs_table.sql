-- 完整的 user_configs 表结构初始化脚本
-- 执行时间: 2025-10-27
-- 用途: 确保 user_configs 表包含所有必需的列

-- 1. 如果表不存在则创建 (通常表已经存在)
CREATE TABLE IF NOT EXISTS user_configs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  llm_provider TEXT,
  llm_api_key_encrypted TEXT,
  llm_base_url TEXT,
  llm_model TEXT,
  speech_provider TEXT,
  speech_api_key_encrypted TEXT,
  speech_app_id TEXT,
  speech_api_secret TEXT,
  map_provider TEXT,
  map_api_key TEXT,
  has_completed_setup BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 添加缺失的列 (如果已有表但缺少某些列)
-- has_completed_setup 列
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_configs' 
    AND column_name = 'has_completed_setup'
  ) THEN
    ALTER TABLE user_configs 
    ADD COLUMN has_completed_setup BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- created_at 列
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_configs' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE user_configs 
    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- 3. 启用 Row Level Security (如果尚未启用)
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- 4. 创建或替换 RLS 策略
DROP POLICY IF EXISTS "Users can view their own config" ON user_configs;
CREATE POLICY "Users can view their own config"
  ON user_configs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own config" ON user_configs;
CREATE POLICY "Users can insert their own config"
  ON user_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own config" ON user_configs;
CREATE POLICY "Users can update their own config"
  ON user_configs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own config" ON user_configs;
CREATE POLICY "Users can delete their own config"
  ON user_configs FOR DELETE
  USING (auth.uid() = user_id);

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_configs_completed ON user_configs(has_completed_setup);

-- 6. 添加列注释
COMMENT ON TABLE user_configs IS '用户API配置表,存储加密后的API密钥';
COMMENT ON COLUMN user_configs.user_id IS '用户ID,关联到 auth.users';
COMMENT ON COLUMN user_configs.llm_provider IS 'LLM提供商: aliyun, openai';
COMMENT ON COLUMN user_configs.llm_api_key_encrypted IS '加密后的LLM API密钥';
COMMENT ON COLUMN user_configs.llm_base_url IS 'LLM API基础URL';
COMMENT ON COLUMN user_configs.llm_model IS 'LLM模型名称';
COMMENT ON COLUMN user_configs.speech_provider IS '语音提供商: xunfei, aliyun';
COMMENT ON COLUMN user_configs.speech_api_key_encrypted IS '加密后的语音API密钥';
COMMENT ON COLUMN user_configs.map_provider IS '地图提供商: amap, baidu';
COMMENT ON COLUMN user_configs.map_api_key IS '地图API密钥';
COMMENT ON COLUMN user_configs.has_completed_setup IS '是否已完成初始配置';
COMMENT ON COLUMN user_configs.updated_at IS '最后更新时间';
