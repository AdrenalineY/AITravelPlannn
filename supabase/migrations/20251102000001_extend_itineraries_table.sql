-- =====================================================
-- 迁移脚本: 扩展 itineraries 表以支持完整的行程卡片功能
-- 版本: 20251102000001
-- 说明: 
--   1. 复用现有 itineraries 表,添加缺失的字段
--   2. 利用现有的 itinerary_days 和 itinerary_activities 表
--   3. 保持与 conversation_sessions 的外键关系
--   4. 允许 start_date 和 end_date 为 NULL (支持日期待定的行程)
-- =====================================================

-- 步骤 0: 修改日期字段约束,允许 NULL
-- 原因: 行程规划初期可能还没确定具体日期
ALTER TABLE public.itineraries 
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;

COMMENT ON COLUMN public.itineraries.start_date IS '开始日期(可为空,待用户确定)';
COMMENT ON COLUMN public.itineraries.end_date IS '结束日期(可为空,待用户确定)';

-- 步骤 1: 删除可能依赖 total_days/total_nights 的视图
DROP VIEW IF EXISTS public.itineraries_with_details CASCADE;

-- 步骤 2: 删除旧的生成列(如果存在),因为需要修改定义以支持 NULL
ALTER TABLE public.itineraries 
  DROP COLUMN IF EXISTS total_days CASCADE,
  DROP COLUMN IF EXISTS total_nights CASCADE;

