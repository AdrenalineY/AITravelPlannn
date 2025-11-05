-- ==========================================
-- 辅助视图和函数（用于重构后的代码）
-- 创建日期: 2025-11-05
-- 说明: 支持从 agent_runs 分组查询会话
-- ==========================================

-- 创建获取用户会话列表的函数
CREATE OR REPLACE FUNCTION get_user_sessions(p_user_id uuid)
RETURNS TABLE(
  session_group_id uuid,
  session_title text,
  target_destination text,
  session_start timestamptz,
  session_end timestamptz,
  total_runs bigint,
  completed_runs bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.session_group_id,
    MAX(ar.session_title) as session_title,
    MAX(ar.target_destination) as target_destination,
    MIN(ar.created_at) as session_start,
    MAX(ar.created_at) as session_end,
    COUNT(*) as total_runs,
    COUNT(CASE WHEN ar.status = 'completed' THEN 1 END) as completed_runs
  FROM agent_runs ar
  WHERE ar.user_id = p_user_id AND ar.session_group_id IS NOT NULL
  GROUP BY ar.session_group_id
  ORDER BY session_start DESC;
END;
$$ LANGUAGE plpgsql;

-- 创建获取会话对话历史的函数
CREATE OR REPLACE FUNCTION get_session_history(p_session_group_id uuid)
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
  WHERE session_group_id = p_session_group_id 
    AND status = 'completed' 
    AND final_answer IS NOT NULL
  
  ORDER BY created_time;
END;
$$ LANGUAGE plpgsql;

-- 添加注释
COMMENT ON FUNCTION get_user_sessions IS '获取用户的所有会话（从agent_runs分组）';
COMMENT ON FUNCTION get_session_history IS '获取特定会话的对话历史';
