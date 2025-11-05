/**
 * Itinerary Card Service - 行程卡片服务
 * 🔄 重构: 使用新的 itinerary_cards 表和 JSON 存储
 */

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ItineraryCard } from '@/types'

/**
 * 保存行程卡片到 Supabase (独立函数，用于后端API)
 * @param supabase - Supabase客户端实例
 * @param userId - 用户ID
 * @param sessionGroupId - 会话分组ID
 * @param itineraryCard - 完整的行程卡片数据（JSON格式）
 */
export async function saveItineraryCard(
  supabase: SupabaseClient,
  userId: string,
  sessionGroupId: string,
  itineraryCard: ItineraryCard
): Promise<ItineraryCard & { id: string }> {
  try {
    // 🔥 核心: 将完整的 ItineraryCard 存储为 JSON
    const { data, error } = await supabase
      .from('itinerary_cards')
      .upsert({
        user_id: userId,
        session_group_id: sessionGroupId,
        
        // 基本信息（冗余存储，便于查询）
        title: itineraryCard.title,
        destination: itineraryCard.destination,
        start_date: itineraryCard.startDate,
        end_date: itineraryCard.endDate,
        duration_days: itineraryCard.durationDays,
        duration_nights: itineraryCard.durationNights,
        travelers: itineraryCard.travelers,
        
        // 🔥 完整的结构化数据
        plan_data: itineraryCard,
        
        // 自然语言描述
        natural_plan: itineraryCard.fullPlan || itineraryCard.rawPlan,
        
        // 冗余字段（便于查询）
        total_budget: itineraryCard.totalBudget || 0,
        budget_per_person: itineraryCard.budgetPerPerson || 0,
        estimated_cost: itineraryCard.estimatedCost || {},
        currency: itineraryCard.currency || 'CNY',
        
        // 状态
        status: itineraryCard.status || 'draft',
        version: itineraryCard.version || 1,
        
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_group_id' // 基于 session_group_id 更新
      })
      .select()
      .single()

    if (error) {
      console.error('[saveItineraryCard] 保存失败:', error)
      throw error
    }

    console.log('[saveItineraryCard] 保存成功:', data?.id)
    return { ...data.plan_data as ItineraryCard, id: data.id }
  } catch (error) {
    console.error('[saveItineraryCard] 保存行程错误:', error)
    throw error
  }
}

