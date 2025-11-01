-- Agent 对话会话表
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE SET NULL,
  user_preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent 运行记录表
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  final_answer TEXT,
  plan_extracted JSONB,
  status TEXT DEFAULT 'running', -- running, completed, error
  error_message TEXT,
  turn_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Agent 工具调用日志表
CREATE TABLE IF NOT EXISTS agent_tool_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input TEXT NOT NULL,
  tool_output TEXT,
  observation TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent 消息历史表 (存储完整的 Thought/Action/Observation 流程)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  message_type TEXT NOT NULL, -- thought, action, observation, answer
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_active ON conversation_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_runs_session_id ON agent_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run_id ON agent_tool_calls(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_run_id ON agent_messages(agent_run_id);

-- 启用行级安全策略
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

-- conversation_sessions 的 RLS 策略
CREATE POLICY "用户只能查看自己的会话" ON conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户可以创建自己的会话" ON conversation_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可以更新自己的会话" ON conversation_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "用户可以删除自己的会话" ON conversation_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- agent_runs 的 RLS 策略
CREATE POLICY "用户只能查看自己会话的运行记录" ON agent_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions
      WHERE conversation_sessions.id = agent_runs.session_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以创建自己会话的运行记录" ON agent_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_sessions
      WHERE conversation_sessions.id = agent_runs.session_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以更新自己会话的运行记录" ON agent_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions
      WHERE conversation_sessions.id = agent_runs.session_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

-- agent_tool_calls 的 RLS 策略
CREATE POLICY "用户只能查看自己的工具调用日志" ON agent_tool_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agent_runs
      JOIN conversation_sessions ON conversation_sessions.id = agent_runs.session_id
      WHERE agent_runs.id = agent_tool_calls.agent_run_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以创建自己的工具调用日志" ON agent_tool_calls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_runs
      JOIN conversation_sessions ON conversation_sessions.id = agent_runs.session_id
      WHERE agent_runs.id = agent_tool_calls.agent_run_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

-- agent_messages 的 RLS 策略
CREATE POLICY "用户只能查看自己的 Agent 消息" ON agent_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agent_runs
      JOIN conversation_sessions ON conversation_sessions.id = agent_runs.session_id
      WHERE agent_runs.id = agent_messages.agent_run_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "用户可以创建自己的 Agent 消息" ON agent_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_runs
      JOIN conversation_sessions ON conversation_sessions.id = agent_runs.session_id
      WHERE agent_runs.id = agent_messages.agent_run_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_conversation_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_sessions_timestamp
BEFORE UPDATE ON conversation_sessions
FOR EACH ROW
EXECUTE FUNCTION update_conversation_session_timestamp();
