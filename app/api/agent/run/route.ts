/**
 * Agent Run API (重构版) - 处理前端 Agent 运行请求
 * 
 * 主要变更:
 * 1. 移除 conversation_sessions 表依赖
 * 2. 使用 session_group_id 作为会话标识
 * 3. 使用 itinerary_cards 表保存行程(完整JSON存储)
 * 4. 从 profiles.travel_preferences 读取用户偏好
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reactAgentService } from '@/services/reactAgent'
import { aiService } from '@/services/aiService'
import { mapService } from '@/services/mapService'
import { saveItineraryCard } from '@/services/itineraryCardService'
import AgentConfig from '@/config/agent.config'

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

    // 解析请求体
    const body = await request.json()
    const { 
      sessionGroupId,  // 新: 使用 session_group_id
      sessionTitle,    // 新: 会话标题
      targetDestination, // 新: 目标目的地
      message, 
      maxTurns = AgentConfig.MAX_TURNS 
    } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '缺少消息内容' }, { status: 400 })
    }

    if (!sessionGroupId || typeof sessionGroupId !== 'string') {
      return NextResponse.json({ error: '缺少 sessionGroupId' }, { status: 400 })
    }

    // 加载用户的 API 配置
    const { ConfigService } = await import('@/services/configService')
    const backendConfigService = new ConfigService(supabase)
    const config = await backendConfigService.loadConfig(user.id)
    
    if (!config) {
      console.error('[Agent API] 未找到配置')
      return NextResponse.json(
        { 
          error: '请先配置 API 密钥',
          message: '您需要先在设置页面配置 LLM 和地图服务的 API 密钥才能使用 Agent 功能',
          redirectTo: '/setup/api-config'
        },
        { status: 400 }
      )
    }
    
    // 检查必需的配置项
    if (!config.llm?.apiKey) {
      console.error('[Agent API] 缺少 LLM API 密钥, config.llm:', config.llm)
      return NextResponse.json(
        { 
          error: '缺少 LLM API 密钥',
          message: '请在设置页面配置 LLM 服务的 API 密钥',
          redirectTo: '/setup/api-config'
        },
        { status: 400 }
      )
    }
    
    if (!config.map?.webServiceKey) {
      console.error('[Agent API] 缺少地图服务密钥, config.map:', config.map)
      return NextResponse.json(
        { 
          error: '缺少地图服务密钥',
          message: '请在设置页面配置地图服务的 Web Service Key',
          redirectTo: '/setup/api-config'
        },
        { status: 400 }
      )
    }

    // 配置服务
    if (config.llm) {
      aiService.setConfig(config.llm)
    }
    if (config.map) {
      mapService.setWebServiceKey(config.map.webServiceKey)
    }

    // 创建并运行 Agent (新签名: sessionGroupId, userId, supabase)
    const agent = await reactAgentService.createAgent(
      sessionGroupId, 
      user.id, 
      supabase
    )
    
    const result = await agent.run(message, maxTurns)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          agentRunId: result.agentRunId,
        },
        { status: 500 }
      )
    }

    // 如果提取到了行程计划,保存到 itinerary_cards 表
    let itineraryCardId: string | null = null
    
    console.log('[Agent API] 检查行程保存条件:', {
      hasPlanExtracted: !!result.planExtracted,
      sessionGroupId,
      willSave: !!result.planExtracted
    })
    
    if (result.planExtracted) {
      console.log('[Agent API] 开始保存行程到 itinerary_cards...')
      
      // 双重检查: 确认该 session_group_id 还没有关联的行程卡片
      const { data: existingCard } = await supabase
        .from('itinerary_cards')
        .select('id')
        .eq('session_group_id', sessionGroupId)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      
      if (existingCard) {
        console.log('[Agent API] ⚠️ 该会话已有关联行程卡片,跳过保存:', existingCard.id)
        itineraryCardId = existingCard.id
      } else {
        console.log('[Agent API] 确认无重复,继续保存...')
        
        try {
          // 使用新的 itineraryCardService 保存完整JSON
          const savedCard = await saveItineraryCard(
            supabase,
            user.id,
            sessionGroupId,
            result.planExtracted // 直接传入完整的 ItineraryCard 对象
          )
          
          itineraryCardId = savedCard.id
          console.log('[Agent API] ✅ 行程卡片保存成功:', itineraryCardId)
          
        } catch (saveError: any) {
          console.error('[Agent API] ❌ 保存行程卡片失败:', saveError)
          // 不阻断主流程,仅记录错误
        }
      }
    }

    return NextResponse.json({
      success: true,
      sessionGroupId,
      agentRunId: result.agentRunId,
      finalAnswer: result.finalAnswer,
      planExtracted: result.planExtracted,
      itineraryCardId,  // 新: 返回行程卡片ID
      messages: result.messages,
    })
  } catch (error: any) {
    console.error('[Agent API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Agent 运行失败' },
      { status: 500 }
    )
  }
}

/**
 * 获取 Agent 运行状态
 */
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

    const { searchParams } = new URL(request.url)
    const agentRunId = searchParams.get('agentRunId')

    if (!agentRunId) {
      return NextResponse.json({ error: '缺少 agentRunId' }, { status: 400 })
    }

    // 查询 agent_run 记录 (新: 不再join conversation_sessions)
    const { data: agentRun, error: runError } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('id', agentRunId)
      .eq('user_id', user.id)  // 新: 直接验证 user_id
      .single()

    if (runError || !agentRun) {
      return NextResponse.json({ error: 'Agent 运行记录不存在' }, { status: 404 })
    }

    // 获取消息记录
    const { data: messages } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('agent_run_id', agentRunId)
      .order('turn_number', { ascending: true })

    // 获取工具调用记录
    const { data: toolCalls } = await supabase
      .from('agent_tool_calls')
      .select('*')
      .eq('agent_run_id', agentRunId)
      .order('turn_number', { ascending: true })

    return NextResponse.json({
      agentRun: {
        id: agentRun.id,
        sessionGroupId: agentRun.session_group_id,  // 新: 返回 session_group_id
        sessionTitle: agentRun.session_title,        // 新
        targetDestination: agentRun.target_destination, // 新
        userMessage: agentRun.user_message,
        finalAnswer: agentRun.final_answer,
        planExtracted: agentRun.plan_extracted,
        status: agentRun.status,
        errorMessage: agentRun.error_message,
        turnCount: agentRun.turn_count,
        createdAt: agentRun.created_time,  // 新: 使用 created_time
        completedAt: agentRun.completed_at,
      },
      messages: messages || [],
      toolCalls: toolCalls || [],
    })
  } catch (error: any) {
    console.error('[Agent API GET] Error:', error)
    return NextResponse.json(
      { error: error.message || '获取 Agent 状态失败' },
      { status: 500 }
    )
  }
}
