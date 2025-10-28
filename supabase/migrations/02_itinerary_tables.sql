-- 第二阶段数据库表结构
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 创建行程表
CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  travelers INT NOT NULL DEFAULT 1,
  budget DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建行程日程表
CREATE TABLE IF NOT EXISTS itinerary_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT,
  total_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建活动表
CREATE TABLE IF NOT EXISTS itinerary_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_id UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  "order" INT NOT NULL,
  time TEXT NOT NULL,
  poi_id TEXT,
  poi_name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  cost DECIMAL(10,2) DEFAULT 0
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_itineraries_user_id ON itineraries(user_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_status ON itineraries(status);
CREATE INDEX IF NOT EXISTS idx_itinerary_days_itinerary_id ON itinerary_days(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_activities_day_id ON itinerary_activities(day_id);

-- 5. 启用行级安全策略 (RLS)
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_activities ENABLE ROW LEVEL SECURITY;

-- 6. 创建 RLS 策略

-- 行程表策略: 用户只能访问自己的行程
CREATE POLICY "Users can view their own itineraries"
  ON itineraries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own itineraries"
  ON itineraries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itineraries"
  ON itineraries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itineraries"
  ON itineraries FOR DELETE
  USING (auth.uid() = user_id);

-- 行程日程表策略: 用户只能访问自己行程的日程
CREATE POLICY "Users can view their own itinerary days"
  ON itinerary_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own itinerary days"
  ON itinerary_days FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own itinerary days"
  ON itinerary_days FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own itinerary days"
  ON itinerary_days FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM itineraries
      WHERE itineraries.id = itinerary_days.itinerary_id
      AND itineraries.user_id = auth.uid()
    )
  );

-- 活动表策略: 用户只能访问自己行程的活动
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

-- 7. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON itineraries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '第二阶段数据库表结构创建完成!';
  RAISE NOTICE '已创建表: itineraries, itinerary_days, itinerary_activities';
  RAISE NOTICE '已启用 RLS 策略和索引';
END $$;
