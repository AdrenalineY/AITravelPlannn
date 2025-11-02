import type { ItineraryCard } from '@/types'

/**
 * 行程卡片服务 - 前端调用API
 */
class ItineraryCardService {
  private baseUrl = '/api/itinerary-cards'

  /**
   * 获取所有行程卡片
   */
  async getAll(): Promise<ItineraryCard[]> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '加载行程失败')
      }

      return await response.json()
    } catch (error: any) {
      console.error('[ItineraryCardService] getAll error:', error)
      throw error
    }
  }

  /**
   * 创建新的行程卡片
   */
  async create(itinerary: ItineraryCard): Promise<ItineraryCard> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itinerary),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '保存行程失败')
      }

      return await response.json()
    } catch (error: any) {
      console.error('[ItineraryCardService] create error:', error)
      throw error
    }
  }

  /**
   * 更新行程卡片
   */
  async update(itinerary: ItineraryCard): Promise<ItineraryCard> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itinerary),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '更新行程失败')
      }

      return await response.json()
    } catch (error: any) {
      console.error('[ItineraryCardService] update error:', error)
      throw error
    }
  }

  /**
   * 删除行程卡片
   */
  async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '删除行程失败')
      }
    } catch (error: any) {
      console.error('[ItineraryCardService] delete error:', error)
      throw error
    }
  }
}

export const itineraryCardService = new ItineraryCardService()
