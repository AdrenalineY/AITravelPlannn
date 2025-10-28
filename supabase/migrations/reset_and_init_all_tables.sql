-- ================================================================
-- AI Travel Planner - 完整数据库重置与初始化脚本
-- ================================================================
-- 执行日期: 2025-10-28
-- 用途: 删除旧的 user_configs 表并创建所有正确的数据表
-- 警告: 此脚本会删除所有现有数据!请在执行前做好备份!
-- ================================================================

-- ================================================================
-- 第一部分: 删除旧表 (谨慎操作!)
-- ================================================================

-- 删除旧的 RLS 策略
DROP POLICY IF EXISTS "Users can view their own config" ON user_configs;
DROP POLICY IF EXISTS "Users can insert their own config" ON user_configs;
DROP POLICY IF EXISTS "Users can update their own config" ON user_configs;
DROP POLICY IF EXISTS "Users can delete their own config" ON user_configs;

-- 删除旧的索引
DROP INDEX IF EXISTS idx_user_configs_user_id;
DROP INDEX IF EXISTS idx_user_configs_completed;

-- 删除 user_configs 表 (包含所有旧的 API Key 数据)
DROP TABLE IF EXISTS user_configs CASCADE;

-- 确认删除完成
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_configs') THEN
    RAISE NOTICE '✅ 旧的 user_configs 表已成功删除';
  END IF;
END $$;


-- ================================================================
-- 第二部分: 创建新的 user_configs 表 (支持双 API Key)
-- ================================================================

CREATE TABLE user_configs (
  -- 主键: 用户ID
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- LLM 配置
  llm_provider TEXT,                    -- LLM提供商: 'aliyun', 'openai'
  llm_api_key_encrypted TEXT,           -- 加密的 LLM API Key
  llm_base_url TEXT,                    -- LLM API 基础 URL
  llm_model TEXT,                       -- LLM 模型名称
  
  -- 语音配置
  speech_provider TEXT,                 -- 语音提供商: 'xunfei', 'aliyun'
  speech_api_key_encrypted TEXT,        -- 加密的语音 API Key
  speech_app_id TEXT,                   -- 语音应用 ID (讯飞需要)
  speech_api_secret TEXT,               -- 语音 API Secret (讯飞需要)
  
  -- 地图配置 (新架构: 双 Key)
  map_provider TEXT,                    -- 地图提供商: 'amap', 'baidu'
  map_web_service_key_encrypted TEXT,   -- 加密的 Web服务 API Key (后端数据)
  map_js_api_key_encrypted TEXT,        -- 加密的 JS API Key (前端显示)
  map_security_code_encrypted TEXT,     -- 加密的安全密钥 (可选,用于 JS API 安全验证)
  
  -- 元数据
  has_completed_setup BOOLEAN DEFAULT FALSE,  -- 是否完成初始配置
  created_at TIMESTAMPTZ DEFAULT NOW(),       -- 创建时间
  updated_at TIMESTAMPTZ DEFAULT NOW()        -- 最后更新时间
);

-- 添加表注释
COMMENT ON TABLE user_configs IS '用户API配置表 - 存储加密后的API密钥 (v2.1.0 纯高德架构)';

-- 添加列注释
COMMENT ON COLUMN user_configs.user_id IS '用户ID,关联到 auth.users';
COMMENT ON COLUMN user_configs.llm_provider IS 'LLM提供商: aliyun (通义千问), openai';
COMMENT ON COLUMN user_configs.llm_api_key_encrypted IS '加密后的 LLM API 密钥';
COMMENT ON COLUMN user_configs.llm_base_url IS 'LLM API 基础 URL (OpenAI 兼容接口)';
COMMENT ON COLUMN user_configs.llm_model IS 'LLM 模型名称 (如: qwen-plus, gpt-4)';
COMMENT ON COLUMN user_configs.speech_provider IS '语音提供商: xunfei (讯飞), aliyun';
COMMENT ON COLUMN user_configs.speech_api_key_encrypted IS '加密后的语音 API 密钥';
COMMENT ON COLUMN user_configs.speech_app_id IS '讯飞语音应用 ID';
COMMENT ON COLUMN user_configs.speech_api_secret IS '讯飞语音 API Secret';
COMMENT ON COLUMN user_configs.map_provider IS '地图提供商: amap (高德), baidu (百度)';
COMMENT ON COLUMN user_configs.map_web_service_key_encrypted IS '高德地图 Web服务 API Key (加密) - 用于后端 POI 搜索、路线规划、地理编码';
COMMENT ON COLUMN user_configs.map_js_api_key_encrypted IS '高德地图 Web端(JS API) Key (加密) - 用于前端地图显示和交互';
COMMENT ON COLUMN user_configs.map_security_code_encrypted IS '高德地图安全密钥 (加密,可选) - 用于 JS API 安全验证,防止 API Key 被盗用';
COMMENT ON COLUMN user_configs.has_completed_setup IS '是否已完成初始配置向导';
COMMENT ON COLUMN user_configs.created_at IS '记录创建时间';
COMMENT ON COLUMN user_configs.updated_at IS '记录最后更新时间';

