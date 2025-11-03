-- =====================================================
-- 紧急修复脚本: 添加缺失的 day_number 列到 itinerary_days 表
-- 说明: 基于实际数据库结构分析,只添加真正缺失的列
-- =====================================================

-- 1. 为 itinerary_days 表添加缺失的 day_number 列
-- 分析: 表中已有 title, highlights, total_distance, total_duration
--       只缺少 day_number 列
ALTER TABLE public.itinerary_days
  ADD COLUMN IF NOT EXISTS day_number integer NOT NULL DEFAULT 1;

-- 添加注释
COMMENT ON COLUMN public.itinerary_days.day_number IS '第几天(1, 2, 3...)';

-- 2. 修复 itinerary_activities 表的约束
-- 分析: 表中已有 activity_type, time_period, meal_type, transport_mode 等列
--       但 activity_type 的约束缺少 'shopping' 类型
--       需要先删除旧约束,再添加新约束

-- 2.1 删除旧的 activity_type 约束
ALTER TABLE public.itinerary_activities
  DROP CONSTRAINT IF EXISTS itinerary_activities_activity_type_check;

-- 2.2 添加新的 activity_type 约束 (包含 shopping)
ALTER TABLE public.itinerary_activities
  ADD CONSTRAINT itinerary_activities_activity_type_check 
  CHECK (activity_type IN ('transport', 'activity', 'meal', 'rest', 'accommodation', 'shopping'));

-- 更新注释
COMMENT ON COLUMN public.itinerary_activities.activity_type IS '活动类型: transport|activity|meal|rest|accommodation|shopping';

-- 3. 验证 itineraries 表 (所有需要的列都已存在)
-- 分析: 表中已有所有需要的列:
--   - duration_days, duration_nights, plan_description
--   - cities, travelers_detail, preferences, travel_style
--   - 等等...所有列都已存在
-- 无需添加任何列

-- 4. 创建索引 (提升查询性能)
CREATE INDEX IF NOT EXISTS idx_itinerary_days_day_number ON public.itinerary_days(day_number);
CREATE INDEX IF NOT EXISTS idx_itinerary_days_itinerary_date ON public.itinerary_days(itinerary_id, date);

-- 5. 刷新 Supabase 的 schema cache
-- 注意: 执行此脚本后,可能需要等待几秒钟让 Supabase 刷新缓存
-- 或者在 Supabase Dashboard 中点击 "Reload schema"

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 修复脚本执行完成!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 已执行的修复:';
  RAISE NOTICE '  1. ✅ 添加 itinerary_days.day_number 列';
  RAISE NOTICE '  2. ✅ 更新 itinerary_activities.activity_type 约束 (添加 shopping 类型)';
  RAISE NOTICE '  3. ✅ 创建性能优化索引';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ 重要提示:';
  RAISE NOTICE '  - Supabase 可能需要 10-30 秒刷新 schema cache';
  RAISE NOTICE '  - 建议等待 30 秒后再提交测试数据';
  RAISE NOTICE '  - 或者在 Table Editor 中手动点击 "Reload Schema"';
  RAISE NOTICE '';
  RAISE NOTICE '📋 下一步操作:';
  RAISE NOTICE '  1. 等待 30 秒让缓存刷新';
  RAISE NOTICE '  2. 删除旧的测试数据: DELETE FROM itineraries WHERE user_id = auth.uid();';
  RAISE NOTICE '  3. 重启开发服务器: npm run dev';
  RAISE NOTICE '  4. 重新提交测试 JSON';
  RAISE NOTICE '  5. 查看控制台确认成功: [API POST] ✅ Day 1 saved successfully';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
