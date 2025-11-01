/**
 * Agent Session API - 管理对话会话
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 创建新会话
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
    const { title, userPreferences = {} } = body

    const { data: session, error } = await supabase
      .from('conversation_sessions')
      .insert({
        user_id: user.id,
        title: title || '新对话',
        user_preferences: userPreferences,
        is_active: true,
      })
      .select()
      .single()

    if (error || !session) {
      return NextResponse.json({ error: '创建会话失败' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error: any) {
    console.error('[Session API POST] Error:', error)
    return NextResponse.json(
      { error: error.message || '创建会话失败' },
      { status: 500 }
    )
  }
}

/**
 * 获取会话列表或单个会话
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
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // 获取单个会话
      const { data: session, error } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (error || !session) {
        return NextResponse.json({ error: '会话不存在' }, { status: 404 })
      }

      return NextResponse.json({ session })
    } else {
      // 获取会话列表
      const { data: sessions, error } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) {
        return NextResponse.json({ error: '获取会话列表失败' }, { status: 500 })
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
 * 更新会话
 */
export async function PATCH(request: NextRequest) {
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
    const { sessionId, title, userPreferences, isActive } = body

    if (!sessionId) {
      return NextResponse.json({ error: '缺少 sessionId' }, { status: 400 })
    }

    const updates: any = {}
    if (title !== undefined) updates.title = title
    if (userPreferences !== undefined) updates.user_preferences = userPreferences
    if (isActive !== undefined) updates.is_active = isActive

    const { data: session, error } = await supabase
      .from('conversation_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !session) {
      return NextResponse.json({ error: '更新会话失败' }, { status: 500 })
    }

    return NextResponse.json({ session })
  } catch (error: any) {
    console.error('[Session API PATCH] Error:', error)
    return NextResponse.json(
      { error: error.message || '更新会话失败' },
      { status: 500 }
    )
  }
}

/**
 * 删除会话
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
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: '缺少 sessionId' }, { status: 400 })
    }

    const { error } = await supabase
      .from('conversation_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: '删除会话失败' }, { status: 500 })
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