class ItineraryCardServiceNew {
  /**
   * 保存行程卡片到 Supabase (前端调用)
   * @param itineraryCard - 完整的行程卡片数据（JSON格式）
   * @param sessionGroupId - 会话分组ID
   */
  async saveItineraryCard(
    itineraryCard: ItineraryCard,
    sessionGroupId: string
  ): Promise<ItineraryCard> {
    try {
      const supabase = createClient()
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) {
        throw new Error('用户未登录')
      }

      // 🔥 核心: 将完整的 ItineraryCard 存储为 JSON
      const { data, error } = await supabase
        .from('itinerary_cards')
        .upsert({
          user_id: user.user.id,
          session_group_id: sessionGroupId,
          
          // 基本信息（冗余存储，便于查询）
          title: itineraryCard.title,
          destination: itineraryCard.destination,
          start_date: itineraryCard.startDate,
          end_date: itineraryCard.endDate,
          duration_days: itineraryCard.durationDays,
          duration_nights: itineraryCard.durationNights,
          travelers: itineraryCard.travelers,
          
          // 🔥 完整的结构化数据
          plan_data: itineraryCard,
          
          // 自然语言描述
          natural_plan: itineraryCard.fullPlan || itineraryCard.rawPlan,
          
          // 冗余字段（便于查询）
          total_budget: itineraryCard.totalBudget || 0,
          budget_per_person: itineraryCard.budgetPerPerson || 0,
          estimated_cost: itineraryCard.estimatedCost || {},
          currency: itineraryCard.currency || 'CNY',
          
          // 状态
          status: itineraryCard.status || 'draft',
          version: itineraryCard.version || 1,
          
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_group_id' // 基于 session_group_id 更新
        })
        .select()
        .single()

      if (error) {
        console.error('[ItineraryCardService] 保存失败:', error)
        throw error
      }

      console.log('[ItineraryCardService] 保存成功:', data?.id)
      // 返回完整数据，包含数据库行 ID
      return {
        ...(data.plan_data as ItineraryCard),
        id: data.id,
        sessionGroupId: data.session_group_id
      }
    } catch (error) {
      console.error('[ItineraryCardService] 保存行程错误:', error)
      throw error
    }
  }

  /**
   * 加载用户的所有行程卡片
   */
  async loadItineraryCards(userId?: string): Promise<ItineraryCard[]> {
    try {
      const supabase = createClient()
      
      let query = supabase
        .from('itinerary_cards')
        .select('*')
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        const { data: user } = await supabase.auth.getUser()
        if (!user.user) {
          return []
        }
        query = query.eq('user_id', user.user.id)
      }

      const { data, error } = await query

      if (error) {
        console.error('[ItineraryCardService] 加载失败:', error)
        throw error
      }

      // 🔥 返回 plan_data 并附加数据库行 ID 和 sessionGroupId
      return (data || []).map(card => ({
        ...(card.plan_data as ItineraryCard),
        id: card.id,  // 使用数据库行 ID
        sessionGroupId: card.session_group_id  // 确保 sessionGroupId 存在
      }))
    } catch (error) {
      console.error('[ItineraryCardService] 加载行程错误:', error)
      return []
    }
  }

  /**
   * 加载单个行程卡片（通过 session_group_id）
   */
  async loadItineraryCardBySessionId(sessionGroupId: string): Promise<ItineraryCard | null> {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('itinerary_cards')
        .select('*')
        .eq('session_group_id', sessionGroupId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 未找到记录
          return null
        }
        throw error
      }

      return data ? {
        ...(data.plan_data as ItineraryCard),
        id: data.id,  // 使用数据库行 ID
        sessionGroupId: data.session_group_id
      } : null
    } catch (error) {
      console.error('[ItineraryCardService] 加载行程错误:', error)
      return null
    }
  }

  /**
   * 加载单个行程卡片（通过 ID）
   */
  async loadItineraryCard(itineraryId: string): Promise<ItineraryCard | null> {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('itinerary_cards')
        .select('*')
        .eq('id', itineraryId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      return data ? {
        ...(data.plan_data as ItineraryCard),
        id: data.id,  // 使用数据库行 ID
        sessionGroupId: data.session_group_id
      } : null
    } catch (error) {
      console.error('[ItineraryCardService] 加载行程错误:', error)
      return null
    }
  }

  /**
   * 更新行程卡片
   */
  async updateItineraryCard(
    sessionGroupId: string,
    updates: Partial<ItineraryCard>
  ): Promise<void> {
    try {
      const supabase = createClient()
      
      // 先获取现有数据
      const existing = await this.loadItineraryCardBySessionId(sessionGroupId)
      if (!existing) {
        throw new Error('行程不存在')
      }

      // 合并更新
      const updatedPlanData = { ...existing, ...updates }

      const { error } = await supabase
        .from('itinerary_cards')
        .update({
          plan_data: updatedPlanData,
          title: updatedPlanData.title,
          destination: updatedPlanData.destination,
          start_date: updatedPlanData.startDate,
          end_date: updatedPlanData.endDate,
          total_budget: updatedPlanData.totalBudget,
          updated_at: new Date().toISOString()
        })
        .eq('session_group_id', sessionGroupId)

      if (error) throw error
    } catch (error) {
      console.error('[ItineraryCardService] 更新行程错误:', error)
      throw error
    }
  }

  /**
   * 删除行程卡片
   */
  async deleteItineraryCard(itineraryId: string): Promise<void> {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('itinerary_cards')
        .delete()
        .eq('id', itineraryId)

      if (error) throw error
    } catch (error) {
      console.error('[ItineraryCardService] 删除行程错误:', error)
      throw error
    }
  }

  /**
   * 根据会话ID删除行程
   */
  async deleteItineraryCardBySession(sessionGroupId: string): Promise<void> {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('itinerary_cards')
        .delete()
        .eq('session_group_id', sessionGroupId)

      if (error) throw error
    } catch (error) {
      console.error('[ItineraryCardService] 删除行程错误:', error)
      throw error
    }
  }

  // 🔄 兼容方法: 为旧代码提供向后兼容接口
  async getAll(): Promise<ItineraryCard[]> {
    return this.loadItineraryCards()
  }

  async create(itineraryCard: ItineraryCard): Promise<ItineraryCard> {
    const sessionGroupId = itineraryCard.sessionGroupId || crypto.randomUUID()
    return this.saveItineraryCard(itineraryCard, sessionGroupId)
  }

  async update(itineraryCard: ItineraryCard): Promise<void> {
    if (!itineraryCard.sessionGroupId) {
      throw new Error('sessionGroupId is required for update')
    }
    await this.updateItineraryCard(itineraryCard.sessionGroupId, itineraryCard)
  }

  async delete(id: string): Promise<void> {
    await this.deleteItineraryCard(id)
  }
}

// 🔄 重构: 导出统一的实例名称
export const itineraryCardService = new ItineraryCardServiceNew()
export const itineraryCardServiceNew = itineraryCardService  // 向后兼容别名
