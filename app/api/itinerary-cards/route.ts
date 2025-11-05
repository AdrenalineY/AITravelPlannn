import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/itinerary-cards - 获取用户的所有行程卡片
 * 🔄 重构: 使用新的 itinerary_cards 表 (JSON 存储)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // � 重构: 从 itinerary_cards 表加载数据 (plan_data 包含完整JSON)
    const { data, error } = await supabase
      .from('itinerary_cards')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[API] Load itinerary cards error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 🔄 重构: 直接从 plan_data 提取完整的行程数据
    const itineraries = data.map((row: any) => {
      const planData = row.plan_data || {}
      
      return {
        // 基本信息 (从冗余字段和 plan_data 合并)
        id: row.id,
        sessionGroupId: row.session_group_id,  // 🔄 新字段
        userId: row.user_id,
        title: row.title || planData.title,
        destination: row.destination || planData.destination,
        
        // 从 plan_data JSON 中提取完整数据
        ...planData,
        
        // 确保关键字段存在 (优先使用冗余字段用于列表显示)
        startDate: row.start_date || planData.startDate,
        endDate: row.end_date || planData.endDate,
        durationDays: row.duration_days || planData.durationDays,
        durationNights: row.duration_nights || planData.durationNights,
        travelers: row.travelers || planData.travelers,
        totalBudget: row.total_budget || planData.totalBudget,
        budgetPerPerson: row.budget_per_person || planData.budgetPerPerson,
        currency: row.currency || planData.currency || 'CNY',
        status: row.status || planData.status || 'draft',
        
        // 元数据
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        version: row.version || 1,
      }
    })

    return NextResponse.json(itineraries)
  } catch (error: any) {
    console.error('[API] GET itinerary cards error:', error)
    return NextResponse.json(
      { error: error.message || '加载行程失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/itinerary-cards - 创建新的行程卡片
 * 🔄 重构: 使用新的 itinerary_cards 表 (JSON 存储)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    
    console.log('[API POST] Received itinerary data:', {
      title: body.title,
      destination: body.destination,
      daysCount: body.days?.length
    })

    // 🔄 重构: 将完整的行程数据作为 JSON 存储到 plan_data 字段
    const sessionGroupId = body.sessionGroupId || body.session_group_id || crypto.randomUUID()
    
    const dbRecord: any = {
      user_id: session.user.id,
      session_group_id: sessionGroupId,
      
      // 冗余字段 (便于查询和列表显示)
      title: body.title,
      destination: body.destination,
      start_date: body.startDate || body.start_date || null,
      end_date: body.endDate || body.end_date || null,
      duration_days: body.durationDays || body.duration_days || body.days?.length || null,
      duration_nights: body.durationNights || body.duration_nights || (body.days?.length ? body.days.length - 1 : null),
      travelers: body.travelers || 1,
      
      // 🔥 核心: 完整的 JSON 数据存储在 plan_data
      plan_data: body,
      
      // 自然语言描述
      natural_plan: body.fullPlan || body.rawPlan || body.planDescription || '',
      
      // 冗余字段 (便于查询)
      total_budget: body.totalBudget || body.budget || 0,
      budget_per_person: body.budgetPerPerson || body.budget_per_person || null,
      estimated_cost: body.estimatedCost || body.estimated_cost || {},
      currency: body.currency || 'CNY',
      
      // 状态
      status: body.status || 'draft',
      version: body.version || 1,
    }

    // � 重构: 单表插入,无需处理关联表
    const { data: itinerary, error } = await supabase
      .from('itinerary_cards')
      .insert(dbRecord)
      .select()
      .single()

    if (error) {
      console.error('[API POST] Save itinerary card error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[API POST] Itinerary card saved successfully:', itinerary.id)

    // � 重构: 直接返回保存的数据 (plan_data 包含完整信息)
    const responseData = {
      id: itinerary.id,
      sessionGroupId: itinerary.session_group_id,
      ...itinerary.plan_data,
      // 确保元数据正确
      createdAt: itinerary.created_at,
      updatedAt: itinerary.updated_at,
    }
    
    console.log('[API] Returning full data with', responseData.days?.length || 0, 'days')
    
    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error('[API] POST itinerary card error:', error)
    return NextResponse.json(
      { error: error.message || '保存行程失败' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/itinerary-cards - 更新行程卡片
 * 🔄 重构: 使用新的 itinerary_cards 表 (JSON 存储)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    // 🔄 重构: 更新冗余字段和完整的 plan_data
    const dbRecord = {
      // 更新冗余字段
      title: updateData.title,
      destination: updateData.destination,
      start_date: updateData.startDate || updateData.start_date || null,
      end_date: updateData.endDate || updateData.end_date || null,
      duration_days: updateData.durationDays || updateData.duration_days || updateData.days?.length || null,
      duration_nights: updateData.durationNights || updateData.duration_nights || null,
      travelers: updateData.travelers,
      
      // 🔥 更新完整的 JSON 数据
      plan_data: updateData,
      
      // 更新自然语言描述
      natural_plan: updateData.fullPlan || updateData.rawPlan || updateData.planDescription || '',
      
      // 更新冗余查询字段
      total_budget: updateData.totalBudget || updateData.budget || 0,
      budget_per_person: updateData.budgetPerPerson || updateData.budget_per_person || null,
      estimated_cost: updateData.estimatedCost || updateData.estimated_cost || {},
      currency: updateData.currency || 'CNY',
      
      // 状态
      status: updateData.status,
      version: (updateData.version || 1) + 1,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('itinerary_cards')
      .update(dbRecord)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('[API PUT] Update itinerary card error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 返回更新后的完整数据
    const responseData = {
      id: data.id,
      sessionGroupId: data.session_group_id,
      ...data.plan_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error('[API] PUT itinerary card error:', error)
    return NextResponse.json(
      { error: error.message || '更新行程失败' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/itinerary-cards - 删除行程卡片
 * 🔄 重构: 使用新的 itinerary_cards 表
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少行程ID' }, { status: 400 })
    }

    // 🔄 重构: 从 itinerary_cards 表删除
    const { error } = await supabase
      .from('itinerary_cards')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('[API DELETE] Delete itinerary card error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API] DELETE itinerary card error:', error)
    return NextResponse.json(
      { error: error.message || '删除行程失败' },
      { status: 500 }
    )
  }
}
