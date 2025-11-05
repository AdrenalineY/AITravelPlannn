/**
 * 行程数据转地图可视化数据
 * 将 Itinerary 或 ItineraryCard 数据结构转换为地图标记点和路线
 */

import type { Itinerary, DayPlan, Activity, Accommodation, ItineraryCard } from '@/types'

export interface MapMarker {
  id: string
  position: [number, number] // [lng, lat]
  title: string
  type: 'attraction' | 'restaurant' | 'accommodation' | 'transport' | 'other'
  icon: string
  dayIndex: number
  activityIndex?: number
  time?: string
  data: Activity | Accommodation | any
}

export interface MapRoute {
  id: string
  dayIndex: number
  mode: 'driving' | 'walking' | 'transit'
  start: [number, number]
  end: [number, number]
  waypoints: Array<{
    position: [number, number]
    name: string
  }>
  color: string
  style: 'solid' | 'dashed'
  distance?: number
  duration?: number
}

export interface ItineraryMapData {
  markers: MapMarker[]
  routes: MapRoute[]
  center: [number, number]
  zoom: number
  bounds: {
    southwest: [number, number]
    northeast: [number, number]
  } | null
}

/**
 * 根据活动类型判断 POI 类型
 */
function detectActivityType(activity: Activity): MapMarker['type'] {
  const name = activity.poiName.toLowerCase()
  const notes = (activity.notes || '').toLowerCase()
  
  // 餐饮关键词
  if (
    name.includes('餐厅') || name.includes('美食') || name.includes('饭店') ||
    name.includes('restaurant') || name.includes('cafe') || name.includes('咖啡') ||
    notes.includes('午餐') || notes.includes('晚餐') || notes.includes('早餐')
  ) {
    return 'restaurant'
  }
  
  // 交通关键词
  if (
    name.includes('机场') || name.includes('车站') || name.includes('码头') ||
    name.includes('airport') || name.includes('station')
  ) {
    return 'transport'
  }
  
  // 默认为景点
  return 'attraction'
}

/**
 * 获取 POI 图标 (使用 emoji 或内置图标)
 */
function getMarkerIcon(type: MapMarker['type'], dayIndex: number): string {
  // 使用高德地图内置图标,不依赖外部URL
  const iconMap: Record<MapMarker['type'], string> = {
    attraction: '📍',
    restaurant: '🍴',
    accommodation: '🏨',
    transport: '🚗',
    other: '📌'
  }
  
  return iconMap[type]
}

/**
 * 获取路线颜色
 */
function getRouteColor(dayIndex: number): string {
  const colors = [
    '#1890ff', // 蓝色 - Day 1
    '#52c41a', // 绿色 - Day 2
    '#fa8c16', // 橙色 - Day 3
    '#eb2f96', // 粉色 - Day 4
    '#722ed1', // 紫色 - Day 5
    '#13c2c2', // 青色 - Day 6
    '#faad14'  // 金色 - Day 7
  ]
  return colors[dayIndex % colors.length]
}

/**
 * 使用高德地图 API 进行地理编码（客户端调用）
 */
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const response = await fetch(`/api/map/geocode?address=${encodeURIComponent(address)}`)
    const data = await response.json()
    
    if (data.success && data.location) {
      return [data.location.lng, data.location.lat]
    }
    return null
  } catch (error) {
    console.error('[地理编码] 失败:', error)
    return null
  }
}

/**
 * 从活动数据获取坐标
 * 优先级: 数据库坐标 > 地址解析 > 名称搜索 > 使用城市默认坐标
 */
async function getCoordinatesFromActivity(
  activity: Activity,
  destination: string
): Promise<[number, number] | null> {
  console.log(`[坐标获取] 活动: ${activity.poiName}`)
  
  try {
    // 1. 检查数据库中是否已有坐标
    const activityAny = activity as any
    if (activityAny.location_lng != null && activityAny.location_lat != null) {
      const lng = Number(activityAny.location_lng)
      const lat = Number(activityAny.location_lat)
      if (!isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0) {
        console.log(`[坐标获取] ✅ 使用数据库坐标:`, [lng, lat])
        return [lng, lat]
      }
    }
    
    // 2. 地址解析
    if (activity.address && activity.address.trim()) {
      console.log(`[坐标获取] 尝试: 地址解析 - ${activity.address}`)
      const coords = await geocodeAddress(activity.address)
      if (coords) {
        console.log(`[坐标获取] ✅ 地址解析成功:`, coords)
        return coords
      }
    }
    
    // 3. 名称 + 城市搜索
    if (activity.poiName && destination) {
      console.log(`[坐标获取] 尝试: 名称搜索 - ${activity.poiName} ${destination}`)
      const searchQuery = `${activity.poiName} ${destination}`
      const coords = await geocodeAddress(searchQuery)
      if (coords) {
        console.log(`[坐标获取] ✅ 名称搜索成功:`, coords)
        return coords
      }
    }
    
    console.log(`[坐标获取] ⚠️ 未获取到坐标: ${activity.poiName}`)
    return null
  } catch (error) {
    console.error(`[坐标获取] 异常:`, error)
    return null
  }
}

