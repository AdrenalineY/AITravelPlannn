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
  // 当前规划的目标城市(可由外部设置)
  private static targetCity: string | null = null

  /**
   * 设置目标城市(用于自动补全地点前缀)
   */
  static setTargetCity(city: string | null) {
    this.targetCity = city
  }

  /**
   * 使用关键字搜索找到最相关的POI
   * @param query 查询关键词(地点名称)
   * @param city 城市名称(可选)
   * @returns POI信息,包含精确的坐标和名称
   */
  static async findBestMatchPOI(query: string, city?: string): Promise<{ name: string; location: { lng: number; lat: number } } | null> {
    try {
      console.log(`[AgentTools] 搜索POI: ${query}${city ? ` (城市: ${city})` : ''}`)
      
      // 如果查询词中已包含城市名,尝试提取
      let searchCity = city
      if (!searchCity && this.targetCity) {
        searchCity = this.targetCity
      }
      
      // 使用POI搜索API
      const pois = await mapService.searchPOI(query, undefined, searchCity)
      
      if (!pois || pois.length === 0) {
        console.warn(`[AgentTools] 未找到匹配的POI: ${query}`)
        return null
      }
      
      // 返回第一个(最相关的)结果
      const bestMatch = pois[0]
      console.log(`[AgentTools] 找到最佳匹配: ${bestMatch.name} (${bestMatch.location.lng}, ${bestMatch.location.lat})`)
      
      return {
        name: bestMatch.name,
        location: bestMatch.location
      }
    } catch (error: any) {
      console.error(`[AgentTools] POI搜索失败: ${query}`, error)
      return null
    }
  }

  /**
   * 计算两地距离和交通信息
   * 使用关键字搜索 + 路径规划的组合方式
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

      // 🔧 改进: 先使用关键字搜索找到最相关的POI
      const originPOI = await this.findBestMatchPOI(origin, this.targetCity || undefined)
      const destPOI = await this.findBestMatchPOI(destination, this.targetCity || undefined)

      if (!originPOI || !destPOI) {
        const failedPlace = !originPOI ? origin : destination
        return {
          observation: `无法找到地点: ${failedPlace}。建议使用更具体的地点名称,如"故宫博物院"而非"故宫"`,
          error: 'POI search failed'
        }
      }
      
      console.log(`[AgentTools] 起点: ${originPOI.name} -> 终点: ${destPOI.name}`)

      // 调用高德地图服务获取路线信息
      const routeInfo = await mapService.planRoute(originPOI.location, destPOI.location, mode)

      if (!routeInfo) {
        return {
          observation: `无法获取从 ${originPOI.name} 到 ${destPOI.name} 的路线信息`,
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
      } else if (mode === 'bicycling') {
        cost = '免费'
      }

      const output: DistanceToolOutput = {
        distance: `${distanceKm} km`,
        duration: `${durationMin} 分钟`,
        cost,
        mode
      }

      // 构建详细的observation,包含交通方式的详细信息
      // 使用实际找到的POI名称,更精确
      // 使用 [POI:...] 标记包裹真实地点名称
      let observation = `从 [POI:${originPOI.name}] 到 [POI:${destPOI.name}]`
      
      if (mode === 'transit' && routeInfo.transitDetails) {
        // 公交/地铁模式:显示详细的换乘方案
        observation += ` 乘坐公共交通约 ${distanceKm} 公里,需要 ${durationMin} 分钟,费用${cost}\n换乘方案: ${routeInfo.transitDetails}`
      } else if (mode === 'driving') {
        observation += ` 驾车约 ${distanceKm} 公里,需要 ${durationMin} 分钟,费用${cost}`
      } else if (mode === 'walking') {
        observation += ` 步行约 ${distanceKm} 公里,需要 ${durationMin} 分钟,${cost}`
      } else if (mode === 'bicycling') {
        observation += ` 骑行约 ${distanceKm} 公里,需要 ${durationMin} 分钟,${cost}`
      }

      console.log(`[AgentTools] calculateDistance completed in ${Date.now() - startTime}ms`)

      return {
        observation,
        payload: {
          ...output,
          transitDetails: routeInfo.transitDetails,
          routeDescription: routeInfo.routeDescription,
        }
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
   * 搜索周边配套设施(餐饮、住宿、购物、娱乐)
   * 核心用途: 为已确定的景点查找周边的餐饮和住宿
   * 注意: 景点推荐应由Agent直接基于知识库完成,不使用此工具
   * 对应 Python 版本的 search_nearby
   * 使用高德POI搜索2.0周边搜索接口
   */
  static async searchNearby(
    location: string,
    category: 'restaurant' | 'hotel' | 'shopping' | 'entertainment',
    radius: number = 5000,
    keyword?: string
  ): Promise<ToolResult> {
    const startTime = Date.now()
    try {
      console.log(`[AgentTools] searchNearby: ${location}, category: ${category}, radius: ${radius}m, keyword: ${keyword}`)
      
      // 检测地点是否包含城市名称,如果没有则添加警告和建议
      const hasCityPrefix = this.checkCityPrefix(location)
      let cityHint = ''
      if (!hasCityPrefix && this.targetCity) {
        cityHint = `\n💡提示: 建议使用"${this.targetCity}${location}"以获得更准确的搜索结果`
        console.warn(`[AgentTools] 警告: 地点"${location}"缺少城市前缀,建议使用"${this.targetCity}${location}"`)
      } else if (!hasCityPrefix) {
        cityHint = `\n💡提示: 建议在地点前加上城市名称,如"北京${location}"或"上海${location}"`
        console.warn(`[AgentTools] 警告: 地点"${location}"可能缺少城市前缀`)
      }

      // 映射类别到高德地图POI分类编码(typecode)
      // 参考: https://lbs.amap.com/api/webservice/download
      // 注意: 景点推荐由Agent直接完成,此工具专注于餐饮、住宿、购物、娱乐
      const typeCodeMap: Record<string, string> = {
        // 餐饮服务类  
        restaurant: '050000|050100|050101|050102|050103|050200|050201|050202|050203|050204|050300|050301|050302|050303',
        // 住宿服务类
        hotel: '100000|100100|100101|100102|100103|100104|100200|100201|100202|100203',
        // 购物服务类
        shopping: '060000|061000|061100|061200|061300|061400|061500|062000|062100|062200|062300',
        // 休闲娱乐类
        entertainment: '080000|080100|080101|080102|080200|080201|080202|080203|080300|080301|080302|080303|080304|080305|080400|080500|080600'
      }

      const categoryNames: Record<string, string> = {
        restaurant: '餐饮服务',
        hotel: '住宿服务',
        shopping: '购物场所',
        entertainment: '休闲娱乐'
      }

      const typeCodes = typeCodeMap[category]
      const categoryName = categoryNames[category]
      
      // 检查是否是国外城市(高德地图主要支持中国)
      const foreignCities: Record<string, { lng: number; lat: number; note: string }> = {
        '东京': { lng: 139.6917, lat: 35.6895, note: '东京市中心' },
        '大阪': { lng: 135.5022, lat: 34.6937, note: '大阪市中心' },
        '京都': { lng: 135.7681, lat: 35.0116, note: '京都市中心' },
        '北海道': { lng: 141.3545, lat: 43.0642, note: '札幌市' },
        '首尔': { lng: 126.9780, lat: 37.5665, note: '首尔市中心' },
        '曼谷': { lng: 100.5018, lat: 13.7563, note: '曼谷市中心' },
        '新加坡': { lng: 103.8198, lat: 1.3521, note: '新加坡市中心' },
        '巴黎': { lng: 2.3522, lat: 48.8566, note: '巴黎市中心' },
        '伦敦': { lng: -0.1276, lat: 51.5074, note: '伦敦市中心' },
        '纽约': { lng: -74.0060, lat: 40.7128, note: '纽约市中心' },
      }
      
      let locationCoords: any
      
      // 检查是否是已知的国外城市
      if (foreignCities[location]) {
        locationCoords = foreignCities[location]
        console.log(`[AgentTools] 使用预设坐标: ${location} -> ${locationCoords.lng},${locationCoords.lat} (${locationCoords.note})`)
        console.warn(`[AgentTools] 注意: 高德地图对国外地址支持有限,使用的是${location}的中心坐标`)
      } else {
        // 使用高德地图地理编码
        locationCoords = await mapService.geocode(location)
        if (!locationCoords) {
          return {
            observation: `无法解析地址: ${location}。提示: 如果是国外城市,高德地图可能不支持该地点。`,
            error: 'Geocoding failed'
          }
        }
        console.log(`[AgentTools] 地址解析成功: ${location} -> ${locationCoords.lng},${locationCoords.lat}`)
      }

      // 使用周边搜索接口
      const results = await mapService.searchNearbyPOI({
        location: locationCoords,
        types: typeCodes,
        keywords: keyword,
        radius,
        pageSize: 10  // 获取10个结果
      })

      if (!results || results.length === 0) {
        let noResultMsg = `在 ${location} 周边 ${radius}米范围内未找到${categoryName}相关信息。`
        
        // 如果是国外城市,给出建议
        if (foreignCities[location]) {
          noResultMsg += `\n\n💡 这可能是因为: 1) 该区域确实没有相关POI; 2) 高德地图对该国外地址的数据覆盖有限。建议: 尝试搜索中国大陆的城市,或使用 estimate_cost 工具基于经验估算。`
        } else {
          noResultMsg += ` 建议: 1) 扩大搜索半径; 2) 更换其他地点; 3) 尝试其他类别。`
          noResultMsg += cityHint  // 添加城市提示
        }
        
        return {
          observation: noResultMsg,
          payload: { location, category, results: [], count: 0 }
        }
      }

      // 限制返回前8个结果并增强信息
      const limitedResults = results.slice(0, 8).map((poi: any, index: number) => {
        // 计算距离(米)
        const distance = poi.distance ? `${poi.distance}米` : '距离未知'
        
        return {
          rank: index + 1,
          name: poi.name,
          type: poi.category || '未分类',
          typecode: poi.typecode,
          address: poi.address || '地址未知',
          distance,
          location: poi.location ? `${poi.location.lng},${poi.location.lat}` : undefined,
          rating: poi.rating,
          cost: poi.cost,  // 人均消费
          tel: poi.tel,  // 联系电话
          businessArea: poi.businessArea  // 商圈
        }
      })

      const output: POISearchOutput = {
        location,
        category,
        results: limitedResults.map((r: any) => ({
          name: r.name,
          type: r.type,
          address: r.address,
          rating: r.rating,
          priceLevel: category === 'hotel' || category === 'restaurant' ? r.cost : undefined,
        })),
        count: limitedResults.length
      }

      // 构建详细的 observation,包含更多有用信息
      // 使用 [POI:...] 标记包裹真实地址信息
      const resultsList = limitedResults.map((r: any) => {
        const parts = [`${r.rank}. [POI:${r.name}]`]
        if (r.rating) parts.push(`评分${r.rating}`)
        if (r.distance) parts.push(r.distance)
        if (r.cost) parts.push(`人均${r.cost}元`)
        if (r.address && r.address !== '地址未知') {
          // 简化地址显示
          const shortAddr = r.address.length > 20 ? r.address.substring(0, 20) + '...' : r.address
          parts.push(`地址:[POI:${shortAddr}]`)
        }
        return parts.join(' | ')
      }).join('\n')

      // 如果是国外城市或缺少城市前缀,添加提示
      let observation = `在 ${location} 周边 ${radius}米内找到 ${limitedResults.length} 个${categoryName}:\n${resultsList}`
      
      if (foreignCities[location]) {
        observation += `\n\n⚠️ 注意: 高德地图对国外地址的POI数据可能不完整或不准确。建议使用国内城市获得更好的搜索结果。`
      } else if (cityHint) {
        observation += cityHint  // 添加城市前缀建议
      }

      console.log(`[AgentTools] searchNearby completed in ${Date.now() - startTime}ms, found ${limitedResults.length} results`)

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
   * 估算费用 - 针对单个行程节点
   * 对应 Python 版本的 estimate_cost
   */
  static async estimateCost(
    categoryOrOld: string,  // 兼容旧调用方式
    details: any
  ): Promise<ToolResult> {
    const startTime = Date.now()
    try {
      // 解析参数 (兼容新旧格式)
      let category: string
      let nodeInfo: any
      
      if (typeof details === 'object' && details.category) {
        // 新格式: category 在 details 中
        category = details.category
        nodeInfo = details
      } else {
        // 旧格式: category 作为第一个参数
        category = categoryOrOld
        nodeInfo = typeof details === 'string' ? { details } : details
      }
      
      console.log(`[AgentTools] estimateCost - 节点费用估算:`, { category, ...nodeInfo })

      // 验证类别
      const validCategories = ['transport', 'ticket', 'accommodation', 'meal', 'shopping']
      const categoryNames = {
        transport: '交通',
        ticket: '门票',
        accommodation: '住宿',
        meal: '餐饮',
        shopping: '购物'
      }

      // 构造更精确的估价 prompt
      const prompt = `你是一个专业的旅行费用估算专家。请估算以下**单个行程节点**的费用:

【费用类别】${categoryNames[category as keyof typeof categoryNames] || category}
${nodeInfo.nodeType ? `【节点类型】${nodeInfo.nodeType}` : ''}
${nodeInfo.location ? `【地点】${nodeInfo.location}` : ''}
${nodeInfo.name ? `【节点名称】${nodeInfo.name}` : ''}
${nodeInfo.details ? `【补充信息】${nodeInfo.details}` : ''}
${nodeInfo.quantity ? `【数量/人数】${nodeInfo.quantity}` : ''}
${nodeInfo.date ? `【日期】${nodeInfo.date}` : ''}

其他信息: ${typeof nodeInfo === 'string' ? nodeInfo : JSON.stringify(nodeInfo, null, 2)}

请基于当前市场价格和地点信息,估算该节点的费用。

返回 JSON 格式(只输出JSON,不要其他文字):
{
  "amount": 具体数字金额(元,不要范围),
  "basePrice": 单价(如果适用),
  "quantity": 数量(如果适用),
  "breakdown": [
    {"item": "明细项1", "amount": 金额},
    {"item": "明细项2", "amount": 金额}
  ],
  "notes": "费用说明(1-2句话)",
  "reasoning": "估算依据",
  "currency": "CNY"
}

**重要提示**:
- amount 必须是具体数字,不要范围(如 60,不要 50-70)
- 取该节点费用的合理中间值
- 如果是按人数计算,在 breakdown 中列明
- 考虑地点的消费水平(如北上广深vs二三线城市)`

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
        item: nodeInfo.name || category,
        category: category as any,  // 添加类别字段
        amount: estimateData.amount || 0,
        basePrice: estimateData.basePrice,
        quantity: estimateData.quantity || nodeInfo.quantity,
        breakdown: estimateData.breakdown,
        estimatedCost: estimateData.estimatedCost || `${estimateData.amount || 0}元`,
        details: estimateData.notes || estimateData.details,
        reasoning: estimateData.reasoning || '基于市场价格估算',
        currency: estimateData.currency || 'CNY'
      }

      const observation = `${nodeInfo.name || category}的费用估算为 ${output.amount}元${output.details ? `,${output.details}` : ''}。${output.reasoning}`

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
   * 从自然语言计划中提取结构化数据 - 增强版
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
      sessionId?: string
      userId?: string
      existingItinerary?: ItineraryCard  // 🔥 新增: 现有行程数据
    } = {}
  ): Promise<ItineraryCard | null> {
    try {
      console.log('[AgentTools] extractPlanStructure - Enhanced Version')
      const startTime = Date.now()

      // 🔥 构建包含现有行程的 prompt
      let existingItinerarySection = ''
      if (context.existingItinerary) {
        console.log('[AgentTools] 检测到现有行程,将在提取时保持未修改部分')
        existingItinerarySection = `

【⚠️ 重要: 现有行程数据】
以下是用户当前的完整行程 JSON 数据。用户只想修改部分内容,**未提及修改的部分必须完全保持原样**:

\`\`\`json
${JSON.stringify(context.existingItinerary, null, 2)}
\`\`\`

**关键规则**:
1. 用户在【旅行计划内容】中只描述了需要修改的部分
2. 对于用户未提及的天数、活动、住宿等,必须从上述 JSON 中原样复制
3. 不要用"行程保持不变"、"详见原计划"等描述,必须输出完整的 JSON 数据
4. 只修改用户明确提到要改的部分,其他完全保持不变
5. 输出的 JSON 必须是完整的行程数据,包含所有天数的完整 segments

**示例**:
- 如果用户说"把第2天的午餐改成XXX",只修改第2天的午餐 segment,第1天、第3天等完全保持原样
- 如果用户说"增加一个景点",在合适位置插入新 segment,其他 segments 保持原样
- 如果用户说"删除第2天下午的活动",删除对应 segment,其他保持原样`
      }

      const prompt = `你是一个专业的旅行数据提取专家。请仔细阅读以下旅行计划,提取所有结构化信息。

【旅行计划内容】
${naturalLanguagePlan}
${existingItinerarySection}

【已知上下文】
- 目的地: ${context.destination || '未知'}
- 人数: ${context.travelers || '未知'}
- 预算: ${context.budget || '未知'}
- 开始日期: ${context.startDate || '未知'}
- 结束日期: ${context.endDate || '未知'}

【提取要求】
请严格按照以下 JSON Schema 提取信息。**只输出JSON,不要任何其他文字**。

【费用类别映射规则】
每个 segment 都必须填写 costEstimate(金额) 和 costCategory(类别),类别与 type 的对应关系如下:
- type="transport" → costCategory="transport" (交通费用,如:地铁票、出租车、火车票、机票等)
- type="meal" → costCategory="meal" (餐饮费用,如:早餐、午餐、晚餐、下午茶等)
- type="accommodation" → costCategory="accommodation" (住宿费用,如:酒店、民宿等)
- type="activity" → costCategory="ticket" (门票费用,如:景点门票、表演票、游乐场门票等)
- type="shopping" → costCategory="shopping" (购物费用,如:特产购买、纪念品等)
- type="rest" → 可以不填写费用字段,或 costEstimate=0

**重要**: estimatedCost 的 breakdown 由系统自动汇总计算,不需要在 JSON 中手动填写!

\`\`\`json
{
  "title": "行程标题(如:上海3日亲子游)",
  "destination": "主要目的地",
  "cities": ["涉及的城市1", "城市2"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "durationDays": 行程天数(整数,如"3天2晚"中的3),
  "durationNights": 行程晚数(整数,如"3天2晚"中的2),
  
  "travelers": 总人数,
  "travelersDetail": {
    "adults": 成人数,
    "children": 儿童数,
    "ages": [年龄列表]
  },
  
  "preferences": ["偏好标签"],
  "travelStyle": "旅行风格",
  "theme": "行程主题",
  "specialRequests": ["特殊需求"],
  
  "totalBudget": 总预算(可选,如果有单个节点费用,系统会自动计算),
  "budgetPerPerson": 人均预算(可选,系统会自动计算),
  "currency": "CNY",
  
  // ⚠️ 注意: estimatedCost 的 breakdown 由系统自动计算,不需要手动填写
  // 只需要在每个 segment 中正确填写 costEstimate 和 costCategory
  
  "accommodation": {
    "region": "住宿区域",
    "type": "酒店类型",
    "recommendations": [
      {
        "name": "酒店名称",
        "location": "位置",
        "rating": 评分,
        "pricePerNight": 每晚价格,
        "totalNights": 晚数,
        "totalCost": 总价
      }
    ]
  },
  
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "当日标题",
      "summary": "当日概要",
      "highlights": ["亮点1", "亮点2"],
      "segments": [
        {
          "order": 1,
          "time": "09:00" 或 "09:00-12:00",
          "type": "transport|activity|meal|rest|accommodation",
          "title": "活动标题(可以是概括性的,如'外滩夜景漫步'、'午餐时光'、'前往酒店')",
          "location": "活动发生的真实地点(必须是具体地点,或者从 POI标签 中提取真实名称)",
          "address": "详细地址(尽可能完整,包括城市、区县、街道、门牌号)",
          "description": "详细描述(说明在这个地点做什么)",
          "duration": 时长(分钟),
          "costEstimate": 该节点的总费用(数字,必填),
          "costCategory": "费用类别(必填,五选一): transport(交通) | ticket(门票) | accommodation(住宿) | meal(餐饮) | shopping(购物)",
          "costDetails": {  // 可选,提供费用明细
            "basePrice": 基础单价,
            "quantity": 数量,
            "breakdown": [{"item": "项目名", "amount": 金额}],
            "notes": "费用说明"
          },
          "rating": 评分,
          "tips": ["小贴士"],
          
          // 如果 type === "transport", 必须包含以下字段:
          "transportMode": "walk|subway|bus|taxi|car|train|flight|bike",
          "transportDetails": {
            "from": "起点",
            "to": "终点",
            "distance": "距离(如: 2.5km)",
            "duration": "时长(如: 30分钟)",
            "cost": 费用,
            "route": "具体路线(如: 地铁1号线,天安门东站→王府井站)",
            "line": "线路名称(如: 地铁1号线, 877路公交)",
            "notes": "换乘说明或其他备注"
          },
          
          "bookingInfo": {
            "required": true/false,
            "advanceTime": "提前预订时间"
          }
        }
      ]
    }
  ],
  
  "tips": {
    "bestTime": "最佳旅行时间",
    "weather": "天气提示",
    "transportation": ["交通建议"],
    "packing": ["打包清单"],
    "safety": ["安全提示"],
    "cultural": ["文化习俗"]
  },
  
  "foodRecommendations": [
    {
      "name": "餐厅名",
      "location": "位置",
      "cuisine": "菜系",
      "signature": ["招牌菜"],
      "avgCost": 人均消费,
      "rating": 评分,
      "mustTry": true/false
    }
  ],
  
  "shoppingSpots": [
    {
      "name": "购物点",
      "location": "位置",
      "category": "类别",
      "highlights": ["亮点"]
    }
  ],
  
  "transportationSummary": {
    "localTransport": {
      "mainModes": ["主要交通方式"],
      "estimatedCost": 预估费用
    }
  },
  
  "pendingQuestions": ["待确认问题"],
  "tags": ["标签1", "标签2"]
}
\`\`\`

【提取规则】
1. **时间信息**: 严格使用 YYYY-MM-DD 格式,segments的time使用 HH:mm 或 HH:mm-HH:mm 格式
2. **金额**: 统一为数字类型(元),不要包含货币符号
3. **枚举值**: category和type必须使用指定的枚举值
4. **评分**: 0-5的浮点数
5. **缺失信息**: 使用null,并添加到pendingQuestions数组
6. **数组**: 即使只有一个元素也要使用数组格式
7. **segments的order**: 从1开始递增
8. **行程天数**: durationDays和durationNights是核心字段,必须准确提取(如"3天2晚"中的3和2)
9. **计算字段**: perPerson, percentage 等需要计算
10. **提取原则**: 尽可能完整提取,但不要编造不存在的信息

【⚠️ 地址信息提取特别要求 - 极其重要】

**1. POI标签处理**:
- Agent的回答中,工具返回的真实地点会用 [POI:地点名] 标记包裹
- **提取时移除所有 [POI:...] 标记**,只保留地点名称本身
- 例如: [POI:老盛昌汤包馆(南京东路店)] 提取为 老盛昌汤包馆(南京东路店)

**2. 标题、地点、描述的区分** (最重要!):
- **title字段**: 活动的概括性名称
  ✅ 正确: "外滩夜景漫步"、"午餐时光"、"参观博物馆"、"前往酒店"
  
- **location字段**: 活动发生的具体真实地点(从 [POI:...] 标记中提取)
  ✅ 正确: "上海外滩"、"老盛昌汤包馆(南京东路店)"、"上海博物馆"、"上海和平饭店"
  ❌ 错误: "外滩夜景漫步"、"午餐"、"前往酒店"(这些是活动描述,不是地点!)
  
- **description字段**: 详细说明在该地点做什么
  ✅ 正确: "在外滩观赏黄浦江夜景,欣赏万国建筑博览群的灯光秀"

**3. 地点名称完整性**:
- **location字段**: 必须包含城市名称,必须是真实地点
  ✅ 正确: "上海外滩"、"北京故宫博物院"、"老盛昌汤包馆(南京东路店)"
  ❌ 错误: "外滩"、"故宫"、"午餐"、"外滩夜景漫步"
  
- **address字段**: 尽可能完整,至少包含: 城市+区县+街道+门牌号
  ✅ 正确: "上海市黄浦区南京东路XXX号"、"北京市东城区景山前街4号"
  ❌ 错误: "南京东路XXX号"、"景山前街4号"

**4. type分类说明**:
- **transport**: 交通环节,用于串联各个活动点
  - 例如: "从上海复旦大学前往上海外滩"
  - location应为起点或终点的真实地点
  
- **activity**: 游览活动
  - 例如: title="参观故宫", location="北京故宫博物院"
  
- **meal**: 用餐活动
  - 例如: title="午餐", location="老盛昌汤包馆(南京东路店)"
  
- **accommodation**: 住宿
  - 例如: title="入住酒店", location="上海和平饭店"
  
- **rest**: 休息/自由活动
  - 例如: title="酒店休息", location="上海和平饭店"

**5. 原因说明**:
- 地址信息用于地图定位和路线规划
- 不完整的地址会导致搜索到错误的城市
- 例如: "外滩" 可能搜到湖北武汉的"外滩上海街道"而非上海外滩
- title和location混淆会导致地图无法定位(如"午餐"不是地点)

【输出格式】
直接输出JSON,不要markdown代码块标记,不要任何解释文字。`

      const response = await aiService.chat([
        { role: 'system', content: '你是一个严格的JSON提取工具。只输出有效的JSON,不输出任何其他内容。' },
        { role: 'user', content: prompt }
      ])

      console.log('[AgentTools] LLM response length:', response.length)

      // 提取 JSON (支持多种格式)
      let jsonStr = response.trim()
      
      // 移除可能的 markdown 代码块标记
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '')
      
      // 尝试找到 JSON 对象
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[AgentTools] No valid JSON found in response')
        console.error('[AgentTools] Response preview:', response.substring(0, 500))
        return null
      }

      const planData = JSON.parse(jsonMatch[0])
      
      // 计算行程天数和晚数(优先使用durationDays/durationNights)
      let durationDays = planData.durationDays
      let durationNights = planData.durationNights
      
      // 如果未提供durationDays,尝试从其他来源计算
      if (!durationDays) {
        if (planData.startDate && planData.endDate) {
          const start = new Date(planData.startDate)
          const end = new Date(planData.endDate)
          durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        } else if (planData.days && planData.days.length > 0) {
          durationDays = planData.days.length
        }
      }
      
      // 如果未提供durationNights,从durationDays计算
      if (!durationNights && durationDays) {
        durationNights = Math.max(0, durationDays - 1)
      }
      
      // 计算人均费用(如果未提供)
      let budgetPerPerson = planData.budgetPerPerson
      if (!budgetPerPerson && planData.totalBudget && planData.travelers) {
        budgetPerPerson = Math.round(planData.totalBudget / planData.travelers)
      }
      
      // 计算费用占比(如果未提供)
      if (planData.estimatedCost?.breakdown) {
        const total = planData.estimatedCost.total || 0
        planData.estimatedCost.breakdown.forEach((item: any) => {
          if (!item.percentage && total > 0) {
            item.percentage = Math.round((item.amount / total) * 100)
          }
        })
        
        // 计算人均费用
        if (!planData.estimatedCost.perPerson && planData.travelers) {
          planData.estimatedCost.perPerson = Math.round(planData.estimatedCost.total / planData.travelers)
        }
      }
      
      // 为每个segment添加order(如果未提供)
      if (planData.days) {
        planData.days.forEach((day: any) => {
          if (day.segments) {
            day.segments.forEach((seg: any, idx: number) => {
              if (!seg.order) {
                seg.order = idx + 1
              }
            })
          }
        })
      }
      
      // 🔧 **费用汇总计算** - 基于单个节点费用自动计算总预算
      console.log('[AgentTools] 开始计算费用汇总...')
      
      const costSummary = {
        transport: 0,
        ticket: 0,
        accommodation: 0,
        meal: 0,
        shopping: 0
      }
      
      const costItems: Record<string, Array<{name: string, amount: number, dayNumber: number}>> = {
        transport: [],
        ticket: [],
        accommodation: [],
        meal: [],
        shopping: []
      }
      
      // 遍历所有天和segment,收集费用
      if (planData.days && Array.isArray(planData.days)) {
        planData.days.forEach((day: any) => {
          if (day.segments && Array.isArray(day.segments)) {
            day.segments.forEach((seg: any) => {
              if (seg.costEstimate && seg.costEstimate > 0) {
                // 根据 segment 类型确定费用类别
                let category: keyof typeof costSummary = 'ticket'  // 默认
                
                if (seg.costCategory) {
                  category = seg.costCategory
                } else if (seg.type === 'transport') {
                  category = 'transport'
                } else if (seg.type === 'meal') {
                  category = 'meal'
                } else if (seg.type === 'accommodation') {
                  category = 'accommodation'
                } else if (seg.type === 'activity') {
                  category = 'ticket'
                }
                
                // 确保 category 合法
                if (!costSummary.hasOwnProperty(category)) {
                  category = 'ticket'
                }
                
                // ⚠️ 重要: 跳过 type='accommodation' 的 segments
                // 住宿费用应该从 accommodation.recommendations 中统一计算
                // 避免重复计算
                if (seg.type === 'accommodation') {
                  console.log(`[AgentTools] 跳过 segment 中的住宿费用,将从 accommodation.recommendations 统一计算: ${seg.title}`)
                  // 仍然设置 costCategory,但不累加到 costSummary
                  if (!seg.costCategory) {
                    seg.costCategory = category
                  }
                  return  // 跳过此 segment
                }
                
                costSummary[category] += seg.costEstimate
                costItems[category].push({
                  name: seg.title || seg.location,
                  amount: seg.costEstimate,
                  dayNumber: day.dayNumber
                })
                
                // 同时设置 segment 的 costCategory
                if (!seg.costCategory) {
                  seg.costCategory = category
                }
              }
            })
          }
        })
      }
      
      // 🔧 **住宿费用计算** - 只计算第一个推荐酒店(用户只会选择一家)
      // recommendations 中的多个酒店是供用户选择的,不是全部都住
      if (planData.accommodation?.recommendations && Array.isArray(planData.accommodation.recommendations)) {
        console.log('[AgentTools] 正在计算住宿推荐的费用...')
        
        // 只取第一个推荐酒店(通常是最佳推荐)
        const selectedHotel = planData.accommodation.recommendations[0]
        
        if (selectedHotel) {
          // 优先使用 totalCost,如果没有则计算 pricePerNight × totalNights
          let hotelCost = 0
          if (selectedHotel.totalCost && selectedHotel.totalCost > 0) {
            hotelCost = selectedHotel.totalCost
          } else if (selectedHotel.pricePerNight && selectedHotel.totalNights) {
            hotelCost = selectedHotel.pricePerNight * selectedHotel.totalNights
            // 同时设置 totalCost 字段
            selectedHotel.totalCost = hotelCost
          }
          
          if (hotelCost > 0) {
            costSummary.accommodation += hotelCost
            costItems.accommodation.push({
              name: selectedHotel.name || '推荐酒店',
              amount: hotelCost,
              dayNumber: 0  // 住宿不属于特定某天
            })
            console.log(`[AgentTools] 添加酒店费用(第1个推荐): ${selectedHotel.name} - ¥${hotelCost} (${selectedHotel.pricePerNight}/晚 × ${selectedHotel.totalNights}晚)`)
            console.log(`[AgentTools] 注意: 其他 ${planData.accommodation.recommendations.length - 1} 个推荐酒店仅供选择,不计入预算`)
          }
        }
      }
      
      // 计算总费用
      const totalCost = Object.values(costSummary).reduce((sum, val) => sum + val, 0)
      
      console.log('[AgentTools] 费用汇总结果:', {
        transport: costSummary.transport,
        ticket: costSummary.ticket,
        accommodation: costSummary.accommodation,
        meal: costSummary.meal,
        shopping: costSummary.shopping,
        total: totalCost
      })
      
      // 构建 estimatedCost breakdown
      const breakdown = [
        {
          category: 'transport' as const,
          amount: costSummary.transport,
          percentage: totalCost > 0 ? Math.round((costSummary.transport / totalCost) * 100) : 0,
          notes: '交通费用',
          items: costItems.transport
        },
        {
          category: 'ticket' as const,
          amount: costSummary.ticket,
          percentage: totalCost > 0 ? Math.round((costSummary.ticket / totalCost) * 100) : 0,
          notes: '门票费用',
          items: costItems.ticket
        },
        {
          category: 'accommodation' as const,
          amount: costSummary.accommodation,
          percentage: totalCost > 0 ? Math.round((costSummary.accommodation / totalCost) * 100) : 0,
          notes: '住宿费用',
          items: costItems.accommodation
        },
        {
          category: 'meal' as const,
          amount: costSummary.meal,
          percentage: totalCost > 0 ? Math.round((costSummary.meal / totalCost) * 100) : 0,
          notes: '餐饮费用',
          items: costItems.meal
        },
        {
          category: 'shopping' as const,
          amount: costSummary.shopping,
          percentage: totalCost > 0 ? Math.round((costSummary.shopping / totalCost) * 100) : 0,
          notes: '购物费用',
          items: costItems.shopping
        }
      ].filter(item => item.amount > 0)  // 只保留有费用的类别
      
      // 计算人均费用
      const travelers = planData.travelers || context.travelers || 1
      const perPersonCost = totalCost > 0 ? Math.round(totalCost / travelers) : 0
      
      // 更新或创建 estimatedCost
      planData.estimatedCost = {
        total: totalCost,
        perPerson: perPersonCost,
        breakdown: breakdown
      }
      
      // 如果没有totalBudget,使用计算出的费用
      if (!planData.totalBudget && totalCost > 0) {
        planData.totalBudget = totalCost
      }
      
      console.log('[AgentTools] ✅ 费用汇总计算完成')
      
      // 构建完整的 ItineraryCard
      // 注意: 不需要生成 id,让数据库自动生成 UUID
      const itineraryCard: ItineraryCard = {
        id: crypto.randomUUID(), // 生成 UUID 格式的 ID
        sessionId: context.sessionId,
        userId: context.userId,
        ...planData,
        durationDays: durationDays || planData.days?.length || 1,
        durationNights: durationNights ?? 0,
        totalDays: durationDays || planData.days?.length || 1,  // 兼容旧字段
        totalNights: durationNights ?? 0,  // 兼容旧字段
        budgetPerPerson,
        currency: planData.currency || 'CNY',
        rawPlan: naturalLanguagePlan.substring(0, 500),
        fullPlan: naturalLanguagePlan,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }

      console.log(`[AgentTools] Plan extraction completed in ${Date.now() - startTime}ms`)
      console.log('[AgentTools] Extracted plan:', {
        title: itineraryCard.title,
        destination: itineraryCard.destination,
        days: itineraryCard.days?.length,
        totalCost: itineraryCard.estimatedCost?.total
      })
      
      return itineraryCard

    } catch (error: any) {
      console.error('[AgentTools] extractPlanStructure error:', error)
      console.error('[AgentTools] Error stack:', error.stack)
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

  /**
   * 检测地点名称是否包含城市前缀
   * 返回 true 表示可能包含城市名称
   */
  private static checkCityPrefix(location: string): boolean {
    // 常见中国城市列表(部分)
    const chineseCities = [
      '北京', '上海', '天津', '重庆',
      '广州', '深圳', '杭州', '南京', '苏州', '成都', '武汉', '西安',
      '长沙', '沈阳', '青岛', '郑州', '大连', '宁波', '厦门', '济南',
      '哈尔滨', '长春', '福州', '石家庄', '南昌', '贵阳', '南宁', '昆明',
      '兰州', '太原', '合肥', '乌鲁木齐', '海口', '呼和浩特', '拉萨', '银川',
      '西宁', '无锡', '佛山', '温州', '常州', '珠海', '东莞', '中山',
      '台州', '烟台', '嘉兴', '惠州', '保定', '扬州', '洛阳', '包头'
    ]
    
    // 检查地点名称是否以任一城市名开头
    for (const city of chineseCities) {
      if (location.startsWith(city)) {
        return true
      }
    }
    
    // 如果地点名很长(>4个字),可能已包含城市信息
    if (location.length > 4) {
      return true
    }
    
    return false
  }
}

export const agentTools = AgentTools
