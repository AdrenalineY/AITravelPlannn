/**
 * 行程 JSON 转自然语言文本服务
 * 用于将结构化的 ItineraryCard 转换为大模型易于理解的自然语言描述
 * 作为继续编辑行程时的上下文输入给 Agent
 */

import type { ItineraryCard } from '@/types'
import { aiService } from './aiService'

export class ItineraryJsonToText {
  /**
   * 将 JSON 行程数据转换为自然语言文本
   * 直接通过拼接方式生成,不调用 LLM,速度快且可靠
   * @param itinerary - 完整的行程卡片数据
   * @returns 自然语言描述文本
   */
  static async convertToNaturalLanguage(itinerary: ItineraryCard): Promise<string> {
    console.log('[ItineraryJsonToText] 开始转换行程为自然语言(拼接方式)...')
    const startTime = Date.now()
    
    // 直接使用拼接方式生成,不调用 LLM
    const result = this.buildFallbackText(itinerary)
    
    console.log(`[ItineraryJsonToText] 转换完成,耗时 ${Date.now() - startTime}ms`)
    console.log(`[ItineraryJsonToText] 输出内容：${result}`)
    console.log(`[ItineraryJsonToText] 输出长度: ${result.length} 字符`)
    
    return result
  }

  // 注意: buildConversionPrompt 和 simplifyItineraryData 方法已移除
  // 现在直接使用 buildFallbackText 进行拼接,不再需要这些辅助方法