-- 步骤 3: 添加缺失的字段到 itineraries 表
ALTER TABLE public.itineraries 
  -- 会话关联 (反向引用)
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.conversation_sessions(id),
  
  -- 扩展目的地信息
  ADD COLUMN IF NOT EXISTS cities jsonb DEFAULT '[]'::jsonb,
  
  -- 时间计算字段 (修改为支持 NULL,当日期为空时返回 NULL)
  ADD COLUMN IF NOT EXISTS total_days integer GENERATED ALWAYS AS (
    CASE 
      WHEN start_date IS NOT NULL AND end_date IS NOT NULL 
      THEN end_date - start_date + 1 
      ELSE NULL 
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS total_nights integer GENERATED ALWAYS AS (
    CASE 
      WHEN start_date IS NOT NULL AND end_date IS NOT NULL 
      THEN end_date - start_date 
      ELSE NULL 
    END
  ) STORED,
  
  -- 人员详情
  ADD COLUMN IF NOT EXISTS travelers_detail jsonb DEFAULT '{}'::jsonb,
  
  -- 偏好与主题
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS travel_style text,
  ADD COLUMN IF NOT EXISTS special_requests jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS theme text,
  
  -- 预算详情 (保留原有 budget 字段作为 total_budget)
  ADD COLUMN IF NOT EXISTS budget_per_person numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'CNY',
  ADD COLUMN IF NOT EXISTS estimated_cost jsonb DEFAULT '{}'::jsonb,
  
  -- 住宿信息
  ADD COLUMN IF NOT EXISTS accommodation jsonb DEFAULT '{}'::jsonb,
  
  -- 实用建议
  ADD COLUMN IF NOT EXISTS tips jsonb DEFAULT '{}'::jsonb,
  
  -- 美食推荐
  ADD COLUMN IF NOT EXISTS food_recommendations jsonb DEFAULT '[]'::jsonb,
  
  -- 购物推荐
  ADD COLUMN IF NOT EXISTS shopping_spots jsonb DEFAULT '[]'::jsonb,
  
  -- 交通总览
  ADD COLUMN IF NOT EXISTS transportation_summary jsonb DEFAULT '{}'::jsonb,
  
  -- 注意事项
  ADD COLUMN IF NOT EXISTS notes text,
  
  -- 封面图片
  ADD COLUMN IF NOT EXISTS cover_image text,
  
  -- 标签
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  
  -- 分享设置
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_code text UNIQUE,
  
  -- 版本控制
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- 步骤 4: 为新字段创建注释
COMMENT ON COLUMN public.itineraries.session_id IS '关联的会话ID';
COMMENT ON COLUMN public.itineraries.cities IS '涉及的城市列表 [string]';
COMMENT ON COLUMN public.itineraries.total_days IS '总天数(自动计算)';
COMMENT ON COLUMN public.itineraries.total_nights IS '总晚数(自动计算)';
COMMENT ON COLUMN public.itineraries.travelers_detail IS '出行人员详情 {adults, children, infants, ages}';
COMMENT ON COLUMN public.itineraries.preferences IS '旅行偏好标签 [string]';
COMMENT ON COLUMN public.itineraries.travel_style IS '旅行风格: 休闲|紧凑|深度游';
COMMENT ON COLUMN public.itineraries.special_requests IS '特殊需求 [string]';
COMMENT ON COLUMN public.itineraries.theme IS '行程主题: 蜜月|亲子|毕业旅行等';
COMMENT ON COLUMN public.itineraries.budget_per_person IS '人均预算';
COMMENT ON COLUMN public.itineraries.currency IS '货币单位: CNY|USD等';
COMMENT ON COLUMN public.itineraries.estimated_cost IS '费用估算明细 {total, perPerson, breakdown}';
COMMENT ON COLUMN public.itineraries.accommodation IS '住宿信息 {region, type, recommendations}';
COMMENT ON COLUMN public.itineraries.tips IS '实用建议 {bestTime, weather, transportation, packing, safety, cultural}';
COMMENT ON COLUMN public.itineraries.food_recommendations IS '美食推荐列表';
COMMENT ON COLUMN public.itineraries.shopping_spots IS '购物推荐列表';
COMMENT ON COLUMN public.itineraries.transportation_summary IS '交通总览';
COMMENT ON COLUMN public.itineraries.cover_image IS '封面图片URL';
COMMENT ON COLUMN public.itineraries.tags IS '标签 [string]';
COMMENT ON COLUMN public.itineraries.is_public IS '是否公开分享';
COMMENT ON COLUMN public.itineraries.share_code IS '分享码(唯一)';
COMMENT ON COLUMN public.itineraries.version IS '版本号(用于乐观锁)';

-- 步骤 5: 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_itineraries_session_id ON public.itineraries(session_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_status ON public.itineraries(status);
CREATE INDEX IF NOT EXISTS idx_itineraries_start_date ON public.itineraries(start_date);
CREATE INDEX IF NOT EXISTS idx_itineraries_destination ON public.itineraries(destination);
CREATE INDEX IF NOT EXISTS idx_itineraries_share_code ON public.itineraries(share_code) WHERE share_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_itineraries_preferences ON public.itineraries USING gin(preferences);
CREATE INDEX IF NOT EXISTS idx_itineraries_tags ON public.itineraries USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_itineraries_cities ON public.itineraries USING gin(cities);

-- 步骤 6: 扩展 itinerary_days 表
ALTER TABLE public.itinerary_days
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS highlights jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_distance numeric(10,2),
  ADD COLUMN IF NOT EXISTS total_duration integer;

COMMENT ON COLUMN public.itinerary_days.title IS '当日标题';
COMMENT ON COLUMN public.itinerary_days.highlights IS '当日亮点 [string]';
COMMENT ON COLUMN public.itinerary_days.total_distance IS '当日总距离(km)';
COMMENT ON COLUMN public.itinerary_days.total_duration IS '当日总时长(分钟)';

-- 步骤 7: 扩展 itinerary_activities 表
ALTER TABLE public.itinerary_activities
  ADD COLUMN IF NOT EXISTS activity_type text CHECK (activity_type IN ('transport', 'activity', 'meal', 'rest', 'accommodation')),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS rating numeric(2,1) CHECK (rating >= 0 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS tips jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS distance_info jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_info jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.itinerary_activities.activity_type IS '活动类型: transport|activity|meal|rest|accommodation';
COMMENT ON COLUMN public.itinerary_activities.description IS '活动描述';
COMMENT ON COLUMN public.itinerary_activities.rating IS '评分(0-5)';
COMMENT ON COLUMN public.itinerary_activities.tips IS '小贴士 [string]';
COMMENT ON COLUMN public.itinerary_activities.distance_info IS '距离信息 {from, to, mode, duration, distance, cost}';
COMMENT ON COLUMN public.itinerary_activities.booking_info IS '预订信息 {required, advanceTime, bookingUrl, contact}';

-- 步骤 8: 更新 RLS 策略 (如果不存在则创建)
-- 8.1 启用 RLS
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_activities ENABLE ROW LEVEL SECURITY;

-- 8.2 删除旧策略(如果存在)
DROP POLICY IF EXISTS "Users can view their own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Users can view public itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Users can create their own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Users can update their own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Users can delete their own itineraries" ON public.itineraries;

DROP POLICY IF EXISTS "Users can view their own itinerary days" ON public.itinerary_days;
DROP POLICY IF EXISTS "Users can create their own itinerary days" ON public.itinerary_days;
DROP POLICY IF EXISTS "Users can update their own itinerary days" ON public.itinerary_days;
DROP POLICY IF EXISTS "Users can delete their own itinerary days" ON public.itinerary_days;

DROP POLICY IF EXISTS "Users can view their own itinerary activities" ON public.itinerary_activities;
DROP POLICY IF EXISTS "Users can create their own itinerary activities" ON public.itinerary_activities;
DROP POLICY IF EXISTS "Users can update their own itinerary activities" ON public.itinerary_activities;
DROP POLICY IF EXISTS "Users can delete their own itinerary activities" ON public.itinerary_activities;

-- 8.3 创建新的 RLS 策略
-- itineraries 表策略
CREATE POLICY "Users can view their own itineraries"
  ON public.itineraries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view public itineraries"
  ON public.itineraries FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can create their own itineraries"
  ON public.itineraries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itineraries"
  ON public.itineraries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itineraries"
  ON public.itineraries FOR DELETE
  USING (auth.uid() = user_id);

-- itinerary_days 表策略
CREATE POLICY "Users can view their own itinerary days"
  ON public.itinerary_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND (itineraries.user_id = auth.uid() OR itineraries.is_public = true)
    )
  );

CREATE POLICY "Users can create their own itinerary days"
  ON public.itinerary_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own itinerary days"
  ON public.itinerary_days FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own itinerary days"
  ON public.itinerary_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

-- itinerary_activities 表策略
CREATE POLICY "Users can view their own itinerary activities"
  ON public.itinerary_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days
      JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND (itineraries.user_id = auth.uid() OR itineraries.is_public = true)
    )
  );

