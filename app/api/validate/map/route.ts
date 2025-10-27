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
    // 使用高德地图的配置接口进行验证
    const response = await fetch(
      `https://restapi.amap.com/v3/config/district?key=${apiKey}&keywords=中国`,
      {
        method: 'GET',
      }
    )

    const data = await response.json()

    // 高德地图响应格式
    // 成功: { status: "1", info: "OK", ... }
    // 失败: { status: "0", info: "INVALID_USER_KEY", infocode: "10001" }

    if (data.status === '1') {
      return NextResponse.json({
        success: true,
        message: '验证成功',
        provider: 'amap',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: `高德地图 API 验证失败: ${data.info}`,
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
