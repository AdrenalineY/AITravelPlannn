import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { simpleDecrypt } from '@/lib/crypto'

/**
 * 地理编码 API - 将地址或名称转换为坐标
 * GET /api/map/geocode?address=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      )
    }

    // 获取地址参数
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')

    if (!address) {
      return NextResponse.json(
        { success: false, error: '缺少 address 参数' },
        { status: 400 }
      )
    }

    console.log('[地理编码 API] 查询地址:', address)

    // 获取用户的地图配置
    const { data: config, error: configError } = await supabase
      .from('user_configs')
      .select('map_web_service_key_encrypted')
      .eq('user_id', user.id)
      .single()

    if (configError || !config?.map_web_service_key_encrypted) {
      console.log('[地理编码 API] 未配置地图服务')
      return NextResponse.json({
        success: false,
        error: '未配置地图服务'
      })
    }

    // 解密 API Key
    const webServiceKey = await simpleDecrypt(config.map_web_service_key_encrypted, user.id)
    
    if (!webServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'API Key 解密失败'
      })
    }

    // 调用高德地图地理编码 API
    const params = new URLSearchParams({
      key: webServiceKey,
      address: address,
      city: '', // 全国范围搜索
    })

    const amapUrl = `https://restapi.amap.com/v3/geocode/geo?${params}`
    console.log('[地理编码 API] 请求高德API')

    const response = await fetch(amapUrl)
    const data = await response.json()

    console.log('[地理编码 API] 高德响应:', {
      status: data.status,
      count: data.count,
      info: data.info
    })

    if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
      const geocode = data.geocodes[0]
      const [lng, lat] = geocode.location.split(',').map(Number)
      
      console.log('[地理编码 API] ✅ 成功:', { lng, lat, formatted_address: geocode.formatted_address })
      
      return NextResponse.json({
        success: true,
        location: { lng, lat },
        formatted_address: geocode.formatted_address,
        province: geocode.province,
        city: geocode.city,
        district: geocode.district
      })
    }

    console.log('[地理编码 API] ⚠️ 未找到结果')
    return NextResponse.json({
      success: false,
      error: '未找到该地址'
    })

  } catch (error) {
    console.error('[地理编码 API] ❌ 错误:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : '地理编码失败'
      },
      { status: 500 }
    )
  }
}