CREATE POLICY "Users can create their own itinerary activities"
  ON public.itinerary_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.itinerary_days
      JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own itinerary activities"
  ON public.itinerary_activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days
      JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own itinerary activities"
  ON public.itinerary_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days
      JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
      WHERE itinerary_days.id = itinerary_activities.day_id
      AND itineraries.user_id = auth.uid()
    )
  );

-- 步骤 9: 创建触发器函数以自动更新 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 步骤 10: 创建触发器
DROP TRIGGER IF EXISTS update_itineraries_updated_at ON public.itineraries;
CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON public.itineraries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 步骤 11: 创建分享码生成函数
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 步骤 12: 重新创建视图(在删除和重建列之后)
CREATE OR REPLACE VIEW public.itineraries_with_details AS
SELECT 
  i.*,
  -- 聚合天数信息
  (
    SELECT json_agg(
      json_build_object(
        'id', d.id,
        'date', d.date,
        'title', d.title,
        'summary', d.summary,
        'highlights', d.highlights,
        'totalCost', d.total_cost,
        'totalDistance', d.total_distance,
        'totalDuration', d.total_duration,
        'activities', (
          SELECT json_agg(
            json_build_object(
              'id', a.id,
              'order', a."order",
              'time', a.time,
              'type', a.activity_type,
              'poiId', a.poi_id,
              'poiName', a.poi_name,
              'location', json_build_object(
                'lng', a.location_lng,
                'lat', a.location_lat
              ),
              'address', a.address,
              'category', a.category,
              'description', a.description,
              'notes', a.notes,
              'cost', a.cost,
              'duration', a.duration,
              'rating', a.rating,
              'tips', a.tips,
              'distanceInfo', a.distance_info,
              'bookingInfo', a.booking_info
            ) ORDER BY a."order"
          )
          FROM public.itinerary_activities a
          WHERE a.day_id = d.id
        )
      ) ORDER BY d.date
    )
    FROM public.itinerary_days d
    WHERE d.itinerary_id = i.id
  ) AS days_detail
FROM public.itineraries i;

COMMENT ON VIEW public.itineraries_with_details IS '行程完整信息视图(包含天数和活动明细)';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 数据库迁移完成!';
  RAISE NOTICE '📊 已扩展以下表:';
  RAISE NOTICE '  - itineraries: 添加 20+ 个字段';
  RAISE NOTICE '  - itinerary_days: 添加 4 个字段';
  RAISE NOTICE '  - itinerary_activities: 添加 6 个字段';
  RAISE NOTICE '🔒 已配置 RLS 策略';
  RAISE NOTICE '🔍 已创建 8 个索引';
  RAISE NOTICE '📷 已创建视图: itineraries_with_details';
  RAISE NOTICE '';
  RAISE NOTICE '下一步:';
  RAISE NOTICE '1. 更新 API 路由使用 itineraries 表';
  RAISE NOTICE '2. 测试前端行程保存和加载功能';
END $$;
