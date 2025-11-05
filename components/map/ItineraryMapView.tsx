/**
 * 行程地图可视化组件
 * 显示整个行程的地图视图,包括所有景点标记和路线
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Spin, Button, Space, message } from 'antd'
import { amapJSService } from '@/services/amapJSService'
import { 
  convertItineraryToMapData, 
  convertItineraryCardToMapData,
  filterMarkersByDay, 
  filterRoutesByDay 
} from '@/utils/itineraryToMapData'
import type { Itinerary, ItineraryCard, Activity } from '@/types'
import type { MapMarker, MapRoute } from '@/utils/itineraryToMapData'

interface ItineraryMapViewProps {
  itinerary?: Itinerary
  itineraryCard?: ItineraryCard
  selectedDayIndex?: number | null  // null 表示显示全部
  showAllDays?: boolean
  highlightActivity?: string
  onActivityClick?: (activity: Activity) => void
  height?: string | number
}

export default function ItineraryMapView({
  itinerary,
  itineraryCard,
  selectedDayIndex = null,
  showAllDays = true,
  highlightActivity,
  onActivityClick,
  height = '100%'
}: ItineraryMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDay, setCurrentDay] = useState<number | null>(selectedDayIndex)
  const [mapData, setMapData] = useState<{
    markers: MapMarker[]
    routes: MapRoute[]
    center: [number, number]
  } | null>(null)
  const mapIdRef = useRef<string>(`itinerary-map-${Date.now()}-${Math.random()}`)
  const isInitializedRef = useRef(false)
  
  // 使用哪个数据源
  const dataSource = itinerary || itineraryCard

  // 初始化地图和数据
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return

    const initializeMap = async () => {
      try {
        setLoading(true)
        setError(null)
        console.log('[行程地图] 开始初始化')

        // 等待高德地图 JS API 加载
        if (!window.AMap) {
          console.log('[行程地图] 等待高德地图 JS API 加载...')
          await new Promise((resolve) => {
            const checkAMap = setInterval(() => {
              if (window.AMap) {
                clearInterval(checkAMap)
                resolve(true)
              }
            }, 100)
            // 超时保护
            setTimeout(() => {
              clearInterval(checkAMap)
              resolve(false)
            }, 10000)
          })
        }

        if (!window.AMap) {
          throw new Error('高德地图 JS API 加载超时')
        }

        console.log('[行程地图] 转换行程数据...')
        console.log('[行程地图] 数据源类型:', itineraryCard ? 'ItineraryCard' : 'Itinerary')
        
        // 根据数据类型选择转换函数
        let data
        if (itineraryCard) {
          data = await convertItineraryCardToMapData(itineraryCard)
        } else if (itinerary) {
          data = await convertItineraryToMapData(itinerary)
        } else {
          throw new Error('未提供行程数据')
        }
        
        setMapData(data)

        if (data.markers.length === 0) {
          console.warn('[行程地图] ⚠️ 没有可显示的地点数据')
          throw new Error('行程中没有包含地理位置信息')
        }

        console.log('[行程地图] 初始化地图实例...')
        // 初始化地图
        await amapJSService.initMap(mapIdRef.current, {
          center: data.center,
          zoom: data.zoom,
          viewMode: '2D'
        })

        console.log('[行程地图] 添加标记和路线...')
        
        // 计算总天数
        const totalDays = dataSource?.days?.length || 0
        
        // 按天添加标记
        if (showAllDays && currentDay === null) {
          // 显示所有天数
          for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
            const dayMarkers = filterMarkersByDay(data.markers, dayIndex)
            if (dayMarkers.length > 0) {
              amapJSService.addMarkersByDay(dayIndex, dayMarkers)
            }
          }

          // 绘制所有路线
          data.routes.forEach(route => {
            amapJSService.drawDayRoute(route.dayIndex, route)
          })

          // 自适应视野
          setTimeout(() => {
            amapJSService.fitView()
          }, 300)
        } else if (currentDay !== null) {
          // 只显示选中的天
          const dayMarkers = filterMarkersByDay(data.markers, currentDay)
          if (dayMarkers.length > 0) {
            amapJSService.addMarkersByDay(currentDay, dayMarkers)
          }

          const dayRoutes = filterRoutesByDay(data.routes, currentDay)
          dayRoutes.forEach(route => {
            amapJSService.drawDayRoute(route.dayIndex, route)
          })

          setTimeout(() => {
            amapJSService.showOnlyDay(currentDay)
          }, 300)
        }

        isInitializedRef.current = true
        setLoading(false)
        console.log('[行程地图] ✅ 初始化完成')
      } catch (err) {
        console.error('[行程地图] ❌ 初始化失败:', err)
        setError(err instanceof Error ? err.message : '地图加载失败')
        setLoading(false)
      }
    }

    initializeMap()

    // 清理
    return () => {
      if (isInitializedRef.current) {
        console.log('[行程地图] 清理地图资源')
        amapJSService.clearAll()
        isInitializedRef.current = false
      }
    }
  }, [itinerary?.id, itineraryCard?.id]) // 只在行程 ID 变化时重新初始化

  // 切换天数显示
  useEffect(() => {
    if (!isInitializedRef.current || !mapData) return

    console.log('[行程地图] 切换显示:', currentDay === null ? '全部' : `Day ${currentDay + 1}`)

    if (currentDay === null) {
      // 显示全部
      amapJSService.showAll()
      setTimeout(() => {
        amapJSService.fitView()
      }, 100)
    } else {
      // 只显示指定天
      amapJSService.showOnlyDay(currentDay)
    }
  }, [currentDay, mapData])

  // 切换到指定天数
  const handleDayChange = (dayIndex: number | null) => {
    setCurrentDay(dayIndex)
  }

  // 渲染天数选择器
  const renderDaySelector = () => {
    const days = dataSource?.days
    if (!days || days.length === 0) return null

    return (
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: 'white',
          padding: '8px 12px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        <Space>
          <Button
            size="small"
            type={currentDay === null ? 'primary' : 'default'}
            onClick={() => handleDayChange(null)}
          >
            全部
          </Button>
          {days.map((day, index) => (
            <Button
              key={index}
              size="small"
              type={currentDay === index ? 'primary' : 'default'}
              onClick={() => handleDayChange(index)}
            >
              Day {index + 1}
            </Button>
          ))}
        </Space>
      </div>
    )
  }

  // 渲染图例
  const renderLegend = () => {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          zIndex: 1000,
          background: 'white',
          padding: '8px 12px',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: 12
        }}
      >
        <div style={{ marginBottom: 4, fontWeight: 600 }}>图例</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>📍</span>
            <span>景点</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🍴</span>
            <span>餐厅</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🏨</span>
            <span>住宿</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
          color: '#999',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
          <div style={{ fontSize: 16, marginBottom: 4 }}>地图加载失败</div>
          <div style={{ fontSize: 12 }}>{error}</div>
        </div>
        <Button onClick={() => window.location.reload()}>刷新页面</Button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            zIndex: 1000
          }}
        >
          <Spin size="large" tip="地图加载中..." />
        </div>
      )}
      
      <div
        ref={containerRef}
        id={mapIdRef.current}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          overflow: 'hidden'
        }}
      />
      
      {!loading && (
        <>
          {renderDaySelector()}
          {renderLegend()}
        </>
      )}
    </div>
  )
}
