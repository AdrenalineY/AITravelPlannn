/**
 * Agent Run API - 处理前端 Agent 运行请求
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reactAgentService } from '@/services/reactAgent'
import { aiService } from '@/services/aiService'
import { mapService } from '@/services/mapService'
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
    const { sessionId, message, maxTurns = AgentConfig.MAX_TURNS } = body

    // 🔍 调试: 打印 Agent 配置
    console.log('[Agent API] Agent Configuration:')
    console.log('  - MAX_TURNS (config):', AgentConfig.MAX_TURNS)
    console.log('  - WARNING_TURN (config):', AgentConfig.WARNING_TURN)
    console.log('  - maxTurns (from request):', maxTurns)
    console.log('  - ENV MAX_TURNS:', process.env.NEXT_PUBLIC_AGENT_MAX_TURNS)
    console.log('  - ENV WARNING_TURN:', process.env.NEXT_PUBLIC_AGENT_WARNING_TURN)
    
    console.log('[Agent API] 收到请求:', { userId: user.id, sessionId, messageLength: message?.length })

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '缺少消息内容' }, { status: 400 })
    }

    // 获取或创建会话
    let session
    if (sessionId) {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        // 会话不存在，创建新会话（而不是报错）
        console.log('[Agent API] 会话不存在或已过期，创建新会话...', error?.message)
        const { data: newSession, error: createError } = await supabase
          .from('conversation_sessions')
          .insert({
            user_id: user.id,
            title: message.substring(0, 50),
            user_preferences: {},
            is_active: true,
          })
          .select()
          .single()

        if (createError) {
          console.error('[Agent API] 创建会话失败:', {
            code: createError.code,
            message: createError.message,
            details: createError.details,
            hint: createError.hint,
          })
          
          // 检查是否是表不存在的错误
          if (createError.code === '42P01' || createError.message?.includes('relation') || createError.message?.includes('does not exist')) {
            return NextResponse.json({ 
              error: '数据库表未初始化',
              message: '请先在 Supabase Dashboard 中执行 Agent 数据库迁移脚本（04_agent_tables.sql）',
              details: createError.message,
              migrationRequired: true
            }, { status: 500 })
          }
          
          return NextResponse.json({ 
            error: '创建会话失败',
            details: createError.message,
            code: createError.code
          }, { status: 500 })
        }
        
        if (!newSession) {
          return NextResponse.json({ 
            error: '创建会话失败',
            details: '未返回会话数据'
          }, { status: 500 })
        }
        
        console.log('[Agent API] 新会话创建成功:', newSession.id)
        session = newSession
      } else {
        console.log('[Agent API] 使用现有会话:', data.id)
        session = data
      }
    } else {
      // 创建新会话
      console.log('[Agent API] 未提供 sessionId，创建新会话...')
      const { data, error } = await supabase
        .from('conversation_sessions')
        .insert({
          user_id: user.id,
          title: message.substring(0, 50),
          user_preferences: {},
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('[Agent API] 创建会话失败:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        })
        
        // 检查是否是表不存在的错误
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          return NextResponse.json({ 
            error: '数据库表未初始化',
            message: '请先在 Supabase Dashboard 中执行 Agent 数据库迁移脚本（04_agent_tables.sql）',
            details: error.message,
            migrationRequired: true
          }, { status: 500 })
        }
        
        return NextResponse.json({ 
          error: '创建会话失败',
          details: error.message,
          code: error.code
        }, { status: 500 })
      }
      
      if (!data) {
        return NextResponse.json({ 
          error: '创建会话失败',
          details: '未返回会话数据' 
        }, { status: 500 })
      }
      
      console.log('[Agent API] 新会话创建成功:', data.id)
      session = data
    }

    // 加载用户的 API 配置 (使用后端 Supabase 客户端)
    console.log('[Agent API] 开始加载配置, userId:', user.id)
    const { ConfigService } = await import('@/services/configService')
    const backendConfigService = new ConfigService(supabase)
    const config = await backendConfigService.loadConfig(user.id)
    
    console.log('[Agent API] 配置加载结果:', {
      hasConfig: !!config,
      hasLLM: !!config?.llm,
      hasLLMKey: !!config?.llm?.apiKey,
      llmKeyLength: config?.llm?.apiKey?.length || 0,
      llmKeyPrefix: config?.llm?.apiKey?.substring(0, 10) || 'N/A',
      hasMap: !!config?.map,
      hasMapWebKey: !!config?.map?.webServiceKey,
      mapWebKeyLength: config?.map?.webServiceKey?.length || 0,
    })
    
    if (!config) {
      console.error('[Agent API] 未找到配置, userId:', user.id)
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
    
    console.log('[Agent API] 配置验证通过，准备设置服务')

    // 配置服务
    if (config.llm) {
      aiService.setConfig(config.llm)
    }
    if (config.map) {
      mapService.setWebServiceKey(config.map.webServiceKey)
    }

    // 创建并运行 Agent（传入后端 Supabase 客户端）
    console.log('[Agent API] 创建 Agent, sessionId:', session.id, 'userId:', user.id)
    const agent = await reactAgentService.createAgent(session.id, user.id, supabase)
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

    // 如果提取到了行程计划,保存完整数据到 itineraries 表
    let itineraryId = session.itinerary_id
    if (result.planExtracted && !session.itinerary_id) {
      console.log('[Agent API] 保存完整行程计划...')
      
      // 🔧 修复: 使用完整的 planExtracted 数据,包括 days
      const planData = {
        ...result.planExtracted,
        userId: user.id, // 确保 userId 设置正确
      }
      
      // 转换为 API 格式 (camelCase)
      const apiPayload = {
        sessionId: session.id,
        userId: user.id,
        title: planData.title || '旅行计划',
        destination: planData.destination,
        cities: planData.cities || [],
        startDate: planData.startDate,
        endDate: planData.endDate,
        durationDays: planData.durationDays || planData.totalDays || (planData.days?.length),  // 新增
        durationNights: planData.durationNights || planData.totalNights || (planData.days?.length ? planData.days.length - 1 : null),  // 新增
        travelers: planData.travelers || 1,
        travelersDetail: planData.travelersDetail || {},
        preferences: planData.preferences || [],
        travelStyle: planData.travelStyle,
        specialRequests: planData.specialRequests || [],
        theme: planData.theme,
        totalBudget: planData.totalBudget || 0,
        budgetPerPerson: planData.budgetPerPerson,
        currency: planData.currency || 'CNY',
        estimatedCost: planData.estimatedCost || {},
        accommodation: planData.accommodation || {},
        days: planData.days || [], // ✅ 包含完整的 days 数据
        tips: planData.tips || {},
        foodRecommendations: planData.foodRecommendations || [],
        shoppingSpots: planData.shoppingSpots || [],
        transportationSummary: planData.transportationSummary || {},
        fullPlan: planData.fullPlan || result.finalAnswer,
        rawPlan: planData.rawPlan || '',
        planDescription: result.finalAnswer,  // 新增: 保存 Agent 最后输出的完整描述
        status: 'draft',
        tags: planData.tags || [],
        isPublic: false,
        version: 1,
      }
      
      console.log('[Agent API] API Payload:', {
        title: apiPayload.title,
        destination: apiPayload.destination,
        daysCount: apiPayload.days?.length,
        travelers: apiPayload.travelers,
      })
      
      // 调用 itinerary-cards API 来保存完整数据 (包括 days 和 activities)
      const { data: newItinerary, error: itineraryError } = await supabase
        .from('itineraries')
        .insert({
          session_id: session.id,
          user_id: user.id,
          title: apiPayload.title,
          destination: apiPayload.destination,
          cities: apiPayload.cities,
          start_date: apiPayload.startDate,
          end_date: apiPayload.endDate,
          travelers: apiPayload.travelers,
          travelers_detail: apiPayload.travelersDetail,
          preferences: apiPayload.preferences,
          travel_style: apiPayload.travelStyle,
          special_requests: apiPayload.specialRequests,
          theme: apiPayload.theme,
          budget: apiPayload.totalBudget,
          budget_per_person: apiPayload.budgetPerPerson,
          currency: apiPayload.currency,
          estimated_cost: apiPayload.estimatedCost,
          accommodation: apiPayload.accommodation,
          tips: apiPayload.tips,
          food_recommendations: apiPayload.foodRecommendations,
          shopping_spots: apiPayload.shoppingSpots,
          transportation_summary: apiPayload.transportationSummary,
          notes: apiPayload.fullPlan,
          status: 'draft',
          tags: apiPayload.tags,
          is_public: false,
          version: 1,
        })
        .select()
        .single()

      if (!itineraryError && newItinerary) {
        itineraryId = newItinerary.id
        console.log('[Agent API] 行程主表保存成功:', itineraryId)

        // 保存 days 和 activities
        if (apiPayload.days && apiPayload.days.length > 0) {
          console.log('[Agent API] 保存', apiPayload.days.length, '天行程数据...')
          
          for (let dayIndex = 0; dayIndex < apiPayload.days.length; dayIndex++) {
            const day = apiPayload.days[dayIndex]
            
            // 计算日期
            let dayDate = day.date
            if (!dayDate && apiPayload.startDate) {
              const startDate = new Date(apiPayload.startDate)
              startDate.setDate(startDate.getDate() + dayIndex)
              dayDate = startDate.toISOString().split('T')[0]
            }
            if (!dayDate) {
              const today = new Date()
              today.setDate(today.getDate() + dayIndex)
              dayDate = today.toISOString().split('T')[0]
            }
            
            const { data: dayRecord, error: dayError } = await supabase
              .from('itinerary_days')
              .insert({
                itinerary_id: newItinerary.id,
                day_number: day.dayNumber || dayIndex + 1,
                date: dayDate,
                title: day.title || `第${dayIndex + 1}天`,
                summary: day.summary,
                highlights: day.highlights || [],
                total_distance: day.totalDistance,
                total_duration: day.totalDuration,
                total_cost: day.segments?.reduce((sum: number, seg: any) => sum + (seg.costEstimate || 0), 0) || 0,
              })
              .select()
              .single()

            if (dayError) {
              console.error('[Agent API] 保存第', dayIndex + 1, '天失败:', dayError)
              continue
            }
            
            console.log('[Agent API] 第', dayIndex + 1, '天保存成功, ID:', dayRecord.id)

            // 保存 activities
            if (day.segments && day.segments.length > 0) {
              const activities = day.segments.map((segment: any, segIndex: number) => ({
                day_id: dayRecord.id,
                order: segment.order || segIndex + 1,
                time: segment.time,
                activity_type: segment.type,
                poi_id: segment.poiId,
                poi_name: segment.title,
                location_lng: segment.coordinates?.lng,
                location_lat: segment.coordinates?.lat,
                address: segment.address,
                category: segment.category,
                description: segment.description,
                notes: segment.notes,
                cost: segment.costEstimate,
                duration: segment.duration,
                rating: segment.rating,
                tips: segment.tips || [],
                distance_info: segment.distanceInfo || {},
                booking_info: segment.bookingInfo || {},
              }))

              const { error: activitiesError } = await supabase
                .from('itinerary_activities')
                .insert(activities)

              if (activitiesError) {
                console.error('[Agent API] 保存活动失败:', activitiesError)
              } else {
                console.log('[Agent API] 保存', activities.length, '个活动成功')
              }
            }
          }
        }

        // 更新会话关联的行程 ID
        await supabase
          .from('conversation_sessions')
          .update({ itinerary_id: newItinerary.id })
          .eq('id', session.id)
          
        console.log('[Agent API] 完整行程计划保存完成')
      } else {
        console.error('[Agent API] 保存行程失败:', itineraryError)
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      agentRunId: result.agentRunId,
      finalAnswer: result.finalAnswer,
      planExtracted: result.planExtracted,
      itineraryId,
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

    // 查询 agent_run 记录
    const { data: agentRun, error: runError } = await supabase
      .from('agent_runs')
      .select('*, conversation_sessions!inner(user_id)')
      .eq('id', agentRunId)
      .single()

    if (runError || !agentRun) {
      return NextResponse.json({ error: 'Agent 运行记录不存在' }, { status: 404 })
    }

    // 验证权限
    if (agentRun.conversation_sessions.user_id !== user.id) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
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
        sessionId: agentRun.session_id,
        userMessage: agentRun.user_message,
        finalAnswer: agentRun.final_answer,
        planExtracted: agentRun.plan_extracted,
        status: agentRun.status,
        errorMessage: agentRun.error_message,
        turnCount: agentRun.turn_count,
        createdAt: agentRun.created_at,
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
