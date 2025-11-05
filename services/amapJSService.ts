/**
 * 高德地图 JS API 服务
 * 用于前端地图展示和交互
 */

import type { Location } from '@/types'

// 全局 AMap 类型声明
declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}

export interface MapMarker {
  id: string
  position: [number, number] // [lng, lat]
  title: string
  content?: string
  icon?: string
  type?: 'attraction' | 'restaurant' | 'accommodation' | 'transport' | 'other'
  dayIndex?: number
  extData?: any
}

export interface MapRoute {
  id: string
  start: [number, number]
  end: [number, number]
  waypoints?: Array<{
    position: [number, number]
    name: string
  }>
  mode?: 'driving' | 'walking' | 'transit'
  color?: string
  style?: 'solid' | 'dashed'
  dayIndex?: number
}

export interface RouteResult {
  distance: number // 米
  duration: number // 秒
  path: Array<[number, number]>
  steps?: any[]
}

export class AmapJSService {
  private map: any = null
  private markers: any[] = []
  private polylines: any[] = []
  private markersByDay: Map<number, any[]> = new Map()
  private routesByDay: Map<number, any[]> = new Map()

  /**
   * 初始化地图
   */
  async initMap(containerId: string, options?: {
    center?: [number, number]
    zoom?: number
    viewMode?: '2D' | '3D'
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!window.AMap) {
        reject(new Error('高德地图 JS API 未加载'))
        return
      }

      try {
        this.map = new window.AMap.Map(containerId, {
          zoom: options?.zoom || 12,
          center: options?.center || [116.397428, 39.90923], // 默认北京
          viewMode: options?.viewMode || '2D',
          showLabel: true,
          mapStyle: 'amap://styles/normal', // 标准样式
        })

        // 添加工具栏
        this.map.addControl(new window.AMap.ToolBar({
          position: {
            bottom: '20px',
            right: '20px'
          }
        }))

        // 添加比例尺
        this.map.addControl(new window.AMap.Scale())

        resolve(this.map)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 添加标记点
   */
  addMarker(marker: MapMarker): any {
    if (!this.map) {
      throw new Error('地图未初始化')
    }

    // 如果 icon 是 emoji,使用 Text 标记
    const markerOptions: any = {
      position: marker.position,
      title: marker.title,
      map: this.map
    }
    
    // 检查是否是 emoji 图标
    if (marker.icon && marker.icon.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(marker.icon)) {
      markerOptions.content = `<div style="
        font-size: 24px;
        width: 32px;
        height: 32px;
        text-align: center;
        line-height: 32px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${marker.icon}</div>`
      markerOptions.offset = new window.AMap.Pixel(-16, -16)
    } else if (marker.icon) {
      markerOptions.icon = marker.icon
    }
    
    const amapMarker = new window.AMap.Marker(markerOptions)

    // 添加点击事件
    if (marker.content) {
      const infoWindow = new window.AMap.InfoWindow({
        content: marker.content,
        offset: new window.AMap.Pixel(0, -30)
      })

      amapMarker.on('click', () => {
        infoWindow.open(this.map, marker.position)
      })
    }

    this.markers.push(amapMarker)
    return amapMarker
  }

  /**
   * 批量添加标记点
   */
  addMarkers(markers: MapMarker[]): any[] {
    return markers.map(marker => this.addMarker(marker))
  }

  /**
   * 清除所有标记点
   */
  clearMarkers(): void {
    if (this.markers.length > 0) {
      this.map?.remove(this.markers)
      this.markers = []
    }
  }

  /**
   * 调整地图视野以包含所有标记点
   */
  fitView(): void {
    if (!this.map || this.markers.length === 0) return

    this.map.setFitView(this.markers, false, [20, 20, 20, 20])
  }

  /**
   * 设置地图中心
   */
  setCenter(center: [number, number], zoom?: number): void {
    if (!this.map) return

    this.map.setCenter(center)
    if (zoom !== undefined) {
      this.map.setZoom(zoom)
    }
  }

  /**
   * 绘制路线
   */
  drawRoute(path: [number, number][], options?: {
    strokeColor?: string
    strokeWeight?: number
  }): any {
    if (!this.map) return null

    const polyline = new window.AMap.Polyline({
      path,
      strokeColor: options?.strokeColor || '#3370FF',
      strokeWeight: options?.strokeWeight || 6,
      strokeOpacity: 0.8,
      lineJoin: 'round',
      lineCap: 'round',
      map: this.map
    })

    return polyline
  }

  /**
   * 搜索 POI
   */
  searchPOI(keyword: string, center?: [number, number]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!window.AMap) {
        reject(new Error('高德地图 JS API 未加载'))
        return
      }

      window.AMap.plugin('AMap.PlaceSearch', () => {
        const placeSearch = new window.AMap.PlaceSearch({
          city: '全国',
          pageSize: 10,
          ...(center && { location: center })
        })

        placeSearch.search(keyword, (status: string, result: any) => {
          if (status === 'complete') {
            resolve(result.poiList?.pois || [])
          } else {
            reject(new Error('POI 搜索失败'))
          }
        })
      })
    })
  }

  /**
   * 路线规划 - 驾车
   */
  async planDrivingRoute(options: {
    start: [number, number]
    end: [number, number]
    waypoints?: Array<[number, number]>
    policy?: number // 0: 速度优先, 1: 费用优先, 2: 距离优先
  }): Promise<RouteResult> {
    console.log('[路线规划] 开始驾车路线规划')
    console.log('[路线规划] 起点:', options.start)
    console.log('[路线规划] 终点:', options.end)
    console.log('[路线规划] 途经点:', options.waypoints)

    return new Promise((resolve, reject) => {
      if (!window.AMap) {
        reject(new Error('高德地图 JS API 未加载'))
        return
      }

      const driving = new window.AMap.Driving({
        policy: options.policy || 0,
        extensions: 'base'
      })

      const searchOptions: any = {}
      if (options.waypoints && options.waypoints.length > 0) {
        searchOptions.waypoints = options.waypoints.map((p: [number, number]) => new window.AMap.LngLat(p[0], p[1]))
      }

      driving.search(
        new window.AMap.LngLat(options.start[0], options.start[1]),
        new window.AMap.LngLat(options.end[0], options.end[1]),
        searchOptions,
        (status: string, result: any) => {
          if (status === 'complete' && result.routes && result.routes.length > 0) {
            const route = result.routes[0]
            const path: Array<[number, number]> = []
            
            // 提取路径坐标
            route.steps.forEach((step: any) => {
              step.path.forEach((point: any) => {
                path.push([point.lng, point.lat])
              })
            })

            console.log(`[路线规划] ✅ 成功 - 距离: ${route.distance}米, 时间: ${route.time}秒`)
            
            resolve({
              distance: route.distance,
              duration: route.time,
              path,
              steps: route.steps
            })
          } else {
            console.log('[路线规划] ❌ 失败:', status, result)
            reject(new Error(`路线规划失败: ${status}`))
          }
        }
      )
    })
  }

  /**
   * 路线规划 - 步行
   */
  async planWalkingRoute(options: {
    start: [number, number]
    end: [number, number]
  }): Promise<RouteResult> {
    console.log('[路线规划] 开始步行路线规划')
    console.log('[路线规划] 起点:', options.start)
    console.log('[路线规划] 终点:', options.end)

    return new Promise((resolve, reject) => {
      if (!window.AMap) {
        reject(new Error('高德地图 JS API 未加载'))
        return
      }

      const walking = new window.AMap.Walking({
        extensions: 'base'
      })

      walking.search(
        new window.AMap.LngLat(options.start[0], options.start[1]),
        new window.AMap.LngLat(options.end[0], options.end[1]),
        (status: string, result: any) => {
          if (status === 'complete' && result.routes && result.routes.length > 0) {
            const route = result.routes[0]
            const path: Array<[number, number]> = []
            
            route.steps.forEach((step: any) => {
              step.path.forEach((point: any) => {
                path.push([point.lng, point.lat])
              })
            })

            console.log(`[路线规划] ✅ 成功 - 距离: ${route.distance}米, 时间: ${route.time}秒`)
            
            resolve({
              distance: route.distance,
              duration: route.time,
              path,
              steps: route.steps
            })
          } else {
            console.log('[路线规划] ❌ 失败:', status, result)
            reject(new Error(`步行路线规划失败: ${status}`))
          }
        }
      )
    })
  }

  /**
   * 绘制路线 (增强版)
   */
  drawRouteEnhanced(route: MapRoute): any {
    if (!this.map) {
      console.error('[绘制路线] 地图未初始化')
      return null
    }

    console.log('[绘制路线] 绘制路线:', route.id)

    // 构建完整路径
    const path: Array<[number, number]> = [route.start]
    if (route.waypoints) {
      path.push(...route.waypoints.map(wp => wp.position))
    }
    path.push(route.end)

    const polyline = new window.AMap.Polyline({
      path,
      strokeColor: route.color || '#3370FF',
      strokeWeight: 6,
      strokeOpacity: 0.8,
      strokeStyle: route.style || 'solid',
      strokeDasharray: route.style === 'dashed' ? [10, 5] : undefined,
      lineJoin: 'round',
      lineCap: 'round',
      showDir: true, // 显示方向箭头
      map: this.map
    })

    this.polylines.push(polyline)
    console.log('[绘制路线] ✅ 绘制完成')
    
    return polyline
  }

  /**
   * 批量添加标记并按天分组
   */
  addMarkersByDay(dayIndex: number, markers: MapMarker[]): any[] {
    console.log(`[添加标记] Day ${dayIndex + 1} - 添加 ${markers.length} 个标记`)
    
    const dayMarkers: any[] = []
    
    markers.forEach((marker, index) => {
      const amapMarker = this.addMarker(marker)
      if (amapMarker) {
        dayMarkers.push(amapMarker)
        console.log(`[添加标记] ${index + 1}. ${marker.title}`, marker.position)
      }
    })
    
    this.markersByDay.set(dayIndex, dayMarkers)
    console.log(`[添加标记] ✅ Day ${dayIndex + 1} 完成`)
    
    return dayMarkers
  }

  /**
   * 显示/隐藏某天的标记
   */
  toggleDayMarkers(dayIndex: number, visible: boolean): void {
    const markers = this.markersByDay.get(dayIndex)
    if (!markers) {
      console.log(`[切换标记] Day ${dayIndex + 1} 没有标记`)
      return
    }

    console.log(`[切换标记] Day ${dayIndex + 1} - ${visible ? '显示' : '隐藏'}`)
    
    markers.forEach(marker => {
      if (visible) {
        marker.show()
      } else {
        marker.hide()
      }
    })
  }

  /**
   * 绘制某天的路线并保存引用
   */
  drawDayRoute(dayIndex: number, route: MapRoute): any {
    console.log(`[绘制路线] Day ${dayIndex + 1}`)
    
    const polyline = this.drawRouteEnhanced(route)
    
    if (polyline) {
      let dayRoutes = this.routesByDay.get(dayIndex)
      if (!dayRoutes) {
        dayRoutes = []
        this.routesByDay.set(dayIndex, dayRoutes)
      }
      dayRoutes.push(polyline)
    }
    
    return polyline
  }

  /**
   * 显示/隐藏某天的路线
   */
  toggleDayRoute(dayIndex: number, visible: boolean): void {
    const routes = this.routesByDay.get(dayIndex)
    if (!routes) {
      console.log(`[切换路线] Day ${dayIndex + 1} 没有路线`)
      return
    }

    console.log(`[切换路线] Day ${dayIndex + 1} - ${visible ? '显示' : '隐藏'}`)
    
    routes.forEach(polyline => {
      if (visible) {
        polyline.show()
      } else {
        polyline.hide()
      }
    })
  }

  /**
   * 显示所有标记和路线
   */
  showAll(): void {
    console.log('[显示全部] 显示所有标记和路线')
    
    this.markersByDay.forEach((markers, dayIndex) => {
      this.toggleDayMarkers(dayIndex, true)
    })
    
    this.routesByDay.forEach((routes, dayIndex) => {
      this.toggleDayRoute(dayIndex, true)
    })
  }

  /**
   * 隐藏所有标记和路线
   */
  hideAll(): void {
    console.log('[隐藏全部] 隐藏所有标记和路线')
    
    this.markersByDay.forEach((markers, dayIndex) => {
      this.toggleDayMarkers(dayIndex, false)
    })
    
    this.routesByDay.forEach((routes, dayIndex) => {
      this.toggleDayRoute(dayIndex, false)
    })
  }

  /**
   * 只显示指定天数
   */
  showOnlyDay(dayIndex: number): void {
    console.log(`[单独显示] 只显示 Day ${dayIndex + 1}`)
    
    // 隐藏所有
    this.hideAll()
    
    // 显示指定天
    this.toggleDayMarkers(dayIndex, true)
    this.toggleDayRoute(dayIndex, true)
    
    // 调整视野
    const markers = this.markersByDay.get(dayIndex)
    if (markers && markers.length > 0) {
      this.map.setFitView(markers, false, [50, 50, 50, 50])
    }
  }

  /**
   * 周边搜索
   */
  async searchNearby(options: {
    keyword: string
    center: [number, number]
    radius: number // 米
    type?: string
  }): Promise<any[]> {
    console.log('[周边搜索] 关键词:', options.keyword)
    console.log('[周边搜索] 中心:', options.center)
    console.log('[周边搜索] 半径:', options.radius)

    return new Promise((resolve, reject) => {
      if (!window.AMap) {
        reject(new Error('高德地图 JS API 未加载'))
        return
      }

      const placeSearch = new window.AMap.PlaceSearch({
        pageSize: 20,
        type: options.type || ''
      })

      placeSearch.searchNearBy(
        options.keyword,
        options.center,
        options.radius,
        (status: string, result: any) => {
          if (status === 'complete' && result.poiList) {
            console.log(`[周边搜索] ✅ 找到 ${result.poiList.pois.length} 个结果`)
            resolve(result.poiList.pois)
          } else {
            console.log('[周边搜索] ❌ 失败:', status)
            reject(new Error(`周边搜索失败: ${status}`))
          }
        }
      )
    })
  }

  /**
   * 清除所有路线
   */
  clearRoutes(): void {
    if (this.polylines.length > 0) {
      this.map?.remove(this.polylines)
      this.polylines = []
      this.routesByDay.clear()
      console.log('[清除路线] ✅ 已清除所有路线')
    }
  }

  /**
   * 清除所有内容
   */
  clearAll(): void {
    console.log('[清除所有] 清除地图上所有内容')
    this.clearMarkers()
    this.clearRoutes()
    this.markersByDay.clear()
  }

  /**
   * 销毁地图
   */
  destroy(): void {
    if (this.map) {
      console.log('[销毁地图] 销毁地图实例')
      this.clearAll()
      this.map.destroy()
      this.map = null
    }
  }

  /**
   * 获取地图实例
   */
  getMap(): any {
    return this.map
  }

  /**
   * 创建自定义信息窗口
   */
  createInfoWindow(content: string, position: [number, number]): any {
    if (!this.map) return null

    const infoWindow = new window.AMap.InfoWindow({
      content,
      offset: new window.AMap.Pixel(0, -30),
      autoMove: true,
      closeWhenClickMap: true
    })

    infoWindow.open(this.map, position)
    return infoWindow
  }
}

// 单例模式
export const amapJSService = new AmapJSService()