/**
 * 从住宿数据获取坐标
 */
async function getCoordinatesFromAccommodation(
  accommodation: Accommodation,
  destination: string
): Promise<[number, number] | null> {
  console.log(`[坐标获取] 住宿: ${accommodation.name}`)
  
  try {
    // 优先使用地址解析
    if (accommodation.address && accommodation.address.trim()) {
      console.log(`[坐标获取] 尝试: 地址解析 - ${accommodation.address}`)
      const coords = await geocodeAddress(accommodation.address)
      if (coords) {
        console.log(`[坐标获取] ✅ 地址解析成功:`, coords)
        return coords
      }
    }
    
    // 名称搜索
    if (accommodation.name && destination) {
      console.log(`[坐标获取] 尝试: 名称搜索 - ${accommodation.name} ${destination}`)
      const searchQuery = `${accommodation.name} ${destination}`
      const coords = await geocodeAddress(searchQuery)
      if (coords) {
        console.log(`[坐标获取] ✅ 名称搜索成功:`, coords)
        return coords
      }
    }
    
    console.log(`[坐标获取] ⚠️ 未获取到坐标: ${accommodation.name}`)
    return null
  } catch (error) {
    console.error(`[坐标获取] 异常:`, error)
    return null
  }
}

/**
 * 计算地图边界
 */
function calculateBounds(positions: Array<[number, number]>): {
  southwest: [number, number]
  northeast: [number, number]
} | null {
  if (positions.length === 0) return null
  
  let minLng = positions[0][0]
  let maxLng = positions[0][0]
  let minLat = positions[0][1]
  let maxLat = positions[0][1]
  
  positions.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  })
  
  return {
    southwest: [minLng, minLat],
    northeast: [maxLng, maxLat]
  }
}

/**
 * 计算地图中心点
 */
function calculateCenter(positions: Array<[number, number]>): [number, number] {
  if (positions.length === 0) return [116.397428, 39.90923] // 默认北京
  
  const sumLng = positions.reduce((sum, [lng]) => sum + lng, 0)
  const sumLat = positions.reduce((sum, [, lat]) => sum + lat, 0)
  
  return [sumLng / positions.length, sumLat / positions.length]
}

/**
 * 将行程数据转换为地图数据
 */
