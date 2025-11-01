/**
 * Agent Tools - 为 ReAct Agent 提供的工具集
 * 对应 Python 版本中的 TravelTools 类
 */

import {
  DistanceToolInput,
  DistanceToolOutput,
  POISearchInput,
  POISearchOutput,
  CostEstimateInput,
  CostEstimateOutput,
  ToolResult,
  ItineraryCard
} from '@/types'
import { mapService } from './mapService'
import { aiService } from './aiService'

export class AgentTools {
  /**
   * 计算两地距离和交通信息
   * 对应 Python 版本的 calculate_distance
   */
  static async calculateDistance(
    origin: string,
    destination: string,
    mode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving'
  ): Promise<ToolResult> {
    const startTime = Date.now()
    try {
      console.log(`[AgentTools] calculateDistance: ${origin} -> ${destination} (${mode})`)

      // 先将地址转换为坐标
      const originLoc = await mapService.geocode(origin)
      const destLoc = await mapService.geocode(destination)

      if (!originLoc || !destLoc) {
        return {
          observation: `无法解析地址: ${!originLoc ? origin : destination}`,
          error: 'Geocoding failed'
        }
      }

      // 调用高德地图服务获取路线信息
      const routeInfo = await mapService.planRoute(originLoc, destLoc, mode)

      if (!routeInfo) {
        return {
          observation: `无法获取从 ${origin} 到 ${destination} 的路线信息`,
          error: 'No route found'
        }
      }

      const distanceKm = (routeInfo.distance / 1000).toFixed(1)
      const durationMin = Math.ceil(routeInfo.duration / 60)

      // 估算交通费用
      let cost = '未知'
      if (mode === 'driving') {
        // 按油费+过路费估算,约 1 元/公里
        cost = `约 ${Math.ceil(parseFloat(distanceKm))} 元`
      } else if (mode === 'transit') {
        // 公共交通按距离估算,约 0.3 元/公里
        cost = `约 ${Math.ceil(parseFloat(distanceKm) * 0.3)} 元`
      } else if (mode === 'walking') {
        cost = '免费'
      }

      const output: DistanceToolOutput = {
        distance: `${distanceKm} km`,
        duration: `${durationMin} 分钟`,
        cost,
        mode
      }

      const observation = `从 ${origin} 到 ${destination} ${mode === 'driving' ? '驾车' : mode === 'transit' ? '乘坐公交' : mode === 'walking' ? '步行' : '骑行'}约 ${distanceKm} 公里,需要 ${durationMin} 分钟,费用${cost}`

      console.log(`[AgentTools] calculateDistance completed in ${Date.now() - startTime}ms`)

      return {
        observation,
        payload: output
      }
    } catch (error: any) {
      console.error('[AgentTools] calculateDistance error:', error)
      return {
        observation: `计算距离时出错: ${error.message}`,
        error: error.message
      }
    }
  }

  /**
   * 搜索附近的景点、餐饮或住宿
   * 对应 Python 版本的 search_nearby
   */
  static async searchNearby(
    location: string,
    category: 'attraction' | 'restaurant' | 'hotel',
    radius: number = 5000,
    keyword?: string
  ): Promise<ToolResult> {
    const startTime = Date.now()
    try {
      console.log(`[AgentTools] searchNearby: ${location}, ${category}, ${radius}m`)

      // 映射类别到高德地图的类型
      const typeMap: Record<string, string> = {
        attraction: '风景名胜|公园广场|文物古迹',
        restaurant: '中餐厅|外国餐厅|快餐厅|咖啡厅',
        hotel: '宾馆酒店|旅馆招待所'
      }

      const searchKeyword = keyword || typeMap[category]
      
      // 先获取位置坐标(如果是地址)
      let searchLocation = undefined
      const locationCoords = await mapService.geocode(location)
      if (locationCoords) {
        searchLocation = locationCoords
      }

      const results = await mapService.searchPOI(searchKeyword, searchLocation, location)

      if (!results || results.length === 0) {
        return {
          observation: `在 ${location} 附近未找到 ${category} 相关信息`,
          payload: { location, category, results: [], count: 0 }
        }
      }

      // 限制返回前5个结果
      const limitedResults = results.slice(0, 5).map(poi => ({
        name: poi.name,
        type: poi.category || '未分类',
        address: poi.address,
        rating: poi.rating || (4.0 + Math.random() * 0.9),
        priceLevel: category === 'hotel' ? '中等' : undefined,
        priceRange: category === 'hotel' ? '300-600元' : undefined
      }))

      const output: POISearchOutput = {
        location,
        category,
        results: limitedResults,
        count: limitedResults.length
      }

      const categoryName = category === 'attraction' ? '景点' : category === 'restaurant' ? '餐饮' : '住宿'
      const resultsList = limitedResults.map(r => `${r.name}(${r.type})`).join('、')
      const observation = `在 ${location} 附近找到 ${limitedResults.length} 个${categoryName}: ${resultsList}`

      console.log(`[AgentTools] searchNearby completed in ${Date.now() - startTime}ms`)

      return {
        observation,
        payload: output
      }
    } catch (error: any) {
      console.error('[AgentTools] searchNearby error:', error)
      return {
        observation: `搜索附近地点时出错: ${error.message}`,
        error: error.message
      }
    }
  }

