/**
 * 迁移 API - 将加密的配置转换为明文存储
 * 仅需执行一次
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    // 获取现有配置
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json({ error: '未找到配置' }, { status: 404 })
    }

    // 检查是否需要迁移（判断是否为加密格式：包含 '.' 分隔符）
    const needsMigration = 
      (config.llm_api_key_encrypted && config.llm_api_key_encrypted.includes('.')) ||
      (config.map_web_service_key_encrypted && config.map_web_service_key_encrypted.includes('.'))

    if (!needsMigration) {
      return NextResponse.json({
        success: true,
        message: '配置已经是明文格式，无需迁移',
        alreadyMigrated: true,
      })
    }

    // 尝试解密（只在前端可用）
    // 由于后端无法解密，我们返回一个标记，让前端来处理
    return NextResponse.json({
      success: false,
      needsClientMigration: true,
      message: '检测到加密的配置数据，请重新保存配置以转换为新格式',
      redirectTo: '/setup/api-config',
    })
  } catch (error: any) {
    console.error('[Migration API] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