export async function convertItineraryToMapData(
  itinerary: Itinerary
): Promise<ItineraryMapData> {
  console.log('[数据转换] 开始转换行程数据到地图数据')
  console.log('[数据转换] 行程:', itinerary.title, '目的地:', itinerary.destination)
  console.log('[数据转换] 天数:', itinerary.days?.length || 0)
  
  const markers: MapMarker[] = []
  const routes: MapRoute[] = []
  const allPositions: Array<[number, number]> = []
  
  if (!itinerary.days || itinerary.days.length === 0) {
    console.log('[数据转换] ⚠️ 没有天数数据')
    return {
      markers: [],
      routes: [],
      center: [116.397428, 39.90923],
      zoom: 12,
      bounds: null
    }
  }
  
  // 遍历每一天
  for (let dayIndex = 0; dayIndex < itinerary.days.length; dayIndex++) {
    const day = itinerary.days[dayIndex]
    console.log(`[数据转换] Day ${dayIndex + 1} - ${day.date}`)
    console.log(`[数据转换] 活动数量: ${day.activities?.length || 0}`)
    
    const dayPositions: Array<[number, number]> = []
    
    // 处理活动
    if (day.activities && day.activities.length > 0) {
      for (let actIndex = 0; actIndex < day.activities.length; actIndex++) {
        const activity = day.activities[actIndex]
        console.log(`[数据转换] 活动 ${actIndex + 1}: ${activity.poiName}`)
        
        const position = await getCoordinatesFromActivity(activity, itinerary.destination)
        
        if (position) {
          const type = detectActivityType(activity)
          const marker: MapMarker = {
            id: `day-${dayIndex}-activity-${actIndex}`,
            position,
            title: activity.poiName,
            type,
            icon: getMarkerIcon(type, dayIndex),
            dayIndex,
            activityIndex: actIndex,
            time: activity.time,
            data: activity
          }
          
          markers.push(marker)
          dayPositions.push(position)
          allPositions.push(position)
          console.log(`[数据转换] ✅ 添加标记: ${activity.poiName}`, position)
        } else {
          console.log(`[数据转换] ⚠️ 跳过无坐标活动: ${activity.poiName}`)
        }
      }
    }
    
    // 处理住宿
    if (day.accommodation) {
      console.log(`[数据转换] 住宿: ${day.accommodation.name}`)
      const position = await getCoordinatesFromAccommodation(
        day.accommodation,
        itinerary.destination
      )
      
      if (position) {
        const marker: MapMarker = {
          id: `day-${dayIndex}-accommodation`,
          position,
          title: day.accommodation.name,
          type: 'accommodation',
          icon: getMarkerIcon('accommodation', dayIndex),
          dayIndex,
          data: day.accommodation
        }
        
        markers.push(marker)
        dayPositions.push(position)
        allPositions.push(position)
        console.log(`[数据转换] ✅ 添加住宿标记: ${day.accommodation.name}`, position)
      }
    }
    
    // 生成路线 (连接当天的所有点)
    if (dayPositions.length >= 2) {
      const waypoints = dayPositions.slice(1, -1).map((pos, idx) => ({
        position: pos,
        name: day.activities[idx + 1]?.poiName || `途经点${idx + 1}`
      }))
      
      const route: MapRoute = {
        id: `route-day-${dayIndex}`,
        dayIndex,
        mode: 'driving', // 默认驾车
        start: dayPositions[0],
        end: dayPositions[dayPositions.length - 1],
        waypoints,
        color: getRouteColor(dayIndex),
        style: 'solid'
      }
      
      routes.push(route)
      console.log(`[数据转换] ✅ 添加路线: Day ${dayIndex + 1}, ${dayPositions.length} 个点`)
    }
  }
  
  // 检查是否有有效位置
  if (allPositions.length === 0) {
    console.warn('[数据转换] ⚠️ 没有找到任何有效的地理位置')
    console.warn('[数据转换] 建议检查:')
    console.warn('  1. segments 是否有 coordinates 字段')
    console.warn('  2. coordinates.lng 和 coordinates.lat 是否为有效数字')
    console.warn('  3. 地址信息是否完整')
  }
  
  const center = calculateCenter(allPositions)
  const bounds = calculateBounds(allPositions)
  
  console.log('[数据转换] ✅ 转换完成')
  console.log(`[数据转换] 标记点数量: ${markers.length}`)
  console.log(`[数据转换] 路线数量: ${routes.length}`)
  console.log(`[数据转换] 地图中心:`, center)
  
  return {
    markers,
    routes,
    center,
    zoom: 12,
    bounds
  }
}

/**
 * 按天数筛选标记
 */
export function filterMarkersByDay(
  markers: MapMarker[],
  dayIndex: number
): MapMarker[] {
  return markers.filter(m => m.dayIndex === dayIndex)
}

/**
 * 按天数筛选路线
 */
export function filterRoutesByDay(
  routes: MapRoute[],
  dayIndex: number
): MapRoute[] {
  return routes.filter(r => r.dayIndex === dayIndex)
}

/**
 * 将 ItineraryCard 转换为地图数据
 * ItineraryCard 的结构: days[] -> segments[] with coordinates
 */
