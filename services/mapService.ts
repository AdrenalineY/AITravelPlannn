import type { POI, Route, Location } from '@/types'

interface AmapPOIResponse {
  status: string
  info: string
  count: string
  pois: Array<{
    id: string
    name: string
    type: string
    location: string
    address: string
    tel?: string
    photos?: Array<{ url: string }>
    rating?: string
  }>
}

interface AmapRouteResponse {
  status: string
  info: string
  route: {
    // 驾车、步行、骑行路线
    paths?: Array<{
      distance: string
      duration?: string
      cost?: {
        duration?: string  // v5 API中的耗时
        tolls?: string
      }
      steps: Array<{
        instruction: string
        distance: string
        duration?: string
        step_duration?: string
        polyline: string
      }>
    }>
    // 公交路线
    transits?: Array<{
      distance: string
      duration?: string
      cost?: {
        duration?: string
        transit_fee?: string
      }
    }>
  }
}

class MapService {
  private webServiceKey: string | null = null
  private baseUrl = 'https://restapi.amap.com/v3'

  /**
   * 设置 Web服务 API Key (用于后端数据获取)
   */
  setWebServiceKey(key: string) {
    this.webServiceKey = key
  }

  /**
   * 兼容旧方法名 (已废弃,请使用 setWebServiceKey)
   * @deprecated 请使用 setWebServiceKey 替代
   */
  setApiKey(key: string) {
    this.setWebServiceKey(key)
  }

  /**
   * POI 搜索(关键字搜索)
   */
  async searchPOI(query: string, location?: Location, city?: string): Promise<POI[]> {
    if (!this.webServiceKey) {
      throw new Error('高德地图 Web服务 API Key 未配置')
    }

    try {
      const params = new URLSearchParams({
        key: this.webServiceKey,
        keywords: query,
        city: city || '全国',
        offset: '20',
        page: '1',
        extensions: 'all',
      })

      if (location) {
        params.append('location', `${location.lng},${location.lat}`)
        params.append('sortrule', 'distance')
      }

      const response = await fetch(`${this.baseUrl}/place/text?${params}`)
      const data: AmapPOIResponse = await response.json()

      if (data.status !== '1') {
        throw new Error(data.info || 'POI 搜索失败')
      }

      return data.pois.map((poi) => {
        const [lng, lat] = poi.location.split(',').map(Number)
        return {
          id: poi.id,
          name: poi.name,
          category: poi.type,
          location: { lat, lng },
          address: poi.address,
          rating: poi.rating ? parseFloat(poi.rating) : undefined,
          photos: poi.photos?.map(p => p.url),
        }
      })
    } catch (error) {
      console.error('POI 搜索错误:', error)
      throw error
    }
  }

  /**
   * 周边POI搜索(使用高德POI搜索2.0接口)
   * @param options 搜索选项
   * @returns POI列表(包含距离、评分、人均消费等信息)
   */
  async searchNearbyPOI(options: {
    location: Location
    types?: string  // POI分类编码,用|分隔
    keywords?: string  // 关键字(可选)
    radius?: number  // 搜索半径(米),默认5000,最大50000
    pageSize?: number  // 返回数量,默认10,最大25
    sortrule?: 'distance' | 'weight'  // 排序规则:distance按距离,weight综合排序
    showFields?: string  // 额外返回字段,如: children,business,navi,indoor,photos
  }): Promise<Array<POI & { distance?: string; cost?: string; tel?: string; businessArea?: string; typecode?: string }>> {
    if (!this.webServiceKey) {
      throw new Error('高德地图 Web服务 API Key 未配置')
    }

    const {
      location,
      types,
      keywords,
      radius = 5000,
      pageSize = 10,
      sortrule = 'distance',
      showFields = 'business'  // 默认返回商业信息(评分、人均消费等)
    } = options

    try {
      // 使用POI搜索2.0周边搜索接口
      const params = new URLSearchParams({
        key: this.webServiceKey,
        location: `${location.lng},${location.lat}`,
        radius: Math.min(radius, 50000).toString(),  // 限制最大50000米
        page_size: Math.min(pageSize, 25).toString(),  // 限制最大25条
        sortrule,
        show_fields: showFields,
      })

      // 添加可选参数
      if (types) {
        params.append('types', types)
      }
      if (keywords) {
        params.append('keywords', keywords)
      }

      // POI搜索2.0使用新的baseUrl
      const apiUrl = 'https://restapi.amap.com/v5/place/around'
      console.log(`[MapService] 周边搜索: ${apiUrl}?${params}`)

      const response = await fetch(`${apiUrl}?${params}`)
      const data: any = await response.json()

      console.log(`[MapService] 周边搜索响应:`, { status: data.status, info: data.info, count: data.count })

      if (data.status !== '1') {
        throw new Error(data.info || '周边POI搜索失败')
      }

      if (!data.pois || data.pois.length === 0) {
        return []
      }

      return data.pois.map((poi: any) => {
        const [lng, lat] = poi.location.split(',').map(Number)
        return {
          id: poi.id,
          name: poi.name,
          type: poi.type,
          typecode: poi.typecode,
          category: poi.type,
          location: { lat, lng },
          address: poi.address || '',
          distance: poi.distance,  // 距离(米)
          rating: poi.rating,  // 评分
          cost: poi.cost,  // 人均消费
          tel: poi.tel,  // 电话
          businessArea: poi.business_area,  // 商圈
          photos: poi.photos?.map((p: any) => p.url),
        }
      })
    } catch (error: any) {
      console.error('[MapService] 周边POI搜索错误:', error)
      throw error
    }
  }

