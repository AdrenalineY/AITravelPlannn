import { createClient } from '@/lib/supabase/client'
import type { Itinerary, DayPlan, Activity } from '@/types'

class ItineraryService {
  /**
   * 保存行程到 Supabase
   */
  async saveItinerary(itinerary: Itinerary): Promise<Itinerary> {
    try {
      const supabase = createClient()
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) {
        throw new Error('用户未登录')
      }

      // 保存行程基本信息
      const { data: itineraryData, error: itineraryError } = await supabase
        .from('itineraries')
        .insert({
          id: itinerary.id,
          user_id: user.user.id,
          title: itinerary.title,
          destination: itinerary.destination,
          start_date: itinerary.startDate,
          end_date: itinerary.endDate,
          travelers: itinerary.travelers,
          budget: itinerary.budget,
          status: itinerary.status,
          created_at: itinerary.createdAt,
          updated_at: itinerary.updatedAt,
        })
        .select()
        .single()

      if (itineraryError) throw itineraryError

      // 保存每日行程
      for (const day of itinerary.days) {
        const { data: dayData, error: dayError } = await supabase
          .from('itinerary_days')
          .insert({
            id: day.id,
            itinerary_id: itinerary.id,
            date: day.date,
            summary: day.summary,
            total_cost: day.totalCost,
          })
          .select()
          .single()

        if (dayError) throw dayError

        // 保存活动
        if (day.activities && day.activities.length > 0) {
          const activities = day.activities.map((activity) => ({
            id: activity.id,
            day_id: day.id,
            order: activity.order,
            time: activity.time,
            poi_id: activity.poiId,
            poi_name: activity.poiName,
            address: activity.address,
            notes: activity.notes,
            cost: activity.cost,
          }))

          const { error: activitiesError } = await supabase
            .from('itinerary_activities')
            .insert(activities)

          if (activitiesError) throw activitiesError
        }
      }

      return itinerary
    } catch (error) {
      console.error('保存行程错误:', error)
      throw error
    }
  }

  /**
   * 加载用户的所有行程
   */
  async loadItineraries(userId: string): Promise<Itinerary[]> {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('itineraries')
        .select(`
          *,
          days:itinerary_days(
            *,
            activities:itinerary_activities(*)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map(this.mapToItinerary)
    } catch (error) {
      console.error('加载行程错误:', error)
      return []
    }
  }

  /**
   * 加载单个行程
   */
  async loadItinerary(itineraryId: string): Promise<Itinerary | null> {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('itineraries')
        .select(`
          *,
          days:itinerary_days(
            *,
            activities:itinerary_activities(*)
          )
        `)
        .eq('id', itineraryId)
        .single()

      if (error) throw error

      return data ? this.mapToItinerary(data) : null
    } catch (error) {
      console.error('加载行程错误:', error)
      return null
    }
  }

  /**
   * 更新行程
   */
  async updateItinerary(itineraryId: string, updates: Partial<Itinerary>): Promise<void> {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('itineraries')
        .update({
          title: updates.title,
          destination: updates.destination,
          start_date: updates.startDate,
          end_date: updates.endDate,
          travelers: updates.travelers,
          budget: updates.budget,
          status: updates.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itineraryId)

      if (error) throw error
    } catch (error) {
      console.error('更新行程错误:', error)
      throw error
    }
  }

  /**
   * 删除行程
   */
  async deleteItinerary(itineraryId: string): Promise<void> {
    try {
      const supabase = createClient()
      // 由于有外键级联删除,只需删除主记录
      const { error } = await supabase
        .from('itineraries')
        .delete()
        .eq('id', itineraryId)

      if (error) throw error
    } catch (error) {
      console.error('删除行程错误:', error)
      throw error
    }
  }

  /**
   * 更新活动
   */
  async updateActivity(activityId: string, updates: Partial<Activity>): Promise<void> {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('itinerary_activities')
        .update({
          time: updates.time,
          poi_name: updates.poiName,
          address: updates.address,
          notes: updates.notes,
          cost: updates.cost,
        })
        .eq('id', activityId)

      if (error) throw error
    } catch (error) {
      console.error('更新活动错误:', error)
      throw error
    }
  }

  /**
   * 添加活动
   */
  async addActivity(dayId: string, activity: Activity): Promise<void> {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('itinerary_activities')
        .insert({
          id: activity.id,
          day_id: dayId,
          order: activity.order,
          time: activity.time,
          poi_id: activity.poiId,
          poi_name: activity.poiName,
          address: activity.address,
          notes: activity.notes,
          cost: activity.cost,
        })

      if (error) throw error
    } catch (error) {
      console.error('添加活动错误:', error)
      throw error
    }
  }

  /**
   * 删除活动
   */
  async deleteActivity(activityId: string): Promise<void> {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('itinerary_activities')
        .delete()
        .eq('id', activityId)

      if (error) throw error
    } catch (error) {
      console.error('删除活动错误:', error)
      throw error
    }
  }

  /**
   * 映射数据库记录到 Itinerary 对象
   */
  private mapToItinerary(data: any): Itinerary {
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      destination: data.destination,
      startDate: data.start_date,
      endDate: data.end_date,
      travelers: data.travelers,
      budget: data.budget,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      preferences: { interestTags: [] },
      days: (data.days || []).map((day: any) => ({
        id: day.id,
        date: day.date,
        summary: day.summary || '',
        totalCost: day.total_cost || 0,
        activities: (day.activities || []).map((activity: any) => ({
          id: activity.id,
          order: activity.order,
          time: activity.time,
          poiId: activity.poi_id,
          poiName: activity.poi_name,
          address: activity.address,
          notes: activity.notes,
          cost: activity.cost,
        })),
        transportation: [],
      })),
    }
  }
}

export const itineraryService = new ItineraryService()
