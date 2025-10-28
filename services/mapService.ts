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
    paths: Array<{
      distance: string
      duration: string
      steps: Array<{
        instruction: string
        distance: string
        duration: string
        polyline: string
      }>
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
   * POI 搜索
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
   * 路线规划
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
      })

      const apiMode = modeMap[mode]
      const response = await fetch(`${this.baseUrl}/direction/${apiMode}?${params}`)
      const data: AmapRouteResponse = await response.json()

      if (data.status !== '1' || !data.route?.paths?.[0]) {
        throw new Error(data.info || '路线规划失败')
      }

      const path = data.route.paths[0]
      return {
        distance: parseFloat(path.distance),
        duration: parseFloat(path.duration),
        polyline: path.steps.map(s => s.polyline).join(';'),
        steps: path.steps.map((step) => ({
          instruction: step.instruction,
          distance: parseFloat(step.distance),
          duration: parseFloat(step.duration),
        })),
      }
    } catch (error) {
      console.error('路线规划错误:', error)
      return null
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
