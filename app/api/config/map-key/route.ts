import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleDecrypt } from '@/lib/crypto'

// 标记为动态路由(因为使用了 cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('[MapKey API] 未登录')
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    console.log('[MapKey API] 开始查询配置, userId:', user.id)

    // 获取用户的地图配置 (加密字段)
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('map_provider, map_js_api_key_encrypted, map_security_code_encrypted')
      .eq('user_id', user.id)
      .single()

    console.log('[MapKey API] 查询配置结果:', { 
      hasConfig: !!config, 
      error: configError?.message,
      hasEncryptedJsKey: !!config?.map_js_api_key_encrypted,
      encryptedKeyLength: config?.map_js_api_key_encrypted?.length || 0
    })

    if (configError) {
      if (configError.code === 'PGRST116') {
        // 没有找到配置记录
        console.log('[MapKey API] 未找到配置记录')
        return NextResponse.json({
          jsApiKey: null,
          securityCode: null,
          message: '未配置地图服务，请前往 API 设置页面配置高德地图'
        })
      }
      console.error('[MapKey API] 数据库查询错误:', configError)
      return NextResponse.json({
        jsApiKey: null,
        securityCode: null,
        message: '查询配置失败: ' + configError.message
      })
    }

    if (!config || !config.map_js_api_key_encrypted) {
      console.log('[MapKey API] 用户未配置地图 JS API Key')
      return NextResponse.json({
        jsApiKey: null,
        securityCode: null,
        message: '未配置地图服务，请前往 API 设置页面配置高德地图'
      })
    }

    // 解密密钥
    try {
      const jsApiKey = await simpleDecrypt(config.map_js_api_key_encrypted, user.id)
      const securityCode = config.map_security_code_encrypted 
        ? await simpleDecrypt(config.map_security_code_encrypted, user.id)
        : null

      console.log('[MapKey API] 解密成功:', {
        provider: config.map_provider,
        jsApiKeyLength: jsApiKey?.length || 0,
        hasSecurityCode: !!securityCode
      })
      
      return NextResponse.json({
        jsApiKey,
        securityCode,
        provider: config.map_provider || 'amap',
        message: '配置加载成功'
      })
    } catch (decryptError) {
      console.error('[MapKey API] 解密失败:', decryptError)
      return NextResponse.json({
        jsApiKey: null,
        securityCode: null,
        message: '解密密钥失败，请重新配置'
      })
    }
  } catch (error) {
    console.error('[MapKey API] 获取地图配置失败:', error)
    return NextResponse.json(
      { error: '获取配置失败: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