-- 启用行级安全策略 (RLS)
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略: 用户只能访问自己的配置
CREATE POLICY "Users can view their own config"
  ON user_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config"
  ON user_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON user_configs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own config"
  ON user_configs FOR DELETE
  USING (auth.uid() = user_id);

-- 创建索引以提高查询性能
CREATE INDEX idx_user_configs_user_id ON user_configs(user_id);
CREATE INDEX idx_user_configs_completed ON user_configs(has_completed_setup);
CREATE INDEX idx_user_configs_updated_at ON user_configs(updated_at);

-- 确认 user_configs 表创建成功
DO $$
BEGIN
  RAISE NOTICE '✅ user_configs 表创建成功 (v2.1.0 纯高德架构)';
END $$;


-- ================================================================
-- 第三部分: 创建行程相关表
-- ================================================================

-- 1. 行程主表
CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 行程基本信息
  title TEXT NOT NULL,                  -- 行程标题
  destination TEXT NOT NULL,             -- 目的地
  start_date DATE NOT NULL,              -- 开始日期
  end_date DATE NOT NULL,                -- 结束日期
  travelers INT NOT NULL DEFAULT 1,      -- 旅行人数
  budget DECIMAL(10,2) DEFAULT 0,        -- 预算金额
  
  -- 行程状态
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'completed', 'cancelled')),
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束: 结束日期不能早于开始日期
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  -- 约束: 旅行人数至少为 1
  CONSTRAINT valid_travelers CHECK (travelers >= 1)
);

COMMENT ON TABLE itineraries IS '行程主表 - 存储用户创建的旅行行程';
COMMENT ON COLUMN itineraries.id IS '行程唯一标识';
COMMENT ON COLUMN itineraries.user_id IS '行程所有者用户ID';
COMMENT ON COLUMN itineraries.title IS '行程标题';
COMMENT ON COLUMN itineraries.destination IS '目的地城市/地区';
COMMENT ON COLUMN itineraries.start_date IS '行程开始日期';
COMMENT ON COLUMN itineraries.end_date IS '行程结束日期';
COMMENT ON COLUMN itineraries.travelers IS '旅行人数';
COMMENT ON COLUMN itineraries.budget IS '行程预算 (单位: 元)';
COMMENT ON COLUMN itineraries.status IS '行程状态: draft(草稿), confirmed(已确认), completed(已完成), cancelled(已取消)';


-- 2. 行程日程表 (每日计划)
CREATE TABLE IF NOT EXISTS itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  
  -- 日程信息
  date DATE NOT NULL,                    -- 日期
  summary TEXT,                          -- 当日行程摘要
  total_cost DECIMAL(10,2) DEFAULT 0,    -- 当日总花费
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束: 每个行程的每一天只能有一条记录
  CONSTRAINT unique_itinerary_day UNIQUE (itinerary_id, date)
);

COMMENT ON TABLE itinerary_days IS '行程日程表 - 存储每日旅行计划';
COMMENT ON COLUMN itinerary_days.id IS '日程唯一标识';
COMMENT ON COLUMN itinerary_days.itinerary_id IS '所属行程ID';
COMMENT ON COLUMN itinerary_days.date IS '日期';
COMMENT ON COLUMN itinerary_days.summary IS '当日行程摘要/亮点';
COMMENT ON COLUMN itinerary_days.total_cost IS '当日总花费 (单位: 元)';


-- 3. 活动表 (每日具体活动)
CREATE TABLE IF NOT EXISTS itinerary_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  
  -- 活动信息
  "order" INT NOT NULL,                  -- 活动顺序 (1, 2, 3...)
  time TEXT NOT NULL,                    -- 活动时间 (如: "09:00")
  poi_id TEXT,                           -- POI ID (来自高德地图)
  poi_name TEXT NOT NULL,                -- POI 名称/活动名称
  location_lng DECIMAL(10,7),            -- 经度
  location_lat DECIMAL(10,7),            -- 纬度
  address TEXT,                          -- 地址
  category TEXT,                         -- 分类 (景点/餐厅/酒店等)
  notes TEXT,                            -- 备注/说明
  cost DECIMAL(10,2) DEFAULT 0,          -- 活动费用
  duration INT,                          -- 持续时间 (分钟)
  
  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束: 活动顺序必须为正数
  CONSTRAINT valid_order CHECK ("order" > 0)
);