export async function convertItineraryCardToMapData(
  itineraryCard: ItineraryCard
): Promise<ItineraryMapData> {
  console.log('[数据转换] 开始转换 ItineraryCard 数据到地图数据')
  console.log('[数据转换] 行程:', itineraryCard.title, '目的地:', itineraryCard.destination)
  console.log('[数据转换] 天数:', itineraryCard.days?.length || 0)
  
  // 输出完整的 ItineraryCard 数据以供调试
  console.log('[数据转换] ItineraryCard 数据预览:', JSON.stringify(itineraryCard, null, 2).substring(0, 1000))
  
  const markers: MapMarker[] = []
  const routes: MapRoute[] = []
  const allPositions: Array<[number, number]> = []
  
  if (!itineraryCard.days || itineraryCard.days.length === 0) {
    console.log('[数据转换] ⚠️ 没有天数数据')
    return {
      markers: [],
      routes: [],
      center: [116.397428, 39.90923],
      zoom: 12,
      bounds: null
    }
  }
  
  // 遍历每一天
  for (let dayIndex = 0; dayIndex < itineraryCard.days.length; dayIndex++) {
    const day = itineraryCard.days[dayIndex]
    console.log(`[数据转换] Day ${dayIndex + 1} - ${day.date}`)
    console.log(`[数据转换] Segments 数量: ${day.segments?.length || 0}`)
    
    const dayPositions: Array<[number, number]> = []
    
    // 处理每个 segment
    if (day.segments && day.segments.length > 0) {
      for (let segIndex = 0; segIndex < day.segments.length; segIndex++) {
        const segment = day.segments[segIndex]
        console.log(`[数据转换] Segment ${segIndex + 1}: ${segment.title} (${segment.type})`)
        
        // 优先使用 coordinates 字段
        let position: [number, number] | null = null
        
        if (segment.coordinates) {
          const lng = Number(segment.coordinates.lng)
          const lat = Number(segment.coordinates.lat)
          
          // 严格验证坐标有效性
          if (!isNaN(lng) && !isNaN(lat) && 
              lng !== 0 && lat !== 0 &&
              lng >= -180 && lng <= 180 &&
              lat >= -90 && lat <= 90) {
            position = [lng, lat]
            console.log(`[数据转换] ✅ 使用 segment.coordinates:`, position)
          } else {
            console.log(`[数据转换] ⚠️ segment.coordinates 无效:`, segment.coordinates, `-> lng=${lng}, lat=${lat}`)
          }
        }
        
        if (!position && segment.address) {
          // 如果有完整地址，直接使用地址
          // 地址格式应该包含城市信息,如 "上海市黄浦区南京东路XXX号"
          console.log(`[数据转换] 尝试地理编码(地址): ${segment.address}`)
          position = await geocodeAddress(segment.address)
          if (position) {
            console.log(`[数据转换] ✅ 地理编码成功:`, position)
          }
        }
        
        if (!position && segment.location) {
          // 如果有 location 字段,拼接完整查询
          // 优先使用 title (更完整) + destination
          const searchQuery = segment.title 
            ? `${itineraryCard.destination} ${segment.title}`
            : `${itineraryCard.destination} ${segment.location}`
          
          console.log(`[数据转换] 尝试搜索(位置名称): ${searchQuery}`)
          position = await geocodeAddress(searchQuery)
          if (position) {
            console.log(`[数据转换] ✅ 位置搜索成功:`, position)
          }
        }
        
        if (!position && segment.title) {
          // 最后尝试使用 title
          const searchQuery = `${itineraryCard.destination} ${segment.title}`
          console.log(`[数据转换] 尝试搜索(标题): ${searchQuery}`)
          position = await geocodeAddress(searchQuery)
          if (position) {
            console.log(`[数据转换] ✅ 标题搜索成功:`, position)
          }
        }
        
        if (position) {
          // 判断类型
          // transport 类型用于串联路线,会在地图上显示为连接线的端点
          let markerType: MapMarker['type'] = 'other'
          if (segment.type === 'activity') {
            markerType = 'attraction'
          } else if (segment.type === 'meal') {
            markerType = 'restaurant'
          } else if (segment.type === 'accommodation') {
            markerType = 'accommodation'
          } else if (segment.type === 'transport') {
            markerType = 'transport'
          }
          
          const marker: MapMarker = {
            id: `day-${dayIndex}-segment-${segIndex}`,
            position,
            title: segment.title || segment.location,
            type: markerType,
            icon: getMarkerIcon(markerType, dayIndex),
            dayIndex,
            activityIndex: segIndex,
            time: segment.time,
            data: segment
          }
          
          markers.push(marker)
          dayPositions.push(position)
          allPositions.push(position)
          console.log(`[数据转换] ✅ 添加标记: ${segment.title}`, position)
        } else {
          console.log(`[数据转换] ⚠️ 跳过无坐标 segment: ${segment.title}`)
        }
      }
    }
    
    // 生成路线 (连接当天的所有点)
    if (dayPositions.length >= 2) {
      const waypoints = dayPositions.slice(1, -1).map((pos, idx) => ({
        position: pos,
        name: day.segments[idx + 1]?.title || `途经点${idx + 1}`
      }))
      
      const route: MapRoute = {
        id: `route-day-${dayIndex}`,
        dayIndex,
        mode: 'driving',
        start: dayPositions[0],
        end: dayPositions[dayPositions.length - 1],
        waypoints,
        color: getRouteColor(dayIndex),
        style: 'solid'
      }
      
      routes.push(route)
      console.log(`[数据转换] ✅ 添加路线: Day ${dayIndex + 1}, ${dayPositions.length} 个点`)
    }
  }
  
  const center = calculateCenter(allPositions)
  const bounds = calculateBounds(allPositions)
  
  console.log('[数据转换] ✅ 转换完成')
  console.log(`[数据转换] 标记点数量: ${markers.length}`)
  console.log(`[数据转换] 路线数量: ${routes.length}`)
  console.log(`[数据转换] 地图中心:`, center)
  
  return {
    markers,
    routes,
    center,
    zoom: 12,
    bounds
  }
}
