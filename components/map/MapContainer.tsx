'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useMapStore } from '@/store/mapStore'
import { useConfigStore } from '@/store/configStore'
import type { POI } from '@/types'

// 高德地图 JS API 类型声明
declare global {
  interface Window {
    AMap: any
    _AMapSecurityConfig?: {
      securityJsCode?: string
    }
  }
}

interface MapContainerProps {
  onMapClick?: (lng: number, lat: number) => void
  style?: React.CSSProperties
}

export function MapContainer({ onMapClick, style }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const amapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const routeLayerRef = useRef<any>(null)
  
  const { config } = useConfigStore()
  const {
    center,
    zoom,
    markers,
    currentRoute,
    setCenter,
    setZoom,
    setIsMapLoaded,
    setSelectedPOI,
  } = useMapStore()

  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 加载高德地图 JS API
  useEffect(() => {
    if (!config?.map?.jsApiKey) {
      setLoadError('高德地图 JS API Key 未配置')
      return
    }

    // 检查是否已加载
    if (window.AMap) {
      setIsScriptLoaded(true)
      return
    }

    // 配置安全密钥（如果提供）
    if (config.map.securityCode) {
      window._AMapSecurityConfig = {
        securityJsCode: config.map.securityCode,
      }
    }

    // 动态加载高德地图脚本
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${config.map.jsApiKey}`
    script.async = true
    
    script.onload = () => {
      setIsScriptLoaded(true)
      setLoadError(null)
    }
    
    script.onerror = () => {
      setLoadError('高德地图 JS API 加载失败')
    }

    document.head.appendChild(script)

    return () => {
      // 清理脚本(可选,因为一般只加载一次)
      // document.head.removeChild(script)
    }
  }, [config?.map?.jsApiKey, config?.map?.securityCode])

  // 初始化地图
  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || amapInstanceRef.current) {
      return
    }

    try {
      // 创建地图实例
      const map = new window.AMap.Map(mapRef.current, {
        center: [center.lng, center.lat],
        zoom: zoom,
        viewMode: '2D', // 使用 2D 视图
        lang: 'zh_cn',
        mapStyle: 'amap://styles/normal', // 标准样式
      })

      // 添加缩放控件
      map.addControl(new window.AMap.Scale())
      map.addControl(new window.AMap.ToolBar({
        position: { top: '10px', right: '10px' }
      }))

      // 地图点击事件
      map.on('click', (e: any) => {
        const lng = e.lnglat.getLng()
        const lat = e.lnglat.getLat()
        onMapClick?.(lng, lat)
      })

      // 地图加载完成
      map.on('complete', () => {
        setIsMapLoaded(true)
      })

      amapInstanceRef.current = map
    } catch (error) {
      console.error('地图初始化失败:', error)
      setLoadError('地图初始化失败: ' + (error as Error).message)
    }

    // 清理函数
    return () => {
      if (amapInstanceRef.current) {
        amapInstanceRef.current.destroy()
        amapInstanceRef.current = null
      }
    }
  }, [isScriptLoaded, onMapClick])

  // 更新地图中心和缩放
  useEffect(() => {
    if (!amapInstanceRef.current) return

    amapInstanceRef.current.setCenter([center.lng, center.lat])
    amapInstanceRef.current.setZoom(zoom)
  }, [center, zoom])

  // 更新标记
  useEffect(() => {
    if (!amapInstanceRef.current || !isScriptLoaded) return

    // 清除旧标记
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // 添加新标记
    markers.forEach((poi) => {
      const marker = new window.AMap.Marker({
        position: [poi.location.lng, poi.location.lat],
        title: poi.name,
        icon: new window.AMap.Icon({
          size: new window.AMap.Size(32, 32),
          image: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
              <circle cx="16" cy="16" r="14" fill="#ef4444" stroke="white" stroke-width="2"/>
              <text x="16" y="21" text-anchor="middle" font-size="16" fill="white">📍</text>
            </svg>
          `),
          imageSize: new window.AMap.Size(32, 32),
        }),
        offset: new window.AMap.Pixel(-16, -32),
      })

      // 标记点击事件
      marker.on('click', () => {
        setSelectedPOI(poi)
        setCenter(poi.location)
        setZoom(15)

        // 显示信息窗体
        const infoWindow = new window.AMap.InfoWindow({
          content: `
            <div style="padding: 10px;">
              <h3 style="margin: 0 0 5px 0; font-weight: bold;">${poi.name}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">${poi.address || ''}</p>
              ${poi.rating ? `<p style="margin: 5px 0 0 0; font-size: 12px;">评分: ${poi.rating}</p>` : ''}
            </div>
          `,
          offset: new window.AMap.Pixel(0, -32),
        })
        infoWindow.open(amapInstanceRef.current, [poi.location.lng, poi.location.lat])
      })

      marker.setMap(amapInstanceRef.current)
      markersRef.current.push(marker)
    })
  }, [markers, isScriptLoaded, setSelectedPOI, setCenter, setZoom])

  // 绘制路线
  useEffect(() => {
    if (!amapInstanceRef.current || !isScriptLoaded) return

    // 移除旧路线
    if (routeLayerRef.current) {
      amapInstanceRef.current.remove(routeLayerRef.current)
      routeLayerRef.current = null
    }

    // 绘制新路线
    if (currentRoute && currentRoute.polyline) {
      try {
        // 解析高德路径字符串格式: "lng,lat;lng,lat;..."
        const path = currentRoute.polyline
          .split(';')
          .map(point => {
            const [lng, lat] = point.split(',').map(Number)
            return [lng, lat]
          })
          .filter(point => !isNaN(point[0]) && !isNaN(point[1]))

        if (path.length > 0) {
          const polyline = new window.AMap.Polyline({
            path: path,
            strokeColor: '#3b82f6',
            strokeWeight: 4,
            strokeOpacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round',
          })

          polyline.setMap(amapInstanceRef.current)
          routeLayerRef.current = polyline

          // 自动调整视野以适应路线
          amapInstanceRef.current.setFitView([polyline])
        }
      } catch (error) {
        console.error('路线绘制失败:', error)
      }
    }
  }, [currentRoute, isScriptLoaded])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
      {/* 地图容器 */}
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* 加载/错误提示 */}
      {loadError && (
        <div className="absolute top-4 left-4 bg-red-100 border border-red-400 text-red-800 p-4 rounded max-w-md z-10">
          <p className="font-bold">⚠️ 地图加载失败</p>
          <p className="text-sm mt-2">{loadError}</p>
          {!config?.map?.jsApiKey && (
            <p className="text-sm mt-2">
              请在配置页面设置高德地图 JS API Key
              <br />
              <a 
                href="https://console.amap.com/dev/key/app" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="underline"
              >
                前往高德开放平台创建 →
              </a>
            </p>
          )}
        </div>
      )}

      {!isScriptLoaded && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载地图中...</p>
          </div>
        </div>
      )}
    </div>
  )
}

