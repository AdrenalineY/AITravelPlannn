/**
 * Agent Session API - 会话管理（重构版）
 * 🔄 重构: 移除 conversation_sessions 表，使用 agent_runs 的 session_group_id
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 创建新会话分组ID
 * 注意: 现在不再创建 conversation_sessions 记录
 * 而是直接生成 session_group_id，在第一次 agent_run 时使用
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const body = await request.json()
    const { title, destination } = body

    // 🔄 重构: 直接生成 UUID 作为 session_group_id
    const sessionGroupId = crypto.randomUUID()

    // 返回会话信息（供前端使用）
    return NextResponse.json({
      sessionGroupId,
      title: title || '新对话',
      destination: destination || '',
      userId: user.id,
      createdAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Session API POST] Error:', error)
    return NextResponse.json(
      { error: error.message || '创建会话失败' },
      { status: 500 }
    )
  }
}

/**
 * 获取会话列表（从 agent_runs 分组）
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionGroupId = searchParams.get('sessionGroupId')

    if (sessionGroupId) {
      // 获取单个会话的信息（从 agent_runs 重建）
      const { data: runs, error: runsError } = await supabase
        .from('agent_runs')
        .select('session_title, target_destination, created_at, user_message, final_answer')
        .eq('session_group_id', sessionGroupId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      // 🔥 修复: 如果 agent_runs 中没有记录，尝试从 itinerary_cards 获取基本信息
      if (runsError || !runs || runs.length === 0) {
        console.log('[Session API] agent_runs 中无记录，尝试从 itinerary_cards 获取信息')
        
        const { data: itineraryCard, error: cardError } = await supabase
          .from('itinerary_cards')
          .select('title, destination, created_at, natural_plan')
          .eq('session_group_id', sessionGroupId)
          .eq('user_id', user.id)
          .single()
        
        if (cardError || !itineraryCard) {
          console.error('[Session API] 会话和行程都不存在:', { runsError, cardError })
          return NextResponse.json({ error: '会话不存在' }, { status: 404 })
        }
        
        // 基于行程卡片重建会话信息
        const session = {
          sessionGroupId,
          title: itineraryCard.title || '行程对话',
          destination: itineraryCard.destination || '',
          userId: user.id,
          createdAt: itineraryCard.created_at,
          updatedAt: itineraryCard.created_at,
          messageCount: 0,
          messages: [],
          // 标记这是基于行程卡片重建的
          rebuiltFromItinerary: true,
          naturalPlan: itineraryCard.natural_plan
        }
        
        console.log('[Session API] 基于行程卡片重建会话信息成功')
        return NextResponse.json({ session })
      }

      // 重建会话信息
      const session = {
        sessionGroupId,
        title: runs[0].session_title || '对话',
        destination: runs[0].target_destination || '',
        userId: user.id,
        createdAt: runs[0].created_at,
        updatedAt: runs[runs.length - 1].created_at,
        messageCount: runs.length,
        // 对话历史
        messages: runs.map(run => ({
          user: run.user_message,
          assistant: run.final_answer
        }))
      }

      return NextResponse.json({ session })
    } else {
      // 获取会话列表（从 agent_runs 分组聚合）
      const { data: sessions, error } = await supabase
        .rpc('get_user_sessions', { p_user_id: user.id })

      if (error) {
        console.error('[Session API GET] RPC Error:', error)
        // 如果 RPC 不存在，使用备用查询
        const { data: runs } = await supabase
          .from('agent_runs')
          .select('session_group_id, session_title, target_destination, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        // 手动分组
        const groupedSessions = new Map()
        runs?.forEach(run => {
          if (!groupedSessions.has(run.session_group_id)) {
            groupedSessions.set(run.session_group_id, {
              sessionGroupId: run.session_group_id,
              title: run.session_title || '对话',
              destination: run.target_destination || '',
              createdAt: run.created_at,
              updatedAt: run.created_at,
              messageCount: 1
            })
          } else {
            const session = groupedSessions.get(run.session_group_id)
            session.messageCount++
            session.updatedAt = run.created_at
          }
        })

        return NextResponse.json({
          sessions: Array.from(groupedSessions.values())
        })
      }

      return NextResponse.json({ sessions: sessions || [] })
    }
  } catch (error: any) {
    console.error('[Session API GET] Error:', error)
    return NextResponse.json(
      { error: error.message || '获取会话失败' },
      { status: 500 }
    )
  }
}

/**
 * 删除会话（删除 agent_runs 和 itinerary_cards）
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionGroupId = searchParams.get('sessionGroupId')

    if (!sessionGroupId) {
      return NextResponse.json({ error: '缺少 sessionGroupId 参数' }, { status: 400 })
    }

    // 删除 agent_runs（级联删除 agent_messages 和 agent_tool_calls）
    const { error: runsError } = await supabase
      .from('agent_runs')
      .delete()
      .eq('session_group_id', sessionGroupId)
      .eq('user_id', user.id)

    if (runsError) {
      console.error('[Session API DELETE] Delete runs error:', runsError)
    }

    // 删除 itinerary_cards
    const { error: cardError } = await supabase
      .from('itinerary_cards')
      .delete()
      .eq('session_group_id', sessionGroupId)
      .eq('user_id', user.id)

    if (cardError) {
      console.error('[Session API DELETE] Delete card error:', cardError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Session API DELETE] Error:', error)
    return NextResponse.json(
      { error: error.message || '删除会话失败' },
      { status: 500 }
    )
  }
}
