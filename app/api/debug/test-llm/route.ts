/**
 * LLM 连通性测试 API
 * 用于验证 LLM API 密钥是否正确配置和可用
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 标记为动态路由(因为使用了 cookies)
export const dynamic = 'force-dynamic'

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

    console.log('[LLM Test] 开始测试, userId:', user.id)

    // 加载用户配置
    const { ConfigService } = await import('@/services/configService')
    const configService = new ConfigService(supabase)
    const config = await configService.loadConfig(user.id)

    if (!config) {
      return NextResponse.json({
        success: false,
        error: '未找到配置',
        message: '请先在设置页面配置 API 密钥',
      }, { status: 400 })
    }

    console.log('[LLM Test] 配置加载成功:', {
      provider: config.llm?.provider,
      hasApiKey: !!config.llm?.apiKey,
      apiKeyLength: config.llm?.apiKey?.length || 0,
      apiKeyPrefix: config.llm?.apiKey?.substring(0, 10) + '...',
      baseUrl: config.llm?.baseUrl,
      model: config.llm?.model,
    })

    if (!config.llm?.apiKey) {
      return NextResponse.json({
        success: false,
        error: '缺少 LLM API 密钥',
        message: '请在设置页面配置 LLM 服务的 API 密钥',
      }, { status: 400 })
    }

    // 测试 LLM API 调用
    const url = config.llm.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    const model = config.llm.model || 'qwen-plus'

    console.log('[LLM Test] 准备调用 API:', { url, model })

    const startTime = Date.now()
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个测试助手' },
          { role: 'user', content: '请回复"测试成功"' },
        ],
        temperature: 0.7,
        max_tokens: 50,
      }),
    })

    const responseTime = Date.now() - startTime

    console.log('[LLM Test] API 响应状态:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[LLM Test] API 调用失败:', errorText)
      
      return NextResponse.json({
        success: false,
        error: 'LLM API 调用失败',
        details: {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          responseTime,
        },
      }, { status: 500 })
    }

    const data = await response.json()
    console.log('[LLM Test] API 调用成功:', data)

    return NextResponse.json({
      success: true,
      message: 'LLM API 连通性测试成功',
      details: {
        provider: config.llm.provider,
        model,
        url,
        responseTime,
        response: data.choices?.[0]?.message?.content || data,
        usage: data.usage,
      },
    })

  } catch (error: any) {
    console.error('[LLM Test] 测试失败:', error)
    return NextResponse.json({
      success: false,
      error: '测试过程中发生错误',
      message: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
