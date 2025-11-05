'use client'

import { useEffect, useState } from 'react'

// 扩展 Window 类型以支持高德地图
declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}

export function AmapScriptLoader() {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 检查是否已经加载
    if (window.AMap) {
      setLoaded(true)
      return
    }

    // 从 API 获取用户的高德地图 JS API Key
    const loadAmapScript = async () => {
      try {
        console.log('[AmapLoader] 开始获取地图配置...')
        const response = await fetch('/api/config/map-key')
        const data = await response.json()
        
        console.log('[AmapLoader] 配置响应:', {
          hasJsApiKey: !!data.jsApiKey,
          hasSecurityCode: !!data.securityCode,
          message: data.message,
          error: data.error
        })
        
        if (!data.jsApiKey) {
          console.warn('[AmapLoader] 未配置高德地图 JS API Key:', data.message)
          setError(data.message || '未配置地图 API Key')
          return
        }

        // 如果有安全密钥,设置到 window._AMapSecurityConfig
        if (data.securityCode) {
          window._AMapSecurityConfig = {
            securityJsCode: data.securityCode
          }
          console.log('[AmapLoader] 已设置安全密钥')
        }

        // 动态加载高德地图脚本
        const script = document.createElement('script')
        script.type = 'text/javascript'
        // 加载必要的插件: 比例尺、工具条、定位、POI搜索、路线规划
        script.src = `https://webapi.amap.com/maps?v=2.0&key=${data.jsApiKey}&plugin=AMap.Scale,AMap.ToolBar,AMap.Geolocation,AMap.PlaceSearch,AMap.Driving,AMap.Marker,AMap.InfoWindow`
        
        script.onload = () => {
          console.log('[AmapLoader] ✅ 高德地图 JS API 加载成功')
          console.log('[AmapLoader] 可用插件:', {
            AMap: !!window.AMap,
            PlaceSearch: !!window.AMap?.PlaceSearch,
            Driving: !!window.AMap?.Driving,
            Marker: !!window.AMap?.Marker,
          })
          setLoaded(true)
        }
        
        script.onerror = (err) => {
          console.error('[AmapLoader] ❌ 高德地图 JS API 加载失败:', err)
          setError('地图脚本加载失败，请检查网络连接或 API Key 是否正确')
        }
        
        document.head.appendChild(script)
      } catch (err) {
        console.error('[AmapLoader] ❌ 获取地图配置失败:', err)
        setError('获取配置失败: ' + (err as Error).message)
      }
    }

    loadAmapScript()
  }, [])

  // 这是一个纯逻辑组件,不渲染任何内容
  return null
}