  /**
   * 估算费用
   * 对应 Python 版本的 estimate_cost
   */
  static async estimateCost(
    itemType: string,
    details: any
  ): Promise<ToolResult> {
    const startTime = Date.now()
    try {
      console.log(`[AgentTools] estimateCost: ${itemType}`, details)

      // 构造估价 prompt
      const prompt = `你是一个旅行预算估算专家。请根据以下信息估算费用:

项目类型: ${itemType}
详细信息: ${typeof details === 'string' ? details : JSON.stringify(details, null, 2)}

请以 JSON 格式返回估算结果,包含:
- estimatedCost: 估算金额(如"1500-2500元")
- details: 详细说明
- reasoning: 估算理由
- currency: 货币单位(默认"CNY")

示例输出:
{
  "estimatedCost": "1500-2500元",
  "details": "包含5天餐饮费用,中等餐厅",
  "reasoning": "基于餐饮的标准市场价格估算",
  "currency": "CNY"
}`

      const response = await aiService.chat([
        { role: 'system', content: '你是一个专业的旅行预算分析师,提供准确的费用估算。' },
        { role: 'user', content: prompt }
      ])

      // 尝试解析 JSON
      let estimateData: any
      try {
        // 提取 JSON 部分
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          estimateData = JSON.parse(jsonMatch[0])
        } else {
          // 如果没有JSON,手动构造
          estimateData = {
            estimatedCost: '费用待估算',
            details: response,
            reasoning: '基于AI分析'
          }
        }
      } catch (e) {
        estimateData = {
          estimatedCost: '费用待估算',
          details: response,
          reasoning: '基于AI分析'
        }
      }

      const output: CostEstimateOutput = {
        item: itemType,
        estimatedCost: estimateData.estimatedCost || '待估算',
        details: estimateData.details,
        reasoning: estimateData.reasoning || '基于市场价格估算',
        currency: estimateData.currency || 'CNY'
      }

      const observation = `${itemType}的费用估算为 ${output.estimatedCost},${output.details || ''}。${output.reasoning}`

      console.log(`[AgentTools] estimateCost completed in ${Date.now() - startTime}ms`)

      return {
        observation,
        payload: output
      }
    } catch (error: any) {
      console.error('[AgentTools] estimateCost error:', error)
      return {
        observation: `估算费用时出错: ${error.message}`,
        error: error.message
      }
    }
  }

  /**
   * 从自然语言计划中提取结构化数据
   * 对应 Python 版本的 extract_plan_structure
   */
  static async extractPlanStructure(
    naturalLanguagePlan: string,
    context: {
      destination?: string
      travelers?: number
      budget?: number
      startDate?: string
      endDate?: string
    } = {}
  ): Promise<ItineraryCard | null> {
    try {
      console.log('[AgentTools] extractPlanStructure')

      const prompt = `你是一个数据格式化专家。请将以下旅行计划转换为结构化的 JSON 格式。

旅行计划内容:
${naturalLanguagePlan}

已知上下文:
- 目的地: ${context.destination || '未知'}
- 人数: ${context.travelers || '未知'}
- 预算: ${context.budget || '未知'}
- 开始日期: ${context.startDate || '未知'}
- 结束日期: ${context.endDate || '未知'}

请严格按照以下 TypeScript 接口格式输出 JSON(只输出JSON,不要其他文字):

{
  "title": "旅行标题",
  "destination": "目的地",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "travelers": 人数,
  "preferences": ["偏好1", "偏好2"],
  "totalBudget": 预算金额,
  "estimatedCost": {
    "total": 总估算,
    "breakdown": [
      {"category": "transport", "amount": 金额, "notes": "说明"},
      {"category": "accommodation", "amount": 金额},
      {"category": "food", "amount": 金额},
      {"category": "activity", "amount": 金额}
    ]
  },
  "days": [
    {
      "date": "YYYY-MM-DD",
      "summary": "当天概要",
      "segments": [
        {
          "time": "09:00",
          "type": "activity",
          "title": "活动名称",
          "location": "地点",
          "description": "描述",
          "costEstimate": 费用
        }
      ]
    }
  ],
  "pendingQuestions": ["待确认问题1", "待确认问题2"]
}

注意:
1. 如果信息缺失,使用 null 并添加到 pendingQuestions
2. 日期必须是 ISO 格式
3. category 只能是: transport, accommodation, food, activity
4. type 只能是: transport, activity, meal, rest
5. 金额使用数字类型
`

      const response = await aiService.chat([
        { role: 'system', content: '你是一个严格的 JSON 格式化工具,只输出有效的 JSON。' },
        { role: 'user', content: prompt }
      ])

      // 提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[AgentTools] No JSON found in response')
        return null
      }

      const planData = JSON.parse(jsonMatch[0])
      
      // 添加 ID
      const itineraryCard: ItineraryCard = {
        id: `plan_${Date.now()}`,
        ...planData,
        rawPlan: naturalLanguagePlan.substring(0, 500)
      }

      console.log('[AgentTools] Plan structure extracted successfully')
      return itineraryCard

    } catch (error: any) {
      console.error('[AgentTools] extractPlanStructure error:', error)
      return null
    }
  }

  /**
   * 获取所有可用工具的映射
   */
  static getKnownActions(): Record<string, Function> {
    return {
      calculate_distance: this.calculateDistance.bind(this),
      search_nearby: this.searchNearby.bind(this),
      estimate_cost: this.estimateCost.bind(this)
    }
  }

  /**
   * 执行工具调用
   */
  static async executeAction(
    action: string,
    actionInput: string
  ): Promise<ToolResult> {
    const knownActions = this.getKnownActions()

    if (!(action in knownActions)) {
      return {
        observation: `未知的工具: ${action}`,
        error: `Unknown action: ${action}`
      }
    }

    try {
      // 解析输入参数
      let params: any[] = []

      if (action === 'calculate_distance') {
        // 格式: "起点, 终点, 交通方式"
        const parts = actionInput.split(',').map(p => p.trim())
        params = [parts[0], parts[1], parts[2] || 'driving']
      } else if (action === 'search_nearby') {
        // 格式: "地点, 类别, 半径"
        const parts = actionInput.split(',').map(p => p.trim())
        params = [parts[0], parts[1], parts[2] ? parseInt(parts[2]) : 5000]
      } else if (action === 'estimate_cost') {
        // 尝试解析 JSON
        try {
          const jsonData = JSON.parse(actionInput)
          params = [jsonData.type || jsonData.itemType || '未知', jsonData]
        } catch {
          // 如果不是 JSON,按逗号分割
          const parts = actionInput.split(',', 2)
          params = [parts[0]?.trim() || '未知', parts[1]?.trim() || actionInput]
        }
      }

      return await knownActions[action](...params)

    } catch (error: any) {
      console.error(`[AgentTools] Error executing ${action}:`, error)
      return {
        observation: `执行工具 ${action} 时出错: ${error.message}`,
        error: error.message
      }
    }
  }
}

export const agentTools = AgentTools
