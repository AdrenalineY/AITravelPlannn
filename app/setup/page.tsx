'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spin } from 'antd'

export default function SetupPage() {
  const router = useRouter()

  useEffect(() => {
    // 重定向到 API 配置页面
    router.replace('/setup/api-config')
  }, [router])

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f0f2f5'
    }}>
      <Spin size="large" tip="正在跳转到 API 配置..." />
    </div>
  )
}