  /**
   * 构建完整的自然语言描述(拼接方式)
   * 不调用 LLM,直接通过模板拼接生成
   */
  private static buildFallbackText(itinerary: ItineraryCard): string {
    const lines: string[] = []

    // ========== 标题和概况 ==========
    lines.push(`# ${itinerary.title || '旅行行程'}`)
    lines.push('')
    
    // 基本信息
    let overview = `这是一份为期 ${itinerary.durationDays} 天 ${itinerary.durationNights} 晚的${itinerary.destination}旅行计划`
    if (itinerary.travelers) {
      overview += `,适合 ${itinerary.travelers} 人出行`
    }
    if (itinerary.totalBudget) {
      overview += `,总预算约 ${itinerary.totalBudget} 元 (人均 ${itinerary.budgetPerPerson} 元)`
    }
    lines.push(overview + '。')
    
    // 主题和偏好
    if (itinerary.theme) {
      lines.push(`行程主题: ${itinerary.theme}`)
    }
    if (itinerary.preferences && itinerary.preferences.length > 0) {
      lines.push(`旅行偏好: ${itinerary.preferences.join('、')}`)
    }
    if (itinerary.travelStyle) {
      lines.push(`旅行风格: ${itinerary.travelStyle}`)
    }
    lines.push('')

    // ========== 住宿安排 ==========
    if (itinerary.accommodation) {
      const acc = itinerary.accommodation
      lines.push(`## 住宿安排`)
      if ('region' in acc) {
        lines.push(`住宿区域: ${acc.region}`)
        if (acc.type) lines.push(`酒店类型: ${acc.type}`)
        if (acc.recommendations && acc.recommendations.length > 0) {
          lines.push('')
          lines.push(`推荐酒店:`)
          acc.recommendations.forEach(hotel => {
            lines.push(`- **${hotel.name}** (${hotel.location})`)
            lines.push(`  价格: ${hotel.pricePerNight} 元/晚 × ${hotel.totalNights} 晚 = ${hotel.totalCost} 元`)
            if (hotel.rating) lines.push(`  评分: ${hotel.rating} 分`)
            if (hotel.amenities && hotel.amenities.length > 0) {
              lines.push(`  设施: ${hotel.amenities.join('、')}`)
            }
          })
        }
      }
      lines.push('')
    }

    // ========== 每日行程详情 ==========
    if (itinerary.days && itinerary.days.length > 0) {
      itinerary.days.forEach(day => {
        lines.push(`## 第 ${day.dayNumber} 天 (${day.date}): ${day.title || ''}`)
        
        if (day.summary) {
          lines.push(`📋 ${day.summary}`)
        }
        
        if (day.highlights && day.highlights.length > 0) {
          lines.push(`✨ 今日亮点: ${day.highlights.join('、')}`)
        }
        
        lines.push('')

        if (day.segments && day.segments.length > 0) {
          day.segments.forEach((seg, idx) => {
            // 根据类型添加图标
            let icon = '📍'
            if (seg.type === 'transport') icon = '🚗'
            else if (seg.type === 'meal') icon = '🍽️'
            else if (seg.type === 'activity') icon = '🎯'
            else if (seg.type === 'accommodation') icon = '🏨'
            else if (seg.type === 'rest') icon = '💤'
            
            // 主标题行
            let segLine = `${icon} **${seg.time || ''}**: ${seg.title}`
            lines.push(segLine)

            // 地点信息
            if (seg.location) {
              lines.push(`   📍 地点: ${seg.location}`)
            }
            if (seg.address) {
              lines.push(`   📮 地址: ${seg.address}`)
            }

            // 描述信息
            if (seg.description) {
              lines.push(`   💬 ${seg.description}`)
            }

            // 交通信息
            if (seg.type === 'transport') {
              if (seg.transportMode) {
                const modeNames: Record<string, string> = {
                  walk: '步行', subway: '地铁', bus: '公交', taxi: '出租车',
                  car: '自驾', train: '火车', flight: '飞机', bike: '骑行'
                }
                lines.push(`   🚗 交通方式: ${modeNames[seg.transportMode] || seg.transportMode}`)
              }
              if (seg.transportDetails) {
                const td = seg.transportDetails
                if (td.from && td.to) {
                  lines.push(`   🔄 ${td.from} → ${td.to}`)
                }
                if (td.duration) lines.push(`   ⏱️  耗时: ${td.duration}`)
                if (td.distance) lines.push(`   📏 距离: ${td.distance}`)
                if (td.notes) lines.push(`   💡 ${td.notes}`)
              } else if (seg.distanceInfo) {
                const di = seg.distanceInfo
                lines.push(`   🔄 ${di.from} → ${di.to}`)
                if (di.duration) lines.push(`   ⏱️  耗时: ${di.duration}`)
                if (di.distance) lines.push(`   📏 距离: ${di.distance}`)
              }
            }

            // 餐饮信息
            if (seg.type === 'meal') {
              if (seg.mealType) {
                const mealTypeNames: Record<string, string> = {
                  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '小吃'
                }
                lines.push(`   🍽️  类型: ${mealTypeNames[seg.mealType] || seg.mealType}`)
              }
              if (seg.cuisine) {
                lines.push(`   🥘 菜系: ${seg.cuisine}`)
              }
              if (seg.signature && seg.signature.length > 0) {
                lines.push(`   ⭐ 推荐菜品: ${seg.signature.join('、')}`)
              }
            }

            // 时长
            if (seg.duration) {
              const hours = Math.floor(seg.duration / 60)
              const mins = seg.duration % 60
              let durationText = ''
              if (hours > 0) durationText += `${hours}小时`
              if (mins > 0) durationText += `${mins}分钟`
              lines.push(`   ⏱️  时长: ${durationText}`)
            }

            // 费用信息
            if (seg.costEstimate !== undefined && seg.costEstimate > 0) {
              const categoryNames: Record<string, string> = {
                transport: '交通费', ticket: '门票费', accommodation: '住宿费',
                meal: '餐饮费', shopping: '购物费'
              }
              const categoryName = seg.costCategory ? categoryNames[seg.costCategory] || '费用' : '费用'
              lines.push(`   💰 ${categoryName}: ${seg.costEstimate} 元`)
            }

            // 评分
            if (seg.rating) {
              lines.push(`   ⭐ 评分: ${seg.rating} 分`)
            }

            // 小贴士
            if (seg.tips && seg.tips.length > 0) {
              lines.push(`   💡 小贴士:`)
              seg.tips.forEach(tip => {
                lines.push(`      - ${tip}`)
              })
            }

            // 预订信息
            if (seg.bookingInfo && seg.bookingInfo.required) {
              lines.push(`   📅 需要预订: ${seg.bookingInfo.advanceTime || '提前预订'}`)
            }

            lines.push('') // 每个 segment 之间空行
          })
        }
      })
    }

    // 费用预算
    if (itinerary.estimatedCost) {
      lines.push(`## 费用预算`)
      lines.push(`总计: ${itinerary.estimatedCost.total} 元 (人均 ${itinerary.estimatedCost.perPerson} 元)`)
      lines.push('')
      
      if (itinerary.estimatedCost.breakdown) {
        lines.push(`费用明细:`)
        itinerary.estimatedCost.breakdown.forEach(item => {
          const categoryName = this.getCategoryName(item.category)
          lines.push(`- ${categoryName}: ${item.amount} 元 (${item.percentage}%)`)
        })
        lines.push('')
      }
    }

    // 实用提示
    if (itinerary.tips) {
      lines.push(`## 实用提示`)
      Object.entries(itinerary.tips).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          lines.push(`**${this.getTipCategoryName(key)}**:`)
          value.forEach(tip => lines.push(`- ${tip}`))
        } else if (typeof value === 'string' && value) {
          lines.push(`**${this.getTipCategoryName(key)}**: ${value}`)
        }
      })
      lines.push('')
    }

    // 美食推荐
    if (itinerary.foodRecommendations && itinerary.foodRecommendations.length > 0) {
      lines.push(`## 美食推荐`)
      itinerary.foodRecommendations.forEach(food => {
        lines.push(`- ${food.name} (${food.location || ''}) - 人均 ${food.avgCost || '?'} 元`)
        if (food.signature && food.signature.length > 0) {
          lines.push(`  招牌菜: ${food.signature.join('、')}`)
        }
        if (food.mustTry) {
          lines.push(`  推荐指数: ⭐⭐⭐⭐⭐`)
        }
      })
      lines.push('')
    }

    return lines.join('\n')
  }

  /**
   * 获取费用类别中文名称
   */
  private static getCategoryName(category: string): string {
    const names: Record<string, string> = {
      transport: '交通',
      ticket: '门票',
      accommodation: '住宿',
      meal: '餐饮',
      shopping: '购物'
    }
    return names[category] || category
  }

  /**
   * 获取提示类别中文名称
   */
  private static getTipCategoryName(key: string): string {
    const names: Record<string, string> = {
      bestTime: '最佳时间',
      weather: '天气提示',
      transportation: '交通建议',
      accommodation: '住宿建议',
      food: '美食推荐',
      packing: '行李清单',
      safety: '安全提示',
      cultural: '文化习俗',
      attractions: '景点提示'
    }
    return names[key] || key
  }

  /**
   * 快速转换(用于测试或预览)
   * 直接使用降级方案,不调用 AI
   */
  static convertToNaturalLanguageSync(itinerary: ItineraryCard): string {
    return this.buildFallbackText(itinerary)
  }
}

export const itineraryJsonToText = ItineraryJsonToText
