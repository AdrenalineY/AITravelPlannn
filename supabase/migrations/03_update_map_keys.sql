-- 更新地图 API 密钥存储结构
-- 从单一 map_api_key 改为 map_web_service_key_encrypted 和 map_js_api_key_encrypted
-- 执行时间: 2025-10-27
-- 用途: 支持高德地图的两种 API Key (Web服务 Key 和 JS API Key)

-- 1. 添加新的加密列
DO $$ 
BEGIN
  -- 添加 Web服务 API Key (加密存储)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_configs' 
    AND column_name = 'map_web_service_key_encrypted'
  ) THEN
    ALTER TABLE user_configs 
    ADD COLUMN map_web_service_key_encrypted TEXT;
  END IF;

  -- 添加 JS API Key (加密存储)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_configs' 
    AND column_name = 'map_js_api_key_encrypted'
  ) THEN
    ALTER TABLE user_configs 
    ADD COLUMN map_js_api_key_encrypted TEXT;
  END IF;
END $$;

-- 2. 数据迁移: 将旧的 map_api_key 迁移到 map_web_service_key_encrypted
-- 注意: 如果已有数据,需要手动复制。这里假设旧数据作为 Web服务 Key
UPDATE user_configs 
SET map_web_service_key_encrypted = map_api_key
WHERE map_api_key IS NOT NULL 
  AND map_web_service_key_encrypted IS NULL;

-- 3. 可选: 在所有数据迁移完成后,删除旧列 map_api_key
-- 取消注释以下行以删除旧列 (建议先备份数据)
-- ALTER TABLE user_configs DROP COLUMN IF EXISTS map_api_key;

-- 4. 添加注释说明
COMMENT ON COLUMN user_configs.map_web_service_key_encrypted IS '高德地图 Web服务 API Key (加密存储),用于后端 POI 搜索、路线规划等';
COMMENT ON COLUMN user_configs.map_js_api_key_encrypted IS '高德地图 Web端(JS API) Key (加密存储),用于前端地图显示';

-- 5. 验证脚本执行结果
DO $$
DECLARE
  has_web_service_key BOOLEAN;
  has_js_api_key BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_configs' 
    AND column_name = 'map_web_service_key_encrypted'
  ) INTO has_web_service_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_configs' 
    AND column_name = 'map_js_api_key_encrypted'
  ) INTO has_js_api_key;

  IF has_web_service_key AND has_js_api_key THEN
    RAISE NOTICE '✅ 地图 API 密钥列更新成功';
  ELSE
    RAISE WARNING '⚠️ 地图 API 密钥列更新可能未完成';
  END IF;
END $$;
