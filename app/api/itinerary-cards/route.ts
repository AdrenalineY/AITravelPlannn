import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/itinerary-cards - 获取用户的所有行程卡片
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    // 从数据库加载行程卡片 (使用 itineraries 表)
    const { data, error } = await supabase
      .from('itineraries')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[API] Load itinerary cards error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 转换数据库字段为前端格式 (snake_case -> camelCase)
    const itineraries = data.map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      title: row.title,
      destination: row.destination,
      cities: row.cities || [],
      startDate: row.start_date,
      endDate: row.end_date,
      totalDays: row.total_days,
      totalNights: row.total_nights,
      travelers: row.travelers,
      travelersDetail: row.travelers_detail || {},
      preferences: row.preferences || [],
      travelStyle: row.travel_style,
      specialRequests: row.special_requests || [],
      theme: row.theme,
      totalBudget: row.budget, // 注意: 数据库字段是 budget
      budgetPerPerson: row.budget_per_person,
      currency: row.currency || 'CNY',
      estimatedCost: row.estimated_cost || {},
      accommodation: row.accommodation || {},
      days: [], // 暂时返回空数组,后续通过子表查询
      tips: row.tips || {},
      foodRecommendations: row.food_recommendations || [],
      shoppingSpots: row.shopping_spots || [],
      transportationSummary: row.transportation_summary || {},
      pendingQuestions: [], // 新表结构中没有此字段
      rawPlan: '', // 新表结构中没有此字段
      fullPlan: row.notes || '', // 使用 notes 字段
      status: row.status || 'draft',
      tags: row.tags || [],
      shareUrl: row.share_code ? `/share/${row.share_code}` : undefined,
      coverImage: row.cover_image,
      isPublic: row.is_public || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version || 1,
    }))

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
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json()
    
    console.log('[API] Creating itinerary with data:', JSON.stringify(body, null, 2))

    // 转换为数据库格式 (camelCase -> snake_case)
    // 注意: 
    // - id 字段不需要传,数据库会自动生成 UUID
    // - total_days 和 total_nights 是生成列,会自动计算
    const dbRecord: any = {
      // id 不传,让数据库自动生成 UUID
      session_id: body.sessionId || null,
      user_id: session.user.id,
      title: body.title,
      destination: body.destination,
      cities: body.cities || [],
      start_date: body.startDate,
      end_date: body.endDate,
      travelers: body.travelers || 1,
      travelers_detail: body.travelersDetail || {},
      preferences: body.preferences || [],
      travel_style: body.travelStyle,
      special_requests: body.specialRequests || [],
      theme: body.theme,
      budget: body.totalBudget || 0, // 注意: 数据库字段是 budget
      budget_per_person: body.budgetPerPerson,
      currency: body.currency || 'CNY',
      estimated_cost: body.estimatedCost || {},
      accommodation: body.accommodation || {},
      tips: body.tips || {},
      food_recommendations: body.foodRecommendations || [],
      shopping_spots: body.shoppingSpots || [],
      transportation_summary: body.transportationSummary || {},
      notes: body.fullPlan || body.rawPlan || '', // 使用 notes 字段存储完整计划
      status: body.status || 'draft',
      tags: body.tags || [],
      cover_image: body.coverImage,
      is_public: body.isPublic || false,
      version: body.version || 1,
    }

    // 插入主表
    const { data: itinerary, error } = await supabase
      .from('itineraries')
      .insert(dbRecord)
      .select()
      .single()

    if (error) {
      console.error('[API] Save itinerary error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 插入天数和活动数据
    if (body.days && Array.isArray(body.days) && body.days.length > 0) {
      for (const day of body.days) {
        const { data: dayRecord, error: dayError } = await supabase
          .from('itinerary_days')
          .insert({
            itinerary_id: itinerary.id,
            date: day.date,
            title: day.title,
            summary: day.summary,
            highlights: day.highlights || [],
            total_distance: day.totalDistance,
            total_duration: day.totalDuration,
            total_cost: day.segments?.reduce((sum: number, seg: any) => sum + (seg.costEstimate || 0), 0) || 0,
          })
          .select()
          .single()

        if (dayError) {
          console.error('[API] Save day error:', dayError)
          continue
        }

        // 插入活动数据
        if (day.segments && Array.isArray(day.segments) && day.segments.length > 0) {
          const activities = day.segments.map((segment: any) => ({
            day_id: dayRecord.id,
            order: segment.order,
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
            console.error('[API] Save activities error:', activitiesError)
          }
        }
      }
    }

    console.log('[API] Itinerary created successfully:', itinerary.id)
    return NextResponse.json({
      ...itinerary,
      // 转换回前端格式
      totalBudget: itinerary.budget,
      budgetPerPerson: itinerary.budget_per_person,
    })
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

    // 转换为数据库格式 (camelCase -> snake_case)
    // 注意: total_days 和 total_nights 是生成列,会自动更新
    const dbRecord = {
      title: updateData.title,
      destination: updateData.destination,
      cities: updateData.cities || [],
      start_date: updateData.startDate,
      end_date: updateData.endDate,
      travelers: updateData.travelers,
      travelers_detail: updateData.travelersDetail || {},
      preferences: updateData.preferences || [],
      travel_style: updateData.travelStyle,
      special_requests: updateData.specialRequests || [],
      theme: updateData.theme,
      budget: updateData.totalBudget, // 注意: 数据库字段是 budget
      budget_per_person: updateData.budgetPerPerson,
      currency: updateData.currency,
      estimated_cost: updateData.estimatedCost || {},
      accommodation: updateData.accommodation || {},
      tips: updateData.tips || {},
      food_recommendations: updateData.foodRecommendations || [],
      shopping_spots: updateData.shoppingSpots || [],
      transportation_summary: updateData.transportationSummary || {},
      notes: updateData.fullPlan || '',
      status: updateData.status,
      tags: updateData.tags || [],
      cover_image: updateData.coverImage,
      is_public: updateData.isPublic,
      version: (updateData.version || 1) + 1,
    }

    const { data, error } = await supabase
      .from('itineraries')
      .update(dbRecord)
      .eq('id', id)
      .eq('user_id', session.user.id) // 确保用户只能更新自己的行程
      .select()
      .single()

    if (error) {
      console.error('[API] Update itinerary card error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
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

    const { error } = await supabase
      .from('itineraries')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id) // 确保用户只能删除自己的行程 (CASCADE 会自动删除子表)

    if (error) {
      console.error('[API] Delete itinerary card error:', error)
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
