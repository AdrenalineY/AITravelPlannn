/**
 * 配置调试 API - 用于诊断配置读取问题
 * 仅在开发环境使用
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    // 1. 检查表是否存在
    const { data: tables, error: tablesError } = await supabase
      .from('user_configs')
      .select('*')
      .limit(0)

    console.log('[Debug] 表查询结果:', { tablesError })

    // 2. 查询用户配置
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('[Debug] 配置查询结果:', { 
      hasConfig: !!config, 
      error: configError,
      userId: user.id 
    })

    // 3. 检查列结构
    let columns: string[] = []
    if (config) {
      columns = Object.keys(config)
    }

    // 4. 使用 ConfigService 加载
    const { ConfigService } = await import('@/services/configService')
    const configService = new ConfigService(supabase)
    const loadedConfig = await configService.loadConfig(user.id)

    return NextResponse.json({
      success: true,
      debug: {
        userId: user.id,
        userEmail: user.email,
        tableAccessible: !tablesError,
        configExists: !!config,
        configError: configError?.message || null,
        columns,
        rawConfig: config ? {
          hasLLMKey: !!config.llm_api_key_encrypted,
          hasMapWebKey: !!config.map_web_service_key_encrypted,
          hasMapJsKey: !!config.map_js_api_key_encrypted,
          hasMapSecurityCode: !!config.map_security_code_encrypted,
          hasSpeechKey: !!config.speech_api_key_encrypted,
          hasCompletedSetup: config.has_completed_setup,
          llmProvider: config.llm_provider,
          mapProvider: config.map_provider,
          llmKeyLength: config.llm_api_key_encrypted?.length || 0,
          mapWebKeyLength: config.map_web_service_key_encrypted?.length || 0,
          // 显示加密数据的前20个字符用于调试
          llmKeyPrefix: config.llm_api_key_encrypted?.substring(0, 20) || 'N/A',
          mapWebKeyPrefix: config.map_web_service_key_encrypted?.substring(0, 20) || 'N/A',
        } : null,
        loadedConfig: loadedConfig ? {
          hasLLMKey: !!loadedConfig.llm?.apiKey,
          hasMapWebKey: !!loadedConfig.map?.webServiceKey,
          hasMapJsKey: !!loadedConfig.map?.jsApiKey,
          llmKeyLength: loadedConfig.llm?.apiKey?.length || 0,
          mapWebKeyLength: loadedConfig.map?.webServiceKey?.length || 0,
          // 显示解密后的前10个字符
          llmKeyPrefix: loadedConfig.llm?.apiKey?.substring(0, 10) || 'N/A',
          mapWebKeyPrefix: loadedConfig.map?.webServiceKey?.substring(0, 10) || 'N/A',
          llmProvider: loadedConfig.llm?.provider,
          llmBaseUrl: loadedConfig.llm?.baseUrl,
          llmModel: loadedConfig.llm?.model,
        } : null,
      },
    })
  } catch (error: any) {
    console.error('[Debug API] 错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}
