-- 添加 has_completed_setup 列到 user_configs 表
-- 执行时间: 2025-10-27

-- 1. 添加列 (如果不存在)
ALTER TABLE user_configs 
ADD COLUMN IF NOT EXISTS has_completed_setup BOOLEAN DEFAULT FALSE;

-- 2. 为已存在的记录设置默认值
UPDATE user_configs 
SET has_completed_setup = FALSE 
WHERE has_completed_setup IS NULL;

-- 3. 添加注释
COMMENT ON COLUMN user_configs.has_completed_setup IS '用户是否已完成初始配置';
