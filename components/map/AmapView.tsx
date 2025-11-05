'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Spin } from 'antd'
import { amapJSService, type MapMarker } from '@/services/amapJSService'

interface AmapViewProps {
  markers?: MapMarker[]
  center?: [number, number]
  zoom?: number
  height?: string | number
  onMarkerClick?: (marker: MapMarker) => void
  autoFitView?: boolean
}

export default function AmapView({
  markers = [],
  center,
  zoom = 12,
  height = '100%',
  onMarkerClick,
  autoFitView = true
}: AmapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mapIdRef = useRef<string>(`map-${Date.now()}-${Math.random()}`)

  useEffect(() => {
    if (!containerRef.current) return

    const initMap = async () => {
      try {
        setLoading(true)
        setError(null)

        // 等待高德地图 JS API 加载
        if (!window.AMap) {
          await new Promise((resolve) => {
            const checkAMap = setInterval(() => {
              if (window.AMap) {
                clearInterval(checkAMap)
                resolve(true)
              }
            }, 100)
          })
        }

        // 初始化地图
        await amapJSService.initMap(mapIdRef.current, {
          center,
          zoom,
          viewMode: '2D'
        })

        setLoading(false)
      } catch (err) {
        console.error('地图初始化失败:', err)
        setError(err instanceof Error ? err.message : '地图加载失败')
        setLoading(false)
      }
    }

    initMap()

    // 清理
    return () => {
      amapJSService.destroy()
    }
  }, [center, zoom])

  // 更新标记点
  useEffect(() => {
    if (loading || !amapJSService.getMap()) return

    // 清除旧标记
    amapJSService.clearMarkers()

    // 添加新标记
    if (markers.length > 0) {
      amapJSService.addMarkers(markers)

      // 自动调整视野
      if (autoFitView) {
        setTimeout(() => {
          amapJSService.fitView()
        }, 300)
      }
    }
  }, [markers, loading, autoFitView])

  if (error) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f5f5f5',
          color: '#999'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
          <div>地图加载失败</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{error}</div>
        </div>
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
    </div>
  )
}
