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

    // 🔍 调试: 先检查 itinerary_days 表是否有数据
    const { data: allItineraries } = await supabase
      .from('itineraries')
      .select('id, title')
      .eq('user_id', session.user.id)
      .limit(1)
    
    if (allItineraries && allItineraries.length > 0) {
      const testId = allItineraries[0].id
      const { data: daysData, error: daysError } = await supabase
        .from('itinerary_days')
        .select('*')
        .eq('itinerary_id', testId)
    }

    // 从数据库加载行程卡片 (使用 itineraries 表,包含关联的 days 和 activities)
    const { data, error } = await supabase
      .from('itineraries')
      .select(`
        *,
        days:itinerary_days(
          *,
          segments:itinerary_activities(*)
        )
      `)
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
      durationDays: row.duration_days,  // 新增: 独立天数
      durationNights: row.duration_nights,  // 新增: 独立晚数
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
      // 🔧 修复: 转换 days 数据
      days: (row.days || []).map((day: any) => ({
        id: day.id,
        dayNumber: day.day_number,
        date: day.date,
        title: day.title,
        summary: day.summary,
        highlights: day.highlights || [],
        totalDistance: day.total_distance,
        totalDuration: day.total_duration,
        totalCost: day.total_cost,
        // 🔧 修复: 转换 segments (activities) 数据
        segments: (day.segments || []).map((activity: any) => ({
          id: activity.id,
          order: activity.order,
          time: activity.time,
          timePeriod: activity.time_period,  // 新增: 时段
          type: activity.activity_type,
          poiId: activity.poi_id,
          title: activity.poi_name,
          location: activity.poi_name,  // 兼容性
          coordinates: {
            lng: activity.location_lng,
            lat: activity.location_lat,
          },
          address: activity.address,
          category: activity.category,
          description: activity.description,
          notes: activity.notes,
          costEstimate: activity.cost,
          duration: activity.duration,
          rating: activity.rating,
          tips: activity.tips || [],
          distanceInfo: activity.distance_info || {},
          bookingInfo: activity.booking_info || {},
          // 新增: 用餐信息
          mealType: activity.meal_type,
          restaurant: activity.distance_info?.restaurant,
          cuisine: activity.distance_info?.cuisine,
          signature: activity.distance_info?.signature || [],
          // 新增: 交通信息
          transportMode: activity.transport_mode,
          transportDetails: activity.transport_details || {},
        })).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
      })).sort((a: any, b: any) => a.dayNumber - b.dayNumber),
      tips: row.tips || {},
      foodRecommendations: row.food_recommendations || [],
      shoppingSpots: row.shopping_spots || [],
      transportationSummary: row.transportation_summary || {},
      pendingQuestions: [], // 新表结构中没有此字段
      rawPlan: '', // 新表结构中没有此字段
      fullPlan: row.notes || '', // 使用 notes 字段
      planDescription: row.plan_description || '',  // 新增: 完整计划描述
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

    // 转换为数据库格式 (camelCase -> snake_case)
    // 注意: 
    // - id 字段不需要传,数据库会自动生成 UUID
    // - total_days 和 total_nights 是生成列,会自动计算
    // - 同时支持 camelCase 和 snake_case 输入格式
    const dbRecord: any = {
      // id 不传,让数据库自动生成 UUID
      session_id: body.sessionId || body.session_id || null,
      user_id: session.user.id,
      title: body.title,
      destination: body.destination,
      cities: body.cities || [],
      start_date: body.startDate || body.start_date || null,
      end_date: body.endDate || body.end_date || null,
      duration_days: body.durationDays || body.duration_days || null,  // 新增: 独立天数字段
      duration_nights: body.durationNights || body.duration_nights || null,  // 新增: 独立晚数字段
      travelers: body.travelers || 1,
      travelers_detail: body.travelersDetail || body.travelers_detail || {},
      preferences: body.preferences || [],
      travel_style: body.travelStyle || body.travel_style || null,
      special_requests: body.specialRequests || body.special_requests || [],
      theme: body.theme,
      budget: body.totalBudget || body.budget || 0, // 注意: 数据库字段是 budget
      budget_per_person: body.budgetPerPerson || body.budget_per_person || null,
      currency: body.currency || 'CNY',
      estimated_cost: body.estimatedCost || body.estimated_cost || {},
      accommodation: body.accommodation || {},
      tips: body.tips || {},
      food_recommendations: body.foodRecommendations || body.food_recommendations || [],
      shopping_spots: body.shoppingSpots || body.shopping_spots || [],
      transportation_summary: body.transportationSummary || body.transportation_summary || {},
      notes: body.fullPlan || body.rawPlan || body.notes || '', // 使用 notes 字段存储完整计划
      plan_description: body.planDescription || body.plan_description || null,  // 新增: 完整计划描述
      status: body.status || 'draft',
      tags: body.tags || [],
      cover_image: body.coverImage || body.cover_image || null,
      is_public: body.isPublic || body.is_public || false,
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
      for (let dayIndex = 0; dayIndex < body.days.length; dayIndex++) {
        const day = body.days[dayIndex]
        
        // 🔧 修复: 计算日期 - 如果没有提供date,基于startDate和dayNumber计算
        let dayDate = day.date
        if (!dayDate && itinerary.start_date) {
          const startDate = new Date(itinerary.start_date)
          startDate.setDate(startDate.getDate() + dayIndex)
          dayDate = startDate.toISOString().split('T')[0] // YYYY-MM-DD
        }
        
        // 如果还是没有日期,使用当前日期 + dayIndex
        if (!dayDate) {
          const today = new Date()
          today.setDate(today.getDate() + dayIndex)
          dayDate = today.toISOString().split('T')[0]
        }
        
        const dayInsertData = {
          itinerary_id: itinerary.id,
          day_number: day.dayNumber || dayIndex + 1,
          date: dayDate,
          title: day.title || `第${dayIndex + 1}天`,
          summary: day.summary,
          highlights: day.highlights || [],
          total_distance: day.totalDistance,
          total_duration: day.totalDuration,
          total_cost: day.segments?.reduce((sum: number, seg: any) => sum + (seg.costEstimate || 0), 0) || 0,
        }
        
        const { data: dayRecord, error: dayError } = await supabase
          .from('itinerary_days')
          .insert(dayInsertData)
          .select()
          .single()

        if (dayError) {
          console.error('[API POST] Save day error:', dayError)
          continue
        }

        // 插入活动数据
        if (day.segments && Array.isArray(day.segments) && day.segments.length > 0) {
          const activities = day.segments.map((segment: any) => {
            // 🔧 修复: 合并餐饮详情到 distance_info
            let distanceInfo = segment.distanceInfo || {}
            if (segment.type === 'meal') {
              distanceInfo = {
                ...distanceInfo,
                restaurant: segment.restaurant,
                cuisine: segment.cuisine,
                signature: segment.signature || [],
              }
            }
            
            // 🔧 修复: 合并交通详情
            if (segment.type === 'transport' && segment.transportDetails) {
              distanceInfo = {
                ...distanceInfo,
                ...segment.transportDetails,
              }
            }
            
            return {
              day_id: dayRecord.id,
              order: segment.order,
              time: segment.time,
              time_period: segment.timePeriod || segment.time_period || null,  // 新增: 时段
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
              distance_info: distanceInfo,
              booking_info: segment.bookingInfo || {},
              // 新增: 用餐信息
              meal_type: segment.mealType || segment.meal_type || null,
              // 新增: 交通信息
              transport_mode: segment.transportMode || segment.transport_mode || null,
              transport_details: segment.transportDetails || segment.transport_details || {},
            }
          })
          
          const { data: activitiesData, error: activitiesError } = await supabase
            .from('itinerary_activities')
            .insert(activities)
            .select()

          if (activitiesError) {
            console.error('[API POST] Save activities error:', activitiesError)
          }
        }
      }
    }
    
    // 🔧 查询完整数据(包括 days 和 activities)返回给前端
    const { data: fullItinerary, error: queryError } = await supabase
      .from('itineraries')
      .select(`
        *,
        days:itinerary_days(
          *,
          segments:itinerary_activities(*)
        )
      `)
      .eq('id', itinerary.id)
      .single()
    
    if (queryError) {
      console.error('[API] Query full itinerary error:', queryError)
      // 如果查询失败,至少返回主表数据
      return NextResponse.json({
        ...itinerary,
        totalBudget: itinerary.budget,
        budgetPerPerson: itinerary.budget_per_person,
        days: [],
      })
    }
    
    // 转换为前端格式
    const responseData = {
      id: fullItinerary.id,
      sessionId: fullItinerary.session_id,
      userId: fullItinerary.user_id,
      title: fullItinerary.title,
      destination: fullItinerary.destination,
      cities: fullItinerary.cities || [],
      startDate: fullItinerary.start_date,
      endDate: fullItinerary.end_date,
      totalDays: fullItinerary.total_days,
      totalNights: fullItinerary.total_nights,
      durationDays: fullItinerary.duration_days,
      durationNights: fullItinerary.duration_nights,
      travelers: fullItinerary.travelers,
      travelersDetail: fullItinerary.travelers_detail || {},
      preferences: fullItinerary.preferences || [],
      travelStyle: fullItinerary.travel_style,
      specialRequests: fullItinerary.special_requests || [],
      theme: fullItinerary.theme,
      totalBudget: fullItinerary.budget,
      budgetPerPerson: fullItinerary.budget_per_person,
      currency: fullItinerary.currency || 'CNY',
      estimatedCost: fullItinerary.estimated_cost || {},
      accommodation: fullItinerary.accommodation || {},
      // 🔧 修复: 转换 days 数据
      days: (fullItinerary.days || []).map((day: any) => ({
        id: day.id,
        dayNumber: day.day_number,
        date: day.date,
        title: day.title,
        summary: day.summary,
        highlights: day.highlights || [],
        totalDistance: day.total_distance,
        totalDuration: day.total_duration,
        totalCost: day.total_cost,
        // 🔧 修复: 转换 segments (activities) 数据
        segments: (day.segments || []).map((activity: any) => ({
          id: activity.id,
          order: activity.order,
          time: activity.time,
          timePeriod: activity.time_period,
          type: activity.activity_type,
          poiId: activity.poi_id,
          title: activity.poi_name,
          location: activity.poi_name,
          coordinates: {
            lng: activity.location_lng,
            lat: activity.location_lat,
          },
          address: activity.address,
          category: activity.category,
          description: activity.description,
          notes: activity.notes,
          costEstimate: activity.cost,
          duration: activity.duration,
          rating: activity.rating,
          tips: activity.tips || [],
          distanceInfo: activity.distance_info || {},
          bookingInfo: activity.booking_info || {},
          mealType: activity.meal_type,
          restaurant: activity.distance_info?.restaurant,
          cuisine: activity.distance_info?.cuisine,
          signature: activity.distance_info?.signature || [],
          transportMode: activity.transport_mode,
          transportDetails: activity.transport_details || {},
        })).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
      })).sort((a: any, b: any) => a.dayNumber - b.dayNumber),
      tips: fullItinerary.tips || {},
      foodRecommendations: fullItinerary.food_recommendations || [],
      shoppingSpots: fullItinerary.shopping_spots || [],
      transportationSummary: fullItinerary.transportation_summary || {},
      fullPlan: fullItinerary.notes || '',
      planDescription: fullItinerary.plan_description || '',
      status: fullItinerary.status || 'draft',
      tags: fullItinerary.tags || [],
      shareCode: fullItinerary.share_code,
      shareUrl: fullItinerary.share_code ? `/share/${fullItinerary.share_code}` : undefined,
      coverImage: fullItinerary.cover_image,
      isPublic: fullItinerary.is_public || false,
      createdAt: fullItinerary.created_at,
      updatedAt: fullItinerary.updated_at,
      version: fullItinerary.version || 1,
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
    // 注意: 
    // - total_days 和 total_nights 是生成列,会自动更新
    // - 同时支持 camelCase 和 snake_case 输入格式
    const dbRecord = {
      title: updateData.title,
      destination: updateData.destination,
      cities: updateData.cities || [],
      start_date: updateData.startDate || updateData.start_date || null,
      end_date: updateData.endDate || updateData.end_date || null,
      travelers: updateData.travelers,
      travelers_detail: updateData.travelersDetail || updateData.travelers_detail || {},
      preferences: updateData.preferences || [],
      travel_style: updateData.travelStyle || updateData.travel_style || null,
      special_requests: updateData.specialRequests || updateData.special_requests || [],
      theme: updateData.theme,
      budget: updateData.totalBudget || updateData.budget, // 注意: 数据库字段是 budget
      budget_per_person: updateData.budgetPerPerson || updateData.budget_per_person,
      currency: updateData.currency,
      estimated_cost: updateData.estimatedCost || updateData.estimated_cost || {},
      accommodation: updateData.accommodation || {},
      tips: updateData.tips || {},
      food_recommendations: updateData.foodRecommendations || updateData.food_recommendations || [],
      shopping_spots: updateData.shoppingSpots || updateData.shopping_spots || [],
      transportation_summary: updateData.transportationSummary || updateData.transportation_summary || {},
      notes: updateData.fullPlan || updateData.notes || '',
      status: updateData.status,
      tags: updateData.tags || [],
      cover_image: updateData.coverImage || updateData.cover_image,
      is_public: updateData.isPublic !== undefined ? updateData.isPublic : updateData.is_public,
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
