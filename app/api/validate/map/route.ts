import { NextRequest, NextResponse } from 'next/server'

/**
 * 地图 API 密钥验证接口
 */
export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json()

    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    if (provider === 'amap') {
      return await validateAmapKey(apiKey)
    } else if (provider === 'mapbox') {
      return await validateMapboxKey(apiKey)
    } else {
      return NextResponse.json(
        { success: false, error: '不支持的提供商' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('地图 API 验证错误:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '验证过程发生错误' 
      },
      { status: 500 }
    )
  }
}

/**
 * 验证高德地图 API Key
 */
async function validateAmapKey(apiKey: string): Promise<NextResponse> {
  try {
    // 使用高德地图的 IP 定位接口进行验证
    // 这个接口对 Web 服务 API 平台的 key 都可用,且不需要安全密钥
    const response = await fetch(
      `https://restapi.amap.com/v3/ip?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()

    // 高德地图响应格式
    // 成功: { status: "1", info: "OK", ... }
    // 失败: { status: "0", info: "INVALID_USER_KEY", infocode: "10001" }
    // 平台不匹配: { status: "0", info: "USERKEY_PLAT_NOMATCH", infocode: "10009" }

    if (data.status === '1') {
      return NextResponse.json({
        success: true,
        message: '验证成功',
        provider: 'amap',
      })
    } else {
      // 针对常见错误提供友好提示
      let errorMessage = `高德地图 API 验证失败: ${data.info}`
      
      if (data.infocode === '10009' || data.info === 'USERKEY_PLAT_NOMATCH') {
        errorMessage = 'API Key 与平台不匹配。请确保:\n1. 在高德开放平台创建的是 "Web服务" 类型的 Key\n2. 不要使用 "Web端(JS API)" 类型的 Key\n3. 前往 https://console.amap.com/dev/key/app 检查或重新创建'
      } else if (data.infocode === '10001' || data.info === 'INVALID_USER_KEY') {
        errorMessage = 'API Key 无效,请检查是否正确复制'
      } else if (data.infocode === '10003' || data.info === 'DAILY_QUERY_OVER_LIMIT') {
        errorMessage = 'API Key 今日调用量已超限,请明天再试或升级配额'
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        errorCode: data.infocode,
      })
    }
  } catch (error) {
    console.error('高德地图验证失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    })
  }
}

/**
 * 验证 Mapbox API Key
 */
async function validateMapboxKey(apiKey: string): Promise<NextResponse> {
  try {
    // Mapbox Token 验证接口
    const response = await fetch(
      `https://api.mapbox.com/tokens/v2?access_token=${apiKey}`,
      {
        method: 'GET',
      }
    )

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: '验证成功',
        provider: 'mapbox',
      })
    } else if (response.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'Mapbox Token 无效',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: `验证失败 (HTTP ${response.status})`,
      })
    }
  } catch (error) {
    console.error('Mapbox 验证失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    })
  }
}
