import { NextRequest, NextResponse } from 'next/server'

/**
 * LLM API 密钥验证接口
 * 作为后端代理,避免 CORS 问题
 */
export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey, baseUrl, model } = await request.json()

    // 参数验证
    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 根据不同提供商进行验证
    if (provider === 'aliyun') {
      return await validateAliyunLLM(apiKey, baseUrl, model)
    } else if (provider === 'openai') {
      return await validateOpenAILLM(apiKey, baseUrl, model)
    } else {
      return NextResponse.json(
        { success: false, error: '不支持的提供商' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('LLM 验证错误:', error)
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
 * 验证阿里云百炼 API Key
 */
async function validateAliyunLLM(
  apiKey: string,
  baseUrl?: string,
  model?: string
): Promise<NextResponse> {
  try {
    // 阿里云百炼(DashScope)的正确 API 端点
    // 直接使用用户提供的完整 URL
    const url = baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    const testModel = model || 'qwen-turbo'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: testModel,
        messages: [
          {
            role: 'user',
            content: 'test',
          },
        ],
        max_tokens: 10,
      }),
    })

    // 获取响应文本,然后尝试解析 JSON
    const responseText = await response.text()
    let data: any = {}
    
    try {
      if (responseText) {
        data = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('JSON 解析失败，原始响应:', responseText)
      return NextResponse.json({
        success: false,
        error: '服务器返回了无效的响应格式',
        details: `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
      })
    }

    // 阿里云百炼 OpenAI 兼容模式响应格式
    // 成功: { id: "...", choices: [{...}], usage: {...}, ... }
    // 失败: { error: { message: "...", type: "...", code: "..." } }

    if (response.ok && (data.choices || data.id)) {
      return NextResponse.json({
        success: true,
        message: '验证成功',
        provider: 'aliyun',
        model: testModel,
      })
    } else if (response.status === 429) {
      // 限流也说明密钥有效
      return NextResponse.json({
        success: true,
        message: '验证成功 (API 限流,但密钥有效)',
        provider: 'aliyun',
      })
    } else if (response.status === 401 || response.status === 403) {
      return NextResponse.json({
        success: false,
        error: 'API Key 无效或已过期',
        details: data.error?.message || data.message || data.code,
      })
    } else if (response.status === 404) {
      return NextResponse.json({
        success: false,
        error: 'API 端点不存在',
        details: `请检查 API 端点是否正确。推荐使用: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`,
        statusCode: response.status,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: `API 返回错误: ${data.error?.message || data.message || data.code || '未知错误'}`,
        statusCode: response.status,
        details: JSON.stringify(data).substring(0, 200),
      })
    }
  } catch (error) {
    console.error('阿里云 LLM 验证失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    })
  }
}

/**
 * 验证 OpenAI API Key
 */
async function validateOpenAILLM(
  apiKey: string,
  baseUrl?: string,
  model?: string
): Promise<NextResponse> {
  try {
    // 直接使用用户提供的完整 URL
    const url = baseUrl || 'https://api.openai.com/v1/chat/completions'
    const testModel = model || 'gpt-3.5-turbo'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      }),
    })

    // 获取响应文本,然后尝试解析 JSON
    const responseText = await response.text()
    let data: any = {}
    
    try {
      if (responseText) {
        data = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('JSON 解析失败，原始响应:', responseText)
      return NextResponse.json({
        success: false,
        error: '服务器返回了无效的响应格式',
        details: `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
      })
    }

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: '验证成功',
        provider: 'openai',
        model: testModel,
      })
    } else if (response.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'API Key 无效',
        details: data.error?.message,
      })
    } else if (response.status === 429) {
      return NextResponse.json({
        success: true,
        message: '验证成功 (API 限流,但密钥有效)',
        provider: 'openai',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: `API 错误: ${data.error?.message || '未知错误'}`,
        statusCode: response.status,
      })
    }
  } catch (error) {
    console.error('OpenAI LLM 验证失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    })
  }
}
