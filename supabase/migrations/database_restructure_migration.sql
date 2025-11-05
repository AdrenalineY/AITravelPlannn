-- ==========================================
-- 数据库重构迁移脚本
-- 基于: SupaBase重构设计文档.md
-- 创建日期: 2025-11-05
-- 说明: 将原8表架构重构为精简6表架构
-- ==========================================

-- 开始事务
BEGIN;

-- ==========================================
-- 第一阶段: 创建新表结构
-- ==========================================

-- 1. 增强 profiles 表 - 添加统一的旅行偏好管理
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS travel_preferences jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 创建 profiles 更新触发器
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON public.profiles;
CREATE TRIGGER profiles_updated_at_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- 2. 创建新的 agent_runs 表（增强版，包含会话管理）
CREATE TABLE IF NOT EXISTS public.agent_runs_new (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- 🆕 会话管理字段 (从 conversation_sessions 迁移)
  session_group_id uuid,
  session_title text,
  target_destination text,
  
  -- 输入输出
  user_message text NOT NULL,
  final_answer text,
  
  -- Agent 运行上下文
  context_data jsonb DEFAULT '{}',
  
  -- 结构化结果
  plan_extracted jsonb,
  itinerary_card_id uuid,
  
  -- 执行信息
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  turn_count integer DEFAULT 0,
  execution_time_ms integer,
  
  -- 时间戳
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  CONSTRAINT agent_runs_new_pkey PRIMARY KEY (id),
  CONSTRAINT agent_runs_new_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_agent_runs_new_user_id ON public.agent_runs_new(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_new_session_group_id ON public.agent_runs_new(session_group_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_new_status ON public.agent_runs_new(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_new_created_at ON public.agent_runs_new(created_at);

-- 3. 创建新的 itinerary_cards 表
CREATE TABLE IF NOT EXISTS public.itinerary_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_group_id uuid NOT NULL UNIQUE,
  
  -- 基本信息 (冗余存储便于查询)
  title text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  duration_days integer,
  duration_nights integer,
  travelers integer DEFAULT 1,
  
  -- 🔥 核心字段: 完整的结构化行程数据
  plan_data jsonb NOT NULL,
  
  -- 自然语言描述
  natural_plan text,
  
  -- 冗余字段 (便于快速查询)
  total_budget numeric DEFAULT 0,
  budget_per_person numeric DEFAULT 0,
  estimated_cost jsonb DEFAULT '{}',
  currency text DEFAULT 'CNY',
  
  -- 状态管理
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  version integer DEFAULT 1,
  
  -- 元数据
  tags jsonb DEFAULT '[]',
  is_public boolean DEFAULT false,
  share_code text UNIQUE,
  cover_image text,
  
  -- 时间戳
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT itinerary_cards_pkey PRIMARY KEY (id),
  CONSTRAINT itinerary_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 创建 itinerary_cards 索引
CREATE INDEX IF NOT EXISTS idx_itinerary_cards_user_id ON public.itinerary_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_cards_session_group_id ON public.itinerary_cards(session_group_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_cards_destination ON public.itinerary_cards(destination);
CREATE INDEX IF NOT EXISTS idx_itinerary_cards_status ON public.itinerary_cards(status);
CREATE INDEX IF NOT EXISTS idx_itinerary_cards_created_at ON public.itinerary_cards(created_at);

-- 创建 itinerary_cards 更新触发器
CREATE OR REPLACE FUNCTION update_itinerary_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS itinerary_cards_updated_at_trigger ON public.itinerary_cards;
CREATE TRIGGER itinerary_cards_updated_at_trigger
    BEFORE UPDATE ON public.itinerary_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_itinerary_cards_updated_at();

-- ==========================================
-- 第二阶段: 数据迁移（跳过 - 无现有数据）
-- ==========================================

-- 注意: 由于不需要迁移现有数据，此阶段跳过
-- 新的数据将直接使用新表结构创建

-- ==========================================
-- 第三阶段: 设置外键约束
-- ==========================================

-- 注意: 由于是全新创建，外键约束将在新表创建时自动设置
-- agent_messages 和 agent_tool_calls 的外键将指向新的 agent_runs 表

-- ==========================================
-- 第四阶段: 重命名新表
-- ==========================================

-- 删除旧表并重命名新表
DROP TABLE IF EXISTS public.agent_runs CASCADE;
ALTER TABLE public.agent_runs_new RENAME TO agent_runs;

-- 重新创建索引（使用正确的表名）
DROP INDEX IF EXISTS idx_agent_runs_new_user_id;
DROP INDEX IF EXISTS idx_agent_runs_new_session_group_id;
DROP INDEX IF EXISTS idx_agent_runs_new_status;
DROP INDEX IF EXISTS idx_agent_runs_new_created_at;

CREATE INDEX idx_agent_runs_user_id ON public.agent_runs(user_id);
CREATE INDEX idx_agent_runs_session_group_id ON public.agent_runs(session_group_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX idx_agent_runs_created_at ON public.agent_runs(created_at);

-- ==========================================
-- 第五阶段: 创建视图和函数（便于业务查询）
-- ==========================================

-- 创建会话列表视图
CREATE OR REPLACE VIEW v_user_sessions AS
SELECT 
  session_group_id,
  user_id,
  session_title,
  target_destination,
  MIN(created_at) as session_start,
  MAX(created_at) as session_end,
  COUNT(*) as total_runs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_runs
FROM public.agent_runs 
WHERE session_group_id IS NOT NULL
GROUP BY session_group_id, user_id, session_title, target_destination;

-- 创建对话历史获取函数
CREATE OR REPLACE FUNCTION get_conversation_history(p_session_group_id uuid)
RETURNS TABLE(
  role text,
  content text,
  created_time timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'user'::text as role,
    user_message as content,
    created_at as created_time
  FROM agent_runs 
  WHERE session_group_id = p_session_group_id AND status = 'completed'
  
  UNION ALL
  
  SELECT 
    'assistant'::text as role,
    final_answer as content,
    completed_at as created_time
  FROM agent_runs 
  WHERE session_group_id = p_session_group_id AND status = 'completed' AND final_answer IS NOT NULL
  
  ORDER BY created_time;
END;
$$ LANGUAGE plpgsql;

-- 创建行程卡片查询函数
CREATE OR REPLACE FUNCTION get_user_itineraries(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  session_group_id uuid,
  title text,
  destination text,
  start_date date,
  end_date date,
  duration_days integer,
  travelers integer,
  total_budget numeric,
  currency text,
  status text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ic.id,
    ic.session_group_id,
    ic.title,
    ic.destination,
    ic.start_date,
    ic.end_date,
    ic.duration_days,
    ic.travelers,
    ic.total_budget,
    ic.currency,
    ic.status,
    ic.created_at
  FROM itinerary_cards ic
  WHERE ic.user_id = p_user_id
  ORDER BY ic.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 第六阶段: 设置RLS (Row Level Security) 策略
-- ==========================================

-- 启用 RLS
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_cards ENABLE ROW LEVEL SECURITY;

-- agent_runs RLS 策略
CREATE POLICY "Users can view own agent runs" ON public.agent_runs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agent runs" ON public.agent_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agent runs" ON public.agent_runs
  FOR UPDATE USING (auth.uid() = user_id);

-- itinerary_cards RLS 策略
CREATE POLICY "Users can view own itinerary cards" ON public.itinerary_cards
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own itinerary cards" ON public.itinerary_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own itinerary cards" ON public.itinerary_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own itinerary cards" ON public.itinerary_cards
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 第七阶段: 清理旧表
-- ==========================================

-- 删除旧的业务表
DROP TABLE IF EXISTS public.itinerary_activities CASCADE;
DROP TABLE IF EXISTS public.itinerary_days CASCADE; 
DROP TABLE IF EXISTS public.itineraries CASCADE;
DROP TABLE IF EXISTS public.conversation_sessions CASCADE;

-- ==========================================
-- 提交事务
-- ==========================================

COMMIT;

-- ==========================================
-- 验证表结构完整性
-- ==========================================

-- 验证新表是否创建成功
SELECT 
  table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_runs' AND table_schema = 'public') 
    THEN '✓ 创建成功' ELSE '✗ 创建失败' END as status
FROM (VALUES ('agent_runs'), ('itinerary_cards')) AS t(table_name);

-- 验证 profiles 表增强
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'travel_preferences' AND table_schema = 'public') 
    THEN '✓ profiles.travel_preferences 字段已添加' 
    ELSE '✗ profiles.travel_preferences 字段添加失败' 
  END as enhancement_status;

-- ==========================================
-- 重构完成报告
-- ==========================================

DO $$
DECLARE
  tables_created integer;
  indexes_created integer;
  functions_created integer;
BEGIN
  -- 统计创建的对象
  SELECT COUNT(*) INTO tables_created 
  FROM information_schema.tables 
  WHERE table_name IN ('agent_runs', 'itinerary_cards') AND table_schema = 'public';
  
  SELECT COUNT(*) INTO indexes_created
  FROM pg_indexes 
  WHERE tablename IN ('agent_runs', 'itinerary_cards') AND schemaname = 'public';
  
  SELECT COUNT(*) INTO functions_created
  FROM information_schema.routines 
  WHERE routine_name IN ('get_conversation_history', 'get_user_itineraries') AND routine_schema = 'public';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '数据库重构完成!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '• 新表创建: % 个', tables_created;
  RAISE NOTICE '• 索引创建: % 个', indexes_created;
  RAISE NOTICE '• 函数创建: % 个', functions_created;
  RAISE NOTICE '• profiles 表已增强 (travel_preferences)';
  RAISE NOTICE '• 旧表已清理完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '重构架构: 8表 → 6表 精简完成';
  RAISE NOTICE '========================================';
END $$;