COMMENT ON TABLE itinerary_activities IS '活动表 - 存储每日具体活动安排';
COMMENT ON COLUMN itinerary_activities.id IS '活动唯一标识';
COMMENT ON COLUMN itinerary_activities.day_id IS '所属日程ID';
COMMENT ON COLUMN itinerary_activities."order" IS '活动在当日的顺序';
COMMENT ON COLUMN itinerary_activities.time IS '活动开始时间 (HH:MM)';
COMMENT ON COLUMN itinerary_activities.poi_id IS '高德地图 POI ID';
COMMENT ON COLUMN itinerary_activities.poi_name IS 'POI 名称或活动描述';
COMMENT ON COLUMN itinerary_activities.location_lng IS 'POI 经度';
COMMENT ON COLUMN itinerary_activities.location_lat IS 'POI 纬度';
COMMENT ON COLUMN itinerary_activities.address IS 'POI 地址';
COMMENT ON COLUMN itinerary_activities.category IS 'POI 分类';
COMMENT ON COLUMN itinerary_activities.notes IS '活动备注或说明';
COMMENT ON COLUMN itinerary_activities.cost IS '活动费用 (单位: 元)';
COMMENT ON COLUMN itinerary_activities.duration IS '活动持续时间 (分钟)';


-- ================================================================
-- 第四部分: 创建索引
-- ================================================================

-- user_configs 表索引 (已在上面创建)