  /**
   * 获取 POI 详情
   */
  async getPOIDetail(id: string): Promise<POI | null> {
    if (!this.webServiceKey) {
      throw new Error('高德地图 Web服务 API Key 未配置')
    }

    try {
      const params = new URLSearchParams({
        key: this.webServiceKey,
        id,
        extensions: 'all',
      })

      const response = await fetch(`${this.baseUrl}/place/detail?${params}`)
      const data: AmapPOIResponse = await response.json()

      if (data.status !== '1' || !data.pois || data.pois.length === 0) {
        return null
      }

      const poi = data.pois[0]
      const [lng, lat] = poi.location.split(',').map(Number)

      return {
        id: poi.id,
        name: poi.name,
        category: poi.type,
        location: { lat, lng },
        address: poi.address,
        rating: poi.rating ? parseFloat(poi.rating) : undefined,
        photos: poi.photos?.map(p => p.url),
        openHours: poi.tel,
      }
    } catch (error) {
      console.error('POI 详情获取错误:', error)
      return null
    }
  }

  /**
   * 路线规划 - 使用高德路径规划2.0 API
   * 支持驾车、步行、骑行、公交多种交通方式
   */
  async planRoute(
    origin: Location,
    destination: Location,
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
  ): Promise<Route | null> {
    if (!this.webServiceKey) {
      throw new Error('高德地图 Web服务 API Key 未配置')
    }

    try {
      // 路径规划2.0使用v5版本API
      const modeMap = {
        driving: 'driving',
        walking: 'walking',
        bicycling: 'bicycling',
        transit: 'transit/integrated',
      }

      const params = new URLSearchParams({
        key: this.webServiceKey,
        origin: `${origin.lng},${origin.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        show_fields: 'cost',  // 显示耗时和费用信息
      })

      // 公交路线需要额外的城市参数
      if (mode === 'transit') {
        // 简化处理:使用全国通用代码,实际应该根据坐标获取城市代码
        params.append('city1', '010')  // 北京citycode
        params.append('city2', '010')
      }

      const apiMode = modeMap[mode]
      // 使用v5版本的路径规划API
      const apiUrl = `https://restapi.amap.com/v5/direction/${apiMode}`
      console.log(`[MapService] 路径规划: ${apiUrl}?${params}`)

      const response = await fetch(`${apiUrl}?${params}`)
      const data: AmapRouteResponse = await response.json()

      console.log(`[MapService] 路径规划响应:`, { status: data.status, info: data.info })

      if (data.status !== '1') {
        throw new Error(data.info || '路线规划失败')
      }

      // 公交路线返回结构不同
      if (mode === 'transit') {
        const transit = data.route?.transits?.[0]
        if (!transit) {
          throw new Error('未找到公交路线')
        }
        return {
          distance: parseFloat(transit.distance || '0'),
          duration: parseFloat(transit.cost?.duration || transit.duration || '0'),
          polyline: '',
          steps: [],
        }
      }

      // 驾车、步行、骑行路线
      const path = data.route?.paths?.[0]
      if (!path) {
        throw new Error('未找到路线')
      }

      return {
        distance: parseFloat(path.distance),
        duration: parseFloat(path.cost?.duration || path.duration || '0'),
        polyline: path.steps?.map((s: any) => s.polyline).join(';') || '',
        steps: path.steps?.map((step: any) => ({
          instruction: step.instruction,
          distance: parseFloat(step.distance),
          duration: parseFloat(step.step_duration || step.duration || '0'),
        })) || [],
      }
    } catch (error: any) {
      console.error('[MapService] 路线规划错误:', error)
      throw error
    }
  }

  /**
   * 地理编码 (地址 -> 坐标)
   */
  async geocode(address: string, city?: string): Promise<Location | null> {
    if (!this.webServiceKey) {
      throw new Error('高德地图 Web服务 API Key 未配置')
    }

    try {
      const params = new URLSearchParams({
        key: this.webServiceKey,
        address,
      })

      if (city) {
        params.append('city', city)
      }

      const response = await fetch(`${this.baseUrl}/geocode/geo?${params}`)
      const data = await response.json()

      if (data.status !== '1' || !data.geocodes?.[0]) {
        return null
      }

      const [lng, lat] = data.geocodes[0].location.split(',').map(Number)
      return { lat, lng }
    } catch (error) {
      console.error('地理编码错误:', error)
      return null
    }
  }

  /**
   * 逆地理编码 (坐标 -> 地址)
   */
  async reverseGeocode(location: Location): Promise<string | null> {
    if (!this.webServiceKey) {
      throw new Error('高德地图 Web服务 API Key 未配置')
    }

    try {
      const params = new URLSearchParams({
        key: this.webServiceKey,
        location: `${location.lng},${location.lat}`,
      })

      const response = await fetch(`${this.baseUrl}/geocode/regeo?${params}`)
      const data = await response.json()

      if (data.status !== '1' || !data.regeocode) {
        return null
      }

      return data.regeocode.formatted_address
    } catch (error) {
      console.error('逆地理编码错误:', error)
      return null
    }
  }
}

export const mapService = new MapService()