-- itineraries 表索引
CREATE INDEX IF NOT EXISTS idx_itineraries_user_id ON itineraries(user_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_status ON itineraries(status);
CREATE INDEX IF NOT EXISTS idx_itineraries_dates ON itineraries(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_itineraries_updated_at ON itineraries(updated_at);

-- itinerary_days 表索引
CREATE INDEX IF NOT EXISTS idx_itinerary_days_itinerary_id ON itinerary_days(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_days_date ON itinerary_days(date);

-- itinerary_activities 表索引
CREATE INDEX IF NOT EXISTS idx_itinerary_activities_day_id ON itinerary_activities(day_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_activities_order ON itinerary_activities(day_id, "order");
CREATE INDEX IF NOT EXISTS idx_itinerary_activities_poi_id ON itinerary_activities(poi_id);

-- 确认索引创建成功
DO $$
BEGIN
  RAISE NOTICE '✅ 所有索引创建成功';
END $$;


-- ================================================================
-- 第五部分: 启用行级安全策略 (RLS)
-- ================================================================

ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_activities ENABLE ROW LEVEL SECURITY;

-- 确认 RLS 启用成功
DO $$
BEGIN
  RAISE NOTICE '✅ RLS 已为所有表启用';
END $$;


-- ================================================================
-- 第六部分: 创建 RLS 策略
-- ================================================================

-- ------------------------------
-- itineraries 表的 RLS 策略
-- ------------------------------

DROP POLICY IF EXISTS "Users can view their own itineraries" ON itineraries;
CREATE POLICY "Users can view their own itineraries"
  ON itineraries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own itineraries" ON itineraries;
CREATE POLICY "Users can insert their own itineraries"
  ON itineraries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own itineraries" ON itineraries;
CREATE POLICY "Users can update their own itineraries"
  ON itineraries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own itineraries" ON itineraries;
CREATE POLICY "Users can delete their own itineraries"
  ON itineraries FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------
-- itinerary_days 表的 RLS 策略
-- ------------------------------

DROP POLICY IF EXISTS "Users can view their own itinerary days" ON itinerary_days;
CREATE POLICY "Users can view their own itinerary days"
  ON itinerary_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own itinerary days" ON itinerary_days;
CREATE POLICY "Users can insert their own itinerary days"
  ON itinerary_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own itinerary days" ON itinerary_days;
CREATE POLICY "Users can update their own itinerary days"
  ON itinerary_days FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own itinerary days" ON itinerary_days;
CREATE POLICY "Users can delete their own itinerary days"
  ON itinerary_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

-- ------------------------------
-- itinerary_activities 表的 RLS 策略
-- ------------------------------

DROP POLICY IF EXISTS "Users can view their own activities" ON itinerary_activities;
CREATE POLICY "Users can view their own activities"
  ON itinerary_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM itinerary_days
      JOIN itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND itineraries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own activities" ON itinerary_activities;
CREATE POLICY "Users can insert their own activities"
  ON itinerary_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM itinerary_days
      JOIN itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND itineraries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own activities" ON itinerary_activities;
CREATE POLICY "Users can update their own activities"
  ON itinerary_activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM itinerary_days
      JOIN itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND itineraries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own activities" ON itinerary_activities;
CREATE POLICY "Users can delete their own activities"
  ON itinerary_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM itinerary_days
      JOIN itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND itineraries.user_id = auth.uid()
    )
  );

-- 确认 RLS 策略创建成功
DO $$
BEGIN
  RAISE NOTICE '✅ 所有 RLS 策略创建成功';
END $$;


-- ================================================================
-- 第七部分: 创建触发器 (自动更新 updated_at)
-- ================================================================

-- 创建通用的更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 user_configs 表创建触发器
DROP TRIGGER IF EXISTS update_user_configs_updated_at ON user_configs;
CREATE TRIGGER update_user_configs_updated_at
  BEFORE UPDATE ON user_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 itineraries 表创建触发器
DROP TRIGGER IF EXISTS update_itineraries_updated_at ON itineraries;
CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON itineraries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 确认触发器创建成功
DO $$
BEGIN
  RAISE NOTICE '✅ 自动更新时间戳触发器创建成功';
END $$;


-- ================================================================
-- 第八部分: 验证数据库结构
-- ================================================================

DO $$
DECLARE
  table_count INT;
  policy_count INT;
  index_count INT;
BEGIN
  -- 统计表数量
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('user_configs', 'itineraries', 'itinerary_days', 'itinerary_activities');
  
  -- 统计 RLS 策略数量
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('user_configs', 'itineraries', 'itinerary_days', 'itinerary_activities');
  
  -- 统计索引数量
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename IN ('user_configs', 'itineraries', 'itinerary_days', 'itinerary_activities');
  
  -- 输出验证结果
  RAISE NOTICE '========================================';
  RAISE NOTICE '数据库结构验证结果:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 表数量: % (期望: 4)', table_count;
  RAISE NOTICE '✅ RLS 策略数量: % (期望: 16)', policy_count;
  RAISE NOTICE '✅ 索引数量: %', index_count;
  RAISE NOTICE '========================================';
  
  IF table_count = 4 AND policy_count = 16 THEN
    RAISE NOTICE '🎉 数据库初始化成功完成!';
  ELSE
    RAISE WARNING '⚠️ 数据库结构可能不完整,请检查!';
  END IF;
END $$;


-- ================================================================
-- 第九部分: 使用说明
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📚 数据库表结构说明';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '1. user_configs - 用户配置表';
  RAISE NOTICE '   - 存储 LLM、语音、地图 API 密钥 (加密)';
  RAISE NOTICE '   - ⚠️ 地图配置使用三 Key 架构:';
  RAISE NOTICE '     • map_web_service_key_encrypted: 后端数据获取';
  RAISE NOTICE '     • map_js_api_key_encrypted: 前端地图显示';
  RAISE NOTICE '     • map_security_code_encrypted: 安全密钥 (可选)';
  RAISE NOTICE '';
  RAISE NOTICE '2. itineraries - 行程主表';
  RAISE NOTICE '   - 存储旅行行程基本信息';
  RAISE NOTICE '   - 状态: draft, confirmed, completed, cancelled';
  RAISE NOTICE '';
  RAISE NOTICE '3. itinerary_days - 行程日程表';
  RAISE NOTICE '   - 存储每日旅行计划';
  RAISE NOTICE '   - 关联到 itineraries 表';
  RAISE NOTICE '';
  RAISE NOTICE '4. itinerary_activities - 活动表';
  RAISE NOTICE '   - 存储每日具体活动';
  RAISE NOTICE '   - 关联到 itinerary_days 表';
  RAISE NOTICE '   - 包含 POI 信息和地理坐标';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔒 安全特性';
  RAISE NOTICE '========================================';
  RAISE NOTICE '• 所有表都启用了 RLS (行级安全策略)';
  RAISE NOTICE '• 用户只能访问自己的数据';
  RAISE NOTICE '• API 密钥经过加密存储';
  RAISE NOTICE '• 级联删除保证数据一致性';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📖 下一步操作';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. 在应用中访问 /setup/api-config 配置 API Key';
  RAISE NOTICE '2. 配置高德地图 Key (3个):';
  RAISE NOTICE '   - Web服务 Key (POI搜索/路线规划)';
  RAISE NOTICE '   - JS API Key (地图显示)';
  RAISE NOTICE '   - 安全密钥 (可选,提高安全性)';
  RAISE NOTICE '3. 开始创建旅行行程';
  RAISE NOTICE '========================================';
END $$